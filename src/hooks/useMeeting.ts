import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { summarizeMeeting, formatMeetingTranscript } from '../lib/groq'
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

// Web Speech API 타입 선언 (브라우저 벤더 접두어 포함)
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

export function useMeeting(projectId: string) {
  const [state, setState]             = useState<MeetingState>('idle')
  const [session, setSession]         = useState<MeetingSession | null>(null)
  const [transcript, setTranscript]   = useState<string>('')
  const [interimText, setInterimText] = useState<string>('')  // 실시간 미확정 텍스트
  const [summary, setSummary]         = useState<string>('')
  const [minutes, setMinutes]         = useState<string>('')
  const [elapsed, setElapsed]         = useState(0)
  const [error, setError]             = useState<string>('')
  const [chunkStatus, setChunkStatus] = useState<string>('')

  const recognitionRef  = useRef<SpeechRecognition | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef    = useRef<string | null>(null)
  const transcriptRef   = useRef<string>('')  // transcript 최신값 동기 참조
  const isActiveRef     = useRef(false)

  function formatElapsed(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // transcript 상태 동기 업데이트
  function appendTranscript(text: string) {
    transcriptRef.current = transcriptRef.current
      ? `${transcriptRef.current}\n${text}`
      : text
    setTranscript(transcriptRef.current)
    // DB 저장
    if (sessionIdRef.current) {
      supabase.from('meetings')
        .update({ transcript: transcriptRef.current })
        .eq('id', sessionIdRef.current)
        .then(() => {})
    }
  }

  // SpeechRecognition 인스턴스 생성 및 이벤트 연결
  function createRecognition(): SpeechRecognition | null {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return null

    const rec = new SR()
    rec.lang             = 'ko-KR'
    rec.continuous       = true     // 끊기지 않고 계속 인식
    rec.interimResults   = true     // 실시간 미확정 결과 표시
    rec.maxAlternatives  = 1

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) appendTranscript(text)
          setInterimText('')
        } else {
          interim += result[0].transcript
        }
      }
      if (interim) setInterimText(interim)
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return       // 무음은 정상, 무시
      if (e.error === 'aborted')   return       // 수동 중단, 무시
      setError(`음성 인식 오류: ${e.error}`)
    }

    // continuous=true여도 브라우저가 끊길 수 있음 → 자동 재시작
    rec.onend = () => {
      if (isActiveRef.current && state !== 'paused') {
        try { rec.start() } catch { /* 이미 시작됨 */ }
      }
    }

    return rec
  }

  // 회의 시작
  const startMeeting = useCallback(async (title: string, attendees: string) => {
    setError('')
    setTranscript('')
    setInterimText('')
    setSummary('')
    setMinutes('')
    setElapsed(0)
    transcriptRef.current = ''

    // Web Speech API 지원 확인
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.')
      return
    }

    // DB 레코드 생성
    const { data: { user } } = await supabase.auth.getUser()
    const { data: row } = await supabase.from('meetings').insert([{
      project_id: projectId,
      title:      title || '회의',
      attendees:  attendees || '',
      created_by: user?.id,
    }]).select().single()

    if (!row) { setError('회의를 시작할 수 없습니다.'); return }
    sessionIdRef.current = row.id
    setSession({
      id: row.id, projectId, title: row.title,
      attendees: row.attendees, startedAt: row.started_at, transcript: '',
    })

    const rec = createRecognition()
    if (!rec) { setError('음성 인식 초기화 실패'); return }

    recognitionRef.current = rec
    isActiveRef.current    = true

    try {
      rec.start()
    } catch (e) {
      setError(`마이크 시작 실패: ${(e as Error).message}`)
      return
    }

    setState('recording')
    elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }, [projectId])

  // 일시 정지 / 재개
  const togglePause = useCallback(() => {
    if (state === 'recording') {
      recognitionRef.current?.stop()
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      setState('paused')
    } else if (state === 'paused') {
      isActiveRef.current = true
      try { recognitionRef.current?.start() } catch { /* 이미 시작됨 */ }
      elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      setState('recording')
    }
  }, [state])

  // 회의 종료
  const endMeeting = useCallback(async () => {
    if (!sessionIdRef.current) return
    setState('processing')
    isActiveRef.current = false

    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    recognitionRef.current?.stop()
    setInterimText('')

    const fullTranscript = transcriptRef.current

    await supabase.from('meetings').update({
      ended_at:   new Date().toISOString(),
      transcript: fullTranscript,
    }).eq('id', sessionIdRef.current)

    setTranscript(fullTranscript)
    setChunkStatus('')
    setState('done')
  }, [])

  // 편집된 녹취록으로 회의록 생성
  const generateMinutes = useCallback(async (editedTranscript: string) => {
    if (!sessionIdRef.current || !editedTranscript.trim()) return
    setState('processing')

    setChunkStatus('AI 요약 생성 중...')
    let aiSummary = ''
    try {
      aiSummary = await summarizeMeeting(editedTranscript)
      setSummary(aiSummary)
    } catch { aiSummary = '' }

    setChunkStatus('회의록 작성 중...')
    let aiMinutes = ''
    try {
      aiMinutes = await formatMeetingTranscript(editedTranscript, {
        date:      new Date().toLocaleDateString('ko-KR'),
        attendees: session?.attendees ?? '',
        title:     session?.title ?? '회의',
      })
      setMinutes(aiMinutes)
    } catch { aiMinutes = '' }

    await supabase.from('meetings').update({
      transcript: editedTranscript,
      summary:    aiSummary,
    }).eq('id', sessionIdRef.current)

    if (aiMinutes && session) {
      const { data: { user } } = await supabase.auth.getUser()
      const fileName = `회의록_${new Date().toLocaleDateString('ko-KR').replace(/\./g, '').replace(/ /g, '')}.md`
      try { await saveMdToProject(aiMinutes, fileName, projectId, user?.id ?? '') }
      catch { /* 저장 실패 무시 */ }
    }

    setChunkStatus('')
    setState('done')
  }, [projectId, session])

  useEffect(() => {
    return () => {
      isActiveRef.current = false
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      recognitionRef.current?.stop()
    }
  }, [])

  return {
    state, session, transcript, interimText, setTranscript, summary, minutes,
    elapsed, elapsedFormatted: formatElapsed(elapsed),
    error, chunkStatus,
    startMeeting, togglePause, endMeeting, generateMinutes,
  }
}

// ── 회의 목록 ──────────────────────────────────────────────────────────
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
