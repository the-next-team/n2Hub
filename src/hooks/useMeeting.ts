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
  const mimeTypeRef     = useRef<string>('')
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cycleTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef    = useRef<string | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const isActiveRef     = useRef(false)   // 녹음 진행 중 여부

  function formatElapsed(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 현재 청크 블롭 → Whisper 전송
  const sendChunks = useCallback(async () => {
    if (!chunksRef.current.length) return
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' })
    chunksRef.current = []

    if (blob.size < 500) return   // 너무 작으면 무음으로 간주

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

  // ── recorder 1회 사이클: start → 30초 → stop → flush → 새 recorder 시작 ──
  // 각 사이클마다 새 recorder를 만들어 WebM 헤더가 항상 포함된 완전한 파일 생성
  const startCycle = useCallback(() => {
    const stream = streamRef.current
    if (!stream || !isActiveRef.current) return

    const mime     = mimeTypeRef.current
    const recorder = createRecorder(stream, mime)

    recorder.onerror = (e: any) => {
      setError(`녹음 오류: ${e.error?.message ?? '알 수 없는 오류'}`)
    }
    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }

    // 30초 후 자동 정지 → flush → 다음 사이클
    recorder.onstop = async () => {
      await sendChunks()
      if (isActiveRef.current) startCycle()  // 재귀적으로 다음 사이클 시작
    }

    // 1초마다 ondataavailable (헤더 포함한 작은 청크 수집)
    recorder.start(1000)

    // 30초 후 stop (onstop이 flush + 재시작 담당)
    const timer = setTimeout(() => {
      if (recorder.state === 'recording' || recorder.state === 'paused') {
        recorder.stop()
      }
    }, CHUNK_MS)

    // 외부에서 참조할 수 있게 저장
    ;(recorder as any)._cycleTimer = timer
    ;(window as any).__currentRecorder = recorder
  }, [sendChunks])

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

    mimeTypeRef.current = getBestMimeType()
    isActiveRef.current = true
    setState('recording')

    // 경과 타이머
    elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)

    // 첫 사이클 시작
    startCycle()
  }, [projectId, startCycle])

  // 일시 정지 / 재개
  const togglePause = useCallback(() => {
    const recorder = (window as any).__currentRecorder as MediaRecorder | undefined
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
    if (cycleTimerRef.current)   clearInterval(cycleTimerRef.current)

    // 현재 진행 중인 recorder 강제 종료
    const recorder = (window as any).__currentRecorder as MediaRecorder | undefined
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      clearTimeout((recorder as any)._cycleTimer)
      await new Promise<void>(resolve => {
        recorder.onstop = () => resolve()
        recorder.stop()
      })
      await sendChunks()
    }

    streamRef.current?.getTracks().forEach(t => t.stop())
    ;(window as any).__currentRecorder = null

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
      if (cycleTimerRef.current)   clearInterval(cycleTimerRef.current)
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
