import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Mic, MicOff, Square, Play, Pause,
  Clock, FileText, ChevronRight, Users,
  Loader2, CheckCircle2, AlertCircle, Download
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

export default function MeetingRoom() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [projectName, setProjectName] = useState('')
  const [title, setTitle]             = useState('')
  const [attendees, setAttendees]     = useState('')
  const [showPast, setShowPast]       = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null)

  const {
    state, transcript, summary, minutes,
    elapsed, elapsedFormatted, error, chunkStatus,
    startMeeting, togglePause, endMeeting, generateMinutes,
    setTranscript,
  } = useMeeting(projectId!)

  // 편집 가능한 녹취록 (회의 종료 후 수정용)
  const [editableTranscript, setEditableTranscript] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // 회의 종료 시 편집 모드로
  useEffect(() => {
    if (state === 'done' && transcript && !minutes) {
      setEditableTranscript(transcript)
      setIsEditing(true)
    }
  }, [state, transcript, minutes])

  const { meetings, loading: meetingsLoading, deleteMeeting } = useMeetings(projectId!)

  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectId) return
    supabase.from('projects').select('name').eq('id', projectId).single()
      .then(({ data }) => { if (data) setProjectName(data.name) })
  }, [projectId])

  // 트랜스크립트 자동 스크롤
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  function downloadMinutes() {
    if (!minutes) return
    const blob = new Blob([minutes], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `회의록_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isActive = state === 'recording' || state === 'paused'
  const isDone   = state === 'done'

  // ── 과거 회의 상세 ──
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
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

          {/* ── 헤더 ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-content">회의</h1>
              <p className="text-sm text-content-muted mt-0.5">
                AI가 회의 내용을 실시간 변환하고 회의록을 자동 작성합니다
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

          {/* ── 지난 회의 목록 ── */}
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

              {/* 선택한 지난 회의 상세 */}
              {pastDetail && (
                <div className="border-t border-line p-5 space-y-4 bg-canvas">
                  {pastDetail.summary && (
                    <div>
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">핵심 요약</p>
                      <div className="bg-surface rounded-xl border border-line p-4 text-sm text-content leading-relaxed whitespace-pre-wrap">
                        {pastDetail.summary}
                      </div>
                    </div>
                  )}
                  {pastDetail.transcript && (
                    <div>
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">전체 녹취록</p>
                      <div className="bg-surface rounded-xl border border-line p-4 text-sm text-content-muted leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {pastDetail.transcript}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 새 회의 시작 폼 ── */}
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
                    placeholder="예: 홍길동, 김영희"
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

              <div className="bg-surface-hover rounded-xl p-4 text-xs text-content-muted space-y-1.5">
                <p className="font-medium text-content text-sm">시작 전 확인사항</p>
                <p>· 마이크가 연결되어 있고 브라우저 권한이 허용되어 있어야 합니다</p>
                <p>· 30초마다 음성을 텍스트로 변환합니다 (Groq Whisper)</p>
                <p>· 회의 종료 시 AI가 요약 및 회의록을 자동 작성합니다</p>
                <p>· 회의록은 프로젝트 산출물 "AI 요약" 폴더에 자동 저장됩니다</p>
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

          {/* ── 회의 진행 중 ── */}
          {isActive && (
            <div className="space-y-4">
              {/* 상태 바 */}
              <div className="border border-line rounded-2xl bg-surface p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* 녹음 중 표시 */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      state === 'recording' ? 'bg-danger' : 'bg-surface-hover'
                    }`}>
                      {state === 'recording'
                        ? <Mic size={18} className="text-white animate-pulse" />
                        : <MicOff size={18} className="text-content-muted" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-content text-base">
                        {state === 'recording' ? '녹음 중' : '일시 정지'}
                      </p>
                      <div className="flex items-center gap-1.5 text-sm text-content-muted">
                        <Clock size={13} />
                        <span className="font-mono">{elapsedFormatted}</span>
                        {chunkStatus && (
                          <span className="flex items-center gap-1 text-primary ml-2">
                            <Loader2 size={12} className="animate-spin" />
                            {chunkStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePause}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line
                                 text-sm text-content-muted hover:text-content hover:bg-surface-hover transition-colors"
                    >
                      {state === 'recording' ? <><Pause size={14} /> 일시정지</> : <><Play size={14} /> 재개</>}
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

              {/* 실시간 트랜스크립트 */}
              <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-line">
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">실시간 녹취</span>
                  {state === 'recording' && (
                    <span className="flex items-center gap-1.5 text-xs text-danger">
                      <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <div
                  ref={transcriptRef}
                  className="p-5 min-h-48 max-h-72 overflow-y-auto text-sm text-content leading-relaxed whitespace-pre-wrap"
                >
                  {transcript || (
                    <span className="text-content-subtle italic">
                      {state === 'recording'
                        ? '말씀하시면 여기에 텍스트로 변환됩니다... (30초마다 업데이트)'
                        : '일시 정지됨'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── 처리 중 ── */}
          {state === 'processing' && (
            <div className="border border-line rounded-2xl bg-surface p-8 text-center space-y-4">
              <Loader2 size={36} className="animate-spin text-primary mx-auto" />
              <div>
                <p className="font-semibold text-content">회의록 작성 중...</p>
                <p className="text-sm text-content-muted mt-1">{chunkStatus || 'AI가 내용을 분석하고 있습니다'}</p>
              </div>
            </div>
          )}

          {/* ── 완료 ── */}
          {isDone && !minutes && (
            /* ── STEP 1: 녹취록 편집 ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-warning-soft border border-warning/20 rounded-2xl">
                <FileText size={20} className="text-warning shrink-0" />
                <div>
                  <p className="font-semibold text-warning">녹취가 완료됐습니다</p>
                  <p className="text-sm text-warning/80 mt-0.5">
                    아래 녹취록에서 불필요한 내용(배경음, 잡음 등)을 삭제한 뒤 회의록을 생성하세요
                  </p>
                </div>
              </div>

              <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-line">
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">
                    녹취록 편집 <span className="text-warning ml-1">· 불필요한 내용을 직접 삭제하세요</span>
                  </span>
                  <span className="text-xs text-content-subtle">{editableTranscript.length}자</span>
                </div>
                <textarea
                  value={editableTranscript}
                  onChange={e => setEditableTranscript(e.target.value)}
                  className="w-full p-5 text-sm text-content leading-relaxed bg-canvas resize-none focus:outline-none"
                  style={{ minHeight: 280 }}
                  placeholder="녹취된 내용이 없습니다"
                />
              </div>

              <button
                onClick={() => generateMinutes(editableTranscript)}
                disabled={!editableTranscript.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white
                           rounded-xl font-medium hover:bg-primary-hover disabled:opacity-40 transition-colors text-sm"
              >
                <FileText size={16} />
                회의록 생성
              </button>
            </div>
          )}

          {isDone && minutes && (
            /* ── STEP 2: 완료 결과 ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-success-soft border border-success/20 rounded-2xl">
                <CheckCircle2 size={20} className="text-success shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-success">회의록이 생성되었습니다</p>
                  <p className="text-sm text-success/70 mt-0.5">산출물 "AI 요약" 폴더에 자동 저장되었습니다</p>
                </div>
                <button onClick={downloadMinutes}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-success text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                  <Download size={13} /> 다운로드
                </button>
              </div>

              {summary && (
                <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                  <div className="px-5 py-3 border-b border-line">
                    <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">AI 핵심 요약</span>
                  </div>
                  <div className="p-5 text-sm text-content leading-relaxed whitespace-pre-wrap">{summary}</div>
                </div>
              )}

              <div className="border border-line rounded-2xl bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-line">
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">회의록</span>
                  <button onClick={downloadMinutes} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Download size={12} /> 다운로드
                  </button>
                </div>
                <div className="p-5 text-sm text-content leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                  {minutes}
                </div>
              </div>

              <button onClick={() => window.location.reload()}
                className="w-full py-3 border border-line rounded-xl text-sm text-content-muted hover:text-content hover:bg-surface-hover transition-colors">
                새 회의 시작
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
