import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Mic, MicOff, Square, Play, Pause,
  Clock, FileText, ChevronRight,
  Loader2, CheckCircle2, AlertCircle, Download,
} from 'lucide-react'
import { useMeeting, useMeetings } from '../hooks/useMeeting'
import { supabase } from '../lib/supabase'

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return ''
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const m  = Math.floor(ms / 60000)
  const s  = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

/** 마크다운 문자열을 HTML로 렌더링하는 컴포넌트 */
function MinutesRenderer({ content }: { content: string }) {
  const [html, setHtml] = useState('')
  useEffect(() => {
    import('marked').then(({ marked }) => {
      setHtml(marked.parse(content) as string)
    })
  }, [content])

  return (
    <>
      <div
        className="minutes-content p-6 text-sm text-content leading-relaxed overflow-auto"
        style={{ maxHeight: 520 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .minutes-content h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 1rem;
          padding-bottom: 0.5rem; border-bottom: 2px solid var(--color-primary); color: var(--color-content); }
        .minutes-content h2 { font-size: 1rem; font-weight: 700; margin: 1.25rem 0 0.5rem;
          color: var(--color-primary); }
        .minutes-content h3 { font-size: 0.9rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
        .minutes-content p  { margin-bottom: 0.5rem; color: var(--color-content-muted); }
        .minutes-content ul, .minutes-content ol { padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .minutes-content li { margin-bottom: 0.25rem; color: var(--color-content-muted); }
        .minutes-content table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; font-size: 0.8125rem; }
        .minutes-content th { background: var(--color-canvas); font-weight: 600;
          padding: 0.4rem 0.75rem; border: 1px solid var(--color-line); color: var(--color-content); }
        .minutes-content td { padding: 0.4rem 0.75rem; border: 1px solid var(--color-line);
          color: var(--color-content-muted); }
        .minutes-content strong { color: var(--color-content); font-weight: 600; }
        .minutes-content hr { border: none; border-top: 1px solid var(--color-line); margin: 1rem 0; }
      `}</style>
    </>
  )
}

export default function MeetingRoom() {
  const { id: projectId } = useParams<{ id: string }>()

  const [projectName, setProjectName] = useState('')
  const [title, setTitle]             = useState('')
  const [attendees, setAttendees]     = useState('')
  const [showPast, setShowPast]       = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null)

  const {
    state, liveTranscript, transcript, interimText,
    summary, minutes,
    elapsed, elapsedFormatted, error, processingStep,
    startMeeting, togglePause, endMeeting, generateMinutes,
  } = useMeeting(projectId!)

  const [editableTranscript, setEditableTranscript] = useState('')

  // Whisper 결과가 오면 편집창에 세팅
  useEffect(() => {
    if (state === 'done' && transcript && !minutes) {
      setEditableTranscript(transcript)
    }
  }, [state, transcript, minutes])

  const { meetings, loading: meetingsLoading, deleteMeeting } = useMeetings(projectId!)
  const liveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectId) return
    supabase.from('projects').select('name').eq('id', projectId).single()
      .then(({ data }) => { if (data) setProjectName(data.name) })
  }, [projectId])

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight
    }
  }, [liveTranscript])

  function downloadMinutes() {
    if (!minutes) return
    const blob = new Blob([minutes], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `회의록_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isActive = state === 'recording' || state === 'paused'
  const isDone   = state === 'done'
  const pastDetail = meetings.find(m => m.id === selectedMeeting)

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-canvas">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-xs text-content-muted px-6 py-3 border-b border-line bg-surface shrink-0">
        <Link to="/projects" className="hover:text-content">프로젝트</Link>
        <ChevronRight size={12} />
        <Link to={`/projects/${projectId}`} className="hover:text-content">{projectName}</Link>
        <ChevronRight size={12} />
        <span className="text-content font-medium">회의</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-content">회의</h1>
              <p className="text-sm text-content-muted mt-0.5">
                음성을 녹음하고 AI가 정확한 회의록을 자동으로 작성합니다
              </p>
            </div>
            <button
              onClick={() => setShowPast(!showPast)}
              className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
                showPast
                  ? 'bg-primary-soft text-primary border-primary/30'
                  : 'border-line text-content-muted hover:text-content'
              }`}
            >
              <FileText size={14} className="inline mr-1.5" />
              지난 회의 ({meetings.length})
            </button>
          </div>

          {/* 지난 회의 목록 */}
          {showPast && (
            <div className="border border-line rounded-2xl bg-surface overflow-hidden">
              {meetingsLoading ? (
                <div className="flex items-center justify-center py-8 text-content-muted">
                  <Loader2 size={18} className="animate-spin mr-2" /> 불러오는 중...
                </div>
              ) : meetings.length === 0 ? (
                <p className="text-center py-8 text-content-muted text-sm">아직 회의 기록이 없습니다</p>
              ) : (
                <div className="divide-y divide-line">
                  {meetings.map(m => (
                    <div key={m.id}
                      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-surface-hover cursor-pointer transition-colors ${
                        selectedMeeting === m.id ? 'bg-primary-soft/30' : ''
                      }`}
                      onClick={() => setSelectedMeeting(selectedMeeting === m.id ? null : m.id)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        m.endedAt ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                      }`}>
                        <Mic size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-content truncate">{m.title}</p>
                        <p className="text-xs text-content-muted">
                          {formatDate(m.startedAt)}
                          {m.endedAt && ` · ${formatDuration(m.startedAt, m.endedAt)}`}
                          {m.attendees && ` · ${m.attendees}`}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteMeeting(m.id) }}
                        className="text-xs text-content-subtle hover:text-danger px-2 py-1 rounded"
                      >삭제</button>
                    </div>
                  ))}
                </div>
              )}

              {pastDetail && (
                <div className="border-t border-line bg-canvas">
                  {pastDetail.summary && (
                    <div className="p-5 border-b border-line">
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">핵심 요약</p>
                      <div className="bg-surface rounded-xl border border-line p-4 text-sm text-content leading-relaxed whitespace-pre-wrap">
                        {pastDetail.summary}
                      </div>
                    </div>
                  )}
                  {pastDetail.transcript && (
                    <div className="p-5">
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">녹취록</p>
                      <div className="bg-surface rounded-xl border border-line p-4 text-sm text-content-muted leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {pastDetail.transcript}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 0: 새 회의 시작 폼 ── */}
          {state === 'idle' && (
            <div className="border border-line rounded-2xl bg-surface p-6 space-y-5">
              <h2 className="text-base font-semibold text-content">새 회의 시작</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-content mb-1.5">회의 제목</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="예: 주간 진척 회의"
                    className="w-full px-3 py-2 border border-line rounded-xl text-sm bg-canvas
                               focus:outline-none focus:ring-2 focus:ring-primary/30 text-content placeholder:text-content-subtle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1.5">참석자</label>
                  <input
                    type="text"
                    value={attendees}
                    onChange={e => setAttendees(e.target.value)}
                    placeholder="예: 홍길동, 김영희, 이철수"
                    className="w-full px-3 py-2 border border-line rounded-xl text-sm bg-canvas
                               focus:outline-none focus:ring-2 focus:ring-primary/30 text-content placeholder:text-content-subtle"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger-soft px-4 py-3 rounded-xl border border-danger/20">
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}

              <div className="bg-primary-soft/40 rounded-xl p-4 text-xs text-primary/80 space-y-1.5 border border-primary/10">
                <p className="font-semibold text-primary text-sm">동작 방식</p>
                <p>· 회의 중 실시간으로 음성이 텍스트로 변환됩니다 (Web Speech API 프리뷰)</p>
                <p>· 회의 종료 시 전체 녹음을 Whisper AI로 정밀 분석합니다</p>
                <p>· 참석자 이름이 녹취록에 나오면 발언자를 자동으로 구분합니다</p>
                <p>· 결정사항·액션아이템·다음단계를 자동 추출한 회의록을 생성합니다</p>
              </div>

              <button
                onClick={() => startMeeting(title, attendees)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white
                           rounded-xl font-medium hover:bg-primary-hover transition-colors text-sm"
              >
                <Mic size={16} />
                회의 시작
              </button>
            </div>
          )}

          {/* ── STEP 1: 회의 진행 중 ── */}
          {isActive && (
            <div className="space-y-4">
              {/* 컨트롤 바 */}
              <div className="border border-line rounded-2xl bg-surface p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      state === 'recording' ? 'bg-danger' : 'bg-surface-hover'
                    }`}>
                      {state === 'recording'
                        ? <Mic size={18} className="text-white animate-pulse" />
                        : <MicOff size={18} className="text-content-muted" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-content">
                        {state === 'recording' ? '녹음 중' : '일시 정지'}
                      </p>
                      <div className="flex items-center gap-1.5 text-sm text-content-muted">
                        <Clock size={13} />
                        <span className="font-mono tabular-nums">{elapsedFormatted}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePause}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line
                                 text-sm text-content-muted hover:text-content hover:bg-surface-hover transition-colors"
                    >
                      {state === 'recording'
                        ? <><Pause size={14} /> 일시정지</>
                        : <><Play size={14} /> 재개</>}
                    </button>
                    <button
                      onClick={endMeeting}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-danger text-white
                                 text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      <Square size={14} />
                      회의 종료
                    </button>
                  </div>
                </div>
              </div>

              {/* 실시간 음성 → 텍스트 (Web Speech 프리뷰) */}
              <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-line">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">실시간 변환</span>
                    <span className="text-[10px] text-content-subtle bg-surface-hover px-2 py-0.5 rounded-full">
                      종료 후 Whisper AI로 정밀 변환
                    </span>
                  </div>
                  {state === 'recording' && (
                    <span className="flex items-center gap-1.5 text-xs text-danger">
                      <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <div
                  ref={liveRef}
                  className="p-5 min-h-40 max-h-64 overflow-y-auto text-sm text-content leading-relaxed whitespace-pre-wrap"
                >
                  {liveTranscript && <span>{liveTranscript}</span>}
                  {interimText && (
                    <span className="text-content-subtle italic"> {interimText}</span>
                  )}
                  {!liveTranscript && !interimText && (
                    <span className="text-content-subtle italic">
                      {state === 'recording' ? '말씀하시면 바로 변환됩니다...' : '일시 정지됨'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: AI 처리 중 ── */}
          {state === 'processing' && (
            <div className="border border-line rounded-2xl bg-surface p-10 text-center space-y-5">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Mic size={20} className="text-primary" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-content text-base">
                  {processingStep.includes('회의록') ? '회의록 작성 중...' : 'AI 음성 분석 중...'}
                </p>
                <p className="text-sm text-content-muted mt-1">
                  {processingStep || 'Whisper AI가 음성을 정밀 분석하고 있습니다'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i}
                    className="w-1 bg-primary rounded-full animate-bounce"
                    style={{ height: `${8 + (i % 3) * 6}px`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: 녹취록 편집 (Whisper 결과) ── */}
          {isDone && !minutes && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 px-5 py-4 bg-primary-soft/40 border border-primary/15 rounded-2xl">
                <CheckCircle2 size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-primary">음성 변환이 완료됐습니다</p>
                  <p className="text-sm text-primary/70 mt-0.5">
                    아래 녹취록을 확인하고 필요하면 수정한 뒤 회의록을 생성하세요.
                    오탈자나 불필요한 내용을 정리하면 더 정확한 회의록이 만들어집니다.
                  </p>
                </div>
              </div>

              <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-line">
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">
                    녹취록 <span className="normal-case font-normal text-content-subtle ml-1">· 직접 수정 가능</span>
                  </span>
                  <span className="text-xs text-content-subtle">{editableTranscript.length}자</span>
                </div>
                <textarea
                  value={editableTranscript}
                  onChange={e => setEditableTranscript(e.target.value)}
                  className="w-full p-5 text-sm text-content leading-relaxed bg-canvas resize-none focus:outline-none"
                  style={{ minHeight: 240 }}
                  placeholder="녹취된 내용이 없습니다"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger-soft px-4 py-3 rounded-xl border border-danger/20">
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}

              <button
                onClick={() => generateMinutes(editableTranscript)}
                disabled={!editableTranscript.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white
                           rounded-xl font-medium hover:bg-primary-hover disabled:opacity-40 transition-colors"
              >
                <FileText size={16} />
                회의록 생성
              </button>
            </div>
          )}

          {/* ── STEP 4: 최종 회의록 ── */}
          {isDone && minutes && (
            <div className="space-y-4">
              {/* 완료 배너 */}
              <div className="flex items-center gap-3 px-5 py-4 bg-success-soft border border-success/20 rounded-2xl">
                <CheckCircle2 size={20} className="text-success shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-success">회의록이 생성되었습니다</p>
                  <p className="text-sm text-success/70 mt-0.5">산출물 "AI 요약" 폴더에 자동 저장되었습니다</p>
                </div>
                <button
                  onClick={downloadMinutes}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-success text-white rounded-lg
                             text-xs font-medium hover:bg-green-700 transition-colors shrink-0"
                >
                  <Download size={13} /> 다운로드
                </button>
              </div>

              {/* 핵심 요약 */}
              {summary && (
                <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                  <div className="px-5 py-3 border-b border-line flex items-center gap-2">
                    <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">핵심 요약</span>
                  </div>
                  <div className="p-5 text-sm text-content leading-relaxed whitespace-pre-wrap">{summary}</div>
                </div>
              )}

              {/* 회의록 (마크다운 렌더링) */}
              <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-line">
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">회의록</span>
                  <button
                    onClick={downloadMinutes}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Download size={12} /> 다운로드
                  </button>
                </div>
                <MinutesRenderer content={minutes} />
              </div>

              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 border border-line rounded-xl text-sm text-content-muted
                           hover:text-content hover:bg-surface-hover transition-colors"
              >
                새 회의 시작
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
