import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { transcribeAudio, summarizeMeeting, formatMeetingTranscript } from '../lib/groq'
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

const CHUNK_MS = 30_000 // 30초마다 Whisper 전송

export function useMeeting(projectId: string) {
  const [state, setState]               = useState<MeetingState>('idle')
  const [session, setSession]           = useState<MeetingSession | null>(null)
  const [transcript, setTranscript]     = useState<string>('')
  const [summary, setSummary]           = useState<string>('')
  const [minutes, setMinutes]           = useState<string>('')
  const [elapsed, setElapsed]           = useState(0)        // 초
  const [error, setError]               = useState<string>('')
  const [chunkStatus, setChunkStatus]   = useState<string>('')

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef         = useRef<Blob[]>([])
  const chunkTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef      = useRef<string | null>(null)
  const streamRef         = useRef<MediaStream | null>(null)

  // 경과 시간 포맷
  function formatElapsed(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 지원되는 MIME 타입 찾기 (브라우저별 호환)
  function getBestMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
  }

  // 청크 → Whisper 전송
  const flushChunk = useCallback(async (mimeOverride?: string) => {
    if (!chunksRef.current.length) return
    const mime = mimeOverride ?? (chunksRef.current[0]?.type ?? 'audio/webm')
    const blob = new Blob(chunksRef.current, { type: mime })
    chunksRef.current = []

    // 100바이트 미만은 빈 오디오로 간주
    if (blob.size < 100) return

    setChunkStatus(`변환 중... (${(blob.size / 1024).toFixed(0)}KB)`)
    try {
      const text = await transcribeAudio(blob)
      if (text.trim()) {
        setTranscript(prev => {
          const next = prev ? `${prev}\n${text}` : text
          if (sessionIdRef.current) {
            supabase.from('meetings')
              .update({ transcript: next })
              .eq('id', sessionIdRef.current)
              .then(() => {})
          }
          return next
        })
      }
    } catch (err) {
      // 오류를 상태로 노출 (조용히 삼키지 않음)
      const msg = (err as Error).message
      setError(`STT 오류: ${msg}`)
    } finally {
      setChunkStatus('')
    }
  }, [])

  // 회의 시작
  const startMeeting = useCallback(async (title: string, attendees: string) => {
    setError('')
    setTranscript('')
    setSummary('')
    setMinutes('')
    setElapsed(0)

    // 마이크 권한 요청
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
    } catch {
      setError('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.')
      return
    }

    // DB에 회의 레코드 생성
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

    // MediaRecorder 시작 — 브라우저 지원 MIME 자동 선택
    const mimeType = getBestMimeType()
    let recorder: MediaRecorder
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
    } catch (e) {
      setError(`녹음 초기화 실패: ${(e as Error).message}`)
      stream.getTracks().forEach(t => t.stop())
      return
    }
    mediaRecorderRef.current = recorder

    recorder.onerror = (e) => {
      setError(`녹음 오류: ${(e as any).error?.message ?? '알 수 없는 오류'}`)
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    // 5초마다 청크 수집 (ondataavailable 주기)
    recorder.start(5000)
    setState('recording')

    // 경과 타이머
    elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)

    // 30초마다 Whisper 전송
    chunkTimerRef.current = setInterval(() => flushChunk(mimeType || undefined), CHUNK_MS)
  }, [projectId, flushChunk])

  // 일시 정지 / 재개
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return
    if (state === 'recording') {
      mediaRecorderRef.current.pause()
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      setState('paused')
    } else if (state === 'paused') {
      mediaRecorderRef.current.resume()
      elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      setState('recording')
    }
  }, [state])

  // 회의 종료
  const endMeeting = useCallback(async () => {
    if (!mediaRecorderRef.current || !sessionIdRef.current) return
    setState('processing')

    // 타이머 정리
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    if (chunkTimerRef.current)   clearInterval(chunkTimerRef.current)

    // recorder.stop() → onstop 이벤트 대기 후 마지막 청크 flush
    const recorder = mediaRecorderRef.current
    const mimeType = recorder.mimeType

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })
    streamRef.current?.getTracks().forEach(t => t.stop())
    await flushChunk(mimeType || undefined)

    // 현재 전체 transcript 가져오기
    const { data: row } = await supabase
      .from('meetings').select('transcript').eq('id', sessionIdRef.current).single()
    const fullTranscript = row?.transcript ?? transcript

    // DB 업데이트 (녹취록만 저장, AI 처리는 사용자가 편집 후 수동 실행)
    await supabase.from('meetings').update({
      ended_at:   new Date().toISOString(),
      transcript: fullTranscript,
    }).eq('id', sessionIdRef.current)

    // 편집 가능한 상태로 transcript 세팅
    setTranscript(fullTranscript)
    setChunkStatus('')
    setState('done')
  }, [projectId, transcript, flushChunk])

  /** 편집된 녹취록으로 회의록 생성 (사용자가 편집 후 호출) */
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

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      if (chunkTimerRef.current)   clearInterval(chunkTimerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return {
    state, session, transcript, setTranscript, summary, minutes,
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
