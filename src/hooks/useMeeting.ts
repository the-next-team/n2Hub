import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { transcribeAudio, formatMeetingTranscript, summarizeMeeting } from '../lib/groq'
import { saveMdToProject } from '../lib/saveMdToProject'

export type MeetingState = 'idle' | 'recording' | 'paused' | 'processing' | 'done'

export interface MeetingSession {
  id: string
  projectId: string
  title: string
  attendees: string
  startedAt: string
  endedAt?: string
  transcript: string
  summary?: string
}

// ── Web Speech API 타입 선언 ──────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:    (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

// ── 회의 훅 ──────────────────────────────────────────────────────────────
export function useMeeting(projectId: string) {
  const [state, setState]                   = useState<MeetingState>('idle')
  const [session, setSession]               = useState<MeetingSession | null>(null)
  const [liveTranscript, setLive]           = useState('')  // Web Speech 실시간 누적
  const [transcript, setTranscript]         = useState('')  // Whisper 최종 결과 (편집 가능)
  const [interimText, setInterimText]       = useState('')  // Web Speech 미확정 텍스트
  const [summary, setSummary]               = useState('')
  const [minutes, setMinutes]               = useState('')
  const [elapsed, setElapsed]               = useState(0)
  const [error, setError]                   = useState('')
  const [processingStep, setProcessingStep] = useState('')

  const recognitionRef   = useRef<SpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const mimeTypeRef      = useRef('')
  const elapsedTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef     = useRef<string | null>(null)
  const sessionRef       = useRef<MeetingSession | null>(null)
  const liveRef          = useRef('')    // liveTranscript 동기 참조
  const isActiveRef      = useRef(false)

  function formatElapsed(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  function createRecognition(): SpeechRecognition | null {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return null
    const rec = new SR()
    rec.lang            = 'ko-KR'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            liveRef.current = liveRef.current ? `${liveRef.current}\n${text}` : text
            setLive(liveRef.current)
          }
          setInterimText('')
        } else {
          interim += result[0].transcript
        }
      }
      if (interim) setInterimText(interim)
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      console.warn('[Speech] 오류:', e.error)
    }

    rec.onend = () => {
      if (isActiveRef.current) {
        try { rec.start() } catch { /* 이미 시작됨 */ }
      }
    }
    return rec
  }

  // ── 회의 시작 ──────────────────────────────────────────────────────────
  const startMeeting = useCallback(async (title: string, attendees: string) => {
    setError('')
    setLive(''); setTranscript(''); setInterimText('')
    setSummary(''); setMinutes(''); setElapsed(0); setProcessingStep('')
    liveRef.current = ''
    audioChunksRef.current = []

    // 1. 마이크 스트림 요청
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('마이크 권한이 필요합니다. 브라우저 주소창의 자물쇠 아이콘에서 권한을 허용해주세요.')
      return
    }
    streamRef.current = stream

    // 2. MediaRecorder — 전체 회의 녹음 (Whisper 일괄 처리용)
    const mimeType = getSupportedMimeType()
    mimeTypeRef.current = mimeType
    try {
      const mr = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 24000,  // 24kbps: 음성에 충분, 1시간 ≈ 10MB
      })
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(1000)
      mediaRecorderRef.current = mr
    } catch (err) {
      console.warn('[MediaRecorder] 초기화 실패 — Web Speech만 사용:', err)
    }

    // 3. Web Speech API — 녹음 중 실시간 프리뷰
    const rec = createRecognition()
    if (rec) {
      recognitionRef.current = rec
      isActiveRef.current = true
      try { rec.start() } catch { /* 무시 */ }
    }

    if (!rec && !mediaRecorderRef.current) {
      stream.getTracks().forEach(t => t.stop())
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.')
      return
    }

    // 4. DB 레코드 생성
    const { data: { user } } = await supabase.auth.getUser()
    const { data: row } = await supabase.from('meetings').insert([{
      project_id: projectId,
      title:      title || '회의',
      attendees:  attendees || '',
      created_by: user?.id,
    }]).select().single()

    if (row) {
      sessionIdRef.current = row.id
      const s: MeetingSession = {
        id: row.id, projectId,
        title: row.title, attendees: row.attendees,
        startedAt: row.started_at, transcript: '',
      }
      setSession(s)
      sessionRef.current = s
    }

    setState('recording')
    elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }, [projectId])

  // ── 일시 정지 / 재개 ────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    if (state === 'recording') {
      isActiveRef.current = false
      recognitionRef.current?.stop()
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.pause()
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      setState('paused')
    } else if (state === 'paused') {
      isActiveRef.current = true
      try { recognitionRef.current?.start() } catch { /* 이미 시작됨 */ }
      if (mediaRecorderRef.current?.state === 'paused') mediaRecorderRef.current.resume()
      elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      setState('recording')
    }
  }, [state])

  // ── 회의 종료 → 전체 오디오 Whisper 처리 ───────────────────────────────
  const endMeeting = useCallback(() => {
    if (!sessionIdRef.current) return
    isActiveRef.current = false
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    recognitionRef.current?.stop()
    setInterimText('')
    setState('processing')
    setProcessingStep('녹음 마무리 중...')

    const mr          = mediaRecorderRef.current
    const capturedId  = sessionIdRef.current

    const processAudio = async (blob: Blob | null) => {
      streamRef.current?.getTracks().forEach(t => t.stop())

      if (!blob || blob.size < 2000) {
        // 오디오 없음 → 실시간 녹취록 사용
        const fallback = liveRef.current
        setTranscript(fallback)
        await supabase.from('meetings').update({
          ended_at: new Date().toISOString(),
          transcript: fallback,
        }).eq('id', capturedId)
        setProcessingStep('')
        setState('done')
        return
      }

      const sizeMB = (blob.size / 1024 / 1024).toFixed(1)
      setProcessingStep(`AI 음성 분석 중... (${sizeMB}MB)`)

      try {
        const whisperText = await transcribeAudio(blob)
        const finalText = whisperText.trim() || liveRef.current
        setTranscript(finalText)
        await supabase.from('meetings').update({
          ended_at: new Date().toISOString(),
          transcript: finalText,
        }).eq('id', capturedId)
      } catch (err) {
        console.warn('[Whisper] 실패 — 실시간 녹취록 사용:', err)
        const fallback = liveRef.current
        setTranscript(fallback)
        await supabase.from('meetings').update({
          ended_at: new Date().toISOString(),
          transcript: fallback,
        }).eq('id', capturedId)
      }

      setProcessingStep('')
      setState('done')
    }

    if (!mr || mr.state === 'inactive') {
      processAudio(null)
      return
    }

    mr.onstop = () => {
      const blob = new Blob(audioChunksRef.current, {
        type: mimeTypeRef.current || 'audio/webm',
      })
      processAudio(blob)
    }
    mr.stop()
  }, [])

  // ── 회의록 생성 ─────────────────────────────────────────────────────────
  const generateMinutes = useCallback(async (editedTranscript: string) => {
    if (!sessionIdRef.current || !editedTranscript.trim()) return
    setState('processing')

    setProcessingStep('핵심 요약 생성 중...')
    let aiSummary = ''
    try {
      aiSummary = await summarizeMeeting(editedTranscript)
      setSummary(aiSummary)
    } catch { aiSummary = '' }

    setProcessingStep('회의록 작성 중...')
    let aiMinutes = ''
    try {
      aiMinutes = await formatMeetingTranscript(editedTranscript, {
        date:      new Date().toLocaleDateString('ko-KR'),
        attendees: sessionRef.current?.attendees ?? '',
        title:     sessionRef.current?.title ?? '회의',
      })
      setMinutes(aiMinutes)
    } catch (err) {
      aiMinutes = `오류: ${(err as Error).message}`
      setMinutes(aiMinutes)
    }

    await supabase.from('meetings').update({
      transcript: editedTranscript,
      summary:    aiSummary,
    }).eq('id', sessionIdRef.current)

    if (aiMinutes && sessionRef.current) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const today = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')
        await saveMdToProject(aiMinutes, `회의록_${today}.md`, projectId, user?.id ?? '')
      } catch { /* 저장 실패 무시 */ }
    }

    setProcessingStep('')
    setState('done')
  }, [projectId])

  useEffect(() => {
    return () => {
      isActiveRef.current = false
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      recognitionRef.current?.stop()
      try {
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
      } catch { /* 무시 */ }
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return {
    state, session,
    liveTranscript,   // 녹음 중 실시간 프리뷰 (Web Speech)
    transcript,       // Whisper 최종 결과 (편집 가능)
    setTranscript,
    interimText,
    summary, minutes,
    elapsed, elapsedFormatted: formatElapsed(elapsed),
    error, processingStep,
    startMeeting, togglePause, endMeeting, generateMinutes,
  }
}

// ── 회의 목록 ──────────────────────────────────────────────────────────────
export function useMeetings(projectId: string) {
  const [meetings, setMeetings] = useState<MeetingSession[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    supabase.from('meetings')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setMeetings((data ?? []).map((r: any) => ({
          id: r.id, projectId: r.project_id, title: r.title,
          attendees: r.attendees ?? '', startedAt: r.started_at,
          endedAt: r.ended_at ?? undefined,
          transcript: r.transcript ?? '', summary: r.summary ?? undefined,
        })))
        setLoading(false)
      })
  }, [projectId])

  async function deleteMeeting(id: string) {
    await supabase.from('meetings').delete().eq('id', id)
    setMeetings(prev => prev.filter(m => m.id !== id))
  }

  return { meetings, loading, deleteMeeting }
}
