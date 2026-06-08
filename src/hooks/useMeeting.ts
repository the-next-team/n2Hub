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

// 브라우저에서 지원하는 MIME 타입 찾기
function getBestMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

// 새 MediaRecorder 인스턴스 생성
function createRecorder(stream: MediaStream, mimeType: string): MediaRecorder {
  try {
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  } catch {
    return new MediaRecorder(stream)
  }
}

export function useMeeting(projectId: string) {
  const [state, setState]             = useState<MeetingState>('idle')
  const [session, setSession]         = useState<MeetingSession | null>(null)
  const [transcript, setTranscript]   = useState<string>('')
  const [summary, setSummary]         = useState<string>('')
  const [minutes, setMinutes]         = useState<string>('')
  const [elapsed, setElapsed]         = useState(0)
  const [error, setError]             = useState<string>('')
  const [chunkStatus, setChunkStatus] = useState<string>('')

  const chunksRef       = useRef<Blob[]>([])
  const headerChunkRef  = useRef<Blob | null>(null)  // WebM 헤더 청크 보존
  const mimeTypeRef     = useRef<string>('')
  const recorderRef     = useRef<MediaRecorder | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef    = useRef<string | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const isActiveRef     = useRef(false)

  function formatElapsed(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 현재 청크 → 헤더 보존 방식으로 완전한 파일 생성 후 Whisper 전송
  const sendChunks = useCallback(async () => {
    if (!chunksRef.current.length) return
    const mime = mimeTypeRef.current || 'audio/webm'

    // 헤더 청크를 앞에 붙여서 완전한 파일 생성
    const parts = headerChunkRef.current
      ? [headerChunkRef.current, ...chunksRef.current]
      : [...chunksRef.current]

    chunksRef.current = []  // 누적 청크 초기화 (헤더는 유지)

    const blob = new Blob(parts, { type: mime })
    if (blob.size < 500) return

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
      setError(`STT 오류: ${(err as Error).message}`)
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

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
    } catch {
      setError('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.')
      return
    }

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

    const mime = getBestMimeType()
    mimeTypeRef.current = mime
    headerChunkRef.current = null
    isActiveRef.current = true

    const recorder = createRecorder(stream, mime)
    recorderRef.current = recorder

    recorder.onerror = (e: any) => {
      setError(`녹음 오류: ${e.error?.message ?? '알 수 없는 오류'}`)
    }

    let isFirstChunk = true
    recorder.ondataavailable = (e) => {
      if (!e.data?.size) return
      if (isFirstChunk) {
        // 첫 청크 = WebM 헤더 포함 → 별도 보존
        headerChunkRef.current = e.data
        isFirstChunk = false
      } else {
        chunksRef.current.push(e.data)
      }
    }

    // 1초마다 데이터 수집
    recorder.start(1000)
    setState('recording')

    elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    // 30초마다 Whisper 전송 (recorder 재시작 없이)
    chunkTimerRef.current = setInterval(sendChunks, CHUNK_MS)
  }, [projectId, sendChunks])

  // 일시 정지 / 재개
  const togglePause = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (state === 'recording') {
      if (recorder.state === 'recording') recorder.pause()
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      setState('paused')
    } else if (state === 'paused') {
      if (recorder.state === 'paused') recorder.resume()
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
    if (chunkTimerRef.current)   clearInterval(chunkTimerRef.current)

    const recorder = recorderRef.current
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      await new Promise<void>(resolve => {
        recorder.onstop = () => resolve()
        recorder.stop()
      })
      await sendChunks()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())

    // DB에서 최신 transcript 조회
    const { data: row } = await supabase
      .from('meetings').select('transcript').eq('id', sessionIdRef.current).single()
    const fullTranscript = row?.transcript ?? transcript

    await supabase.from('meetings').update({
      ended_at:   new Date().toISOString(),
      transcript: fullTranscript,
    }).eq('id', sessionIdRef.current)

    setTranscript(fullTranscript)
    setChunkStatus('')
    setState('done')
  }, [transcript, sendChunks])

  /** 편집된 녹취록으로 회의록 생성 */
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
