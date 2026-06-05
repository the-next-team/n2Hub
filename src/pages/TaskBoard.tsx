import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronRight, ClipboardList, AlertCircle, CheckCircle2,
  Clock, Loader2, Upload, X, User, ChevronDown, ChevronUp,
  FileSpreadsheet, RefreshCw, Crown, Lock, BarChart2, MessageSquare,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTasks } from '../hooks/useTasks'
import { useProject } from '../hooks/useProject'
import { useMembers } from '../hooks/useMembers'
import { parseWbsBuffer } from '../utils/wbsParser'
import type { Task } from '../hooks/useTasks'
import type { ProjectMember } from '../hooks/useMembers'
import { Button, PageHeader } from '../components/ui'
import CommentThread from '../components/CommentThread'
import { useCommentCounts } from '../hooks/useComments'

// ---------- 상수 ----------
const STATUS_LABEL: Record<Task['status'], string> = {
  not_started: '예정',
  in_progress: '진행중',
  completed:   '완료',
  delayed:     '지연',
}
const STATUS_COLOR: Record<Task['status'], string> = {
  not_started: 'bg-surface-hover text-content-muted',
  in_progress: 'bg-primary-soft text-primary',
  completed:   'bg-success-soft text-success',
  delayed:     'bg-danger-soft text-danger',
}
const STATUS_ICON: Record<Task['status'], React.ReactNode> = {
  not_started: <Clock size={12} />,
  in_progress: <RefreshCw size={12} />,
  completed:   <CheckCircle2 size={12} />,
  delayed:     <AlertCircle size={12} />,
}

// ---------- 헬퍼 ----------
function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
}
function pct(v: number): string { return `${Math.round(v * 100)}%` }

// ---------- WBS 파일 타입 ----------
interface WbsFile {
  id: string; name: string; storagePath: string; createdAt: string
}

// ---------- 작업 행 ----------
function TaskRow({
  task, canEdit, isPM, members, linkedFileCount, commentCount, onUpdate, onCommentClick,
}: {
  task: Task
  canEdit: boolean
  isPM: boolean
  members: ProjectMember[]
  linkedFileCount: number
  commentCount: number
  onUpdate: (id: string, changes: Partial<Pick<Task, 'actual_progress' | 'assignee_name' | 'assignee_user_id' | 'status'>>) => void
  onCommentClick: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [progress, setProgress] = useState(Math.round(task.actual_progress * 100))
  const [selectedUserId, setSelectedUserId] = useState(task.assignee_user_id ?? '')
  const [saving, setSaving] = useState(false)

  // task 변경 시 로컬 상태 동기화
  useEffect(() => {
    setProgress(Math.round(task.actual_progress * 100))
    setSelectedUserId(task.assignee_user_id ?? '')
  }, [task.actual_progress, task.assignee_user_id])

  async function handleSave() {
    setSaving(true)
    const actualProgress = progress / 100
    let status: Task['status'] = 'not_started'
    if (actualProgress >= 1) status = 'completed'
    else if (actualProgress > 0) status = 'in_progress'
    else if (task.end_date && task.end_date < new Date().toISOString().split('T')[0] && task.planned_progress > 0) status = 'delayed'

    const assignedMember = members.find(m => m.user_id === selectedUserId)
    await onUpdate(task.id, {
      actual_progress: actualProgress,
      status,
      ...(isPM && {
        assignee_user_id: selectedUserId || null,
        assignee_name: assignedMember?.display_name ?? assignedMember?.email.split('@')[0] ?? null,
      }),
    })
    setSaving(false)
    setEditing(false)
  }

  function handleCancel() {
    setProgress(Math.round(task.actual_progress * 100))
    setSelectedUserId(task.assignee_user_id ?? '')
    setEditing(false)
  }

  const assignedMemberName = task.assignee_name
    ?? members.find(m => m.user_id === task.assignee_user_id)?.display_name
    ?? null

  return (
    <tr className="hover:bg-canvas transition-colors group">
      {/* WBS 코드 */}
      <td className="pl-8 pr-3 py-3 font-mono text-xs text-content-subtle whitespace-nowrap">
        {task.wbs_code}
      </td>

      {/* 작업명 */}
      <td className="px-3 py-3 text-sm font-medium text-content">
        <div className="flex items-center gap-2">
          <span>{task.task_name}</span>
          <button
            onClick={onCommentClick}
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-content-subtle hover:text-primary shrink-0"
          >
            <MessageSquare size={12} />
            {commentCount > 0 && (
              <span className="text-[10px] font-semibold">{commentCount}</span>
            )}
          </button>
        </div>
      </td>

      {/* 기간 */}
      <td className="px-3 py-3 text-xs text-content-muted whitespace-nowrap">
        {fmtDate(task.start_date)} ~ {fmtDate(task.end_date)}
      </td>

      {/* 진행률 */}
      <td className="px-3 py-3">
        {editing && canEdit ? (
          <div className="flex items-center gap-2 min-w-[160px]">
            <input
              type="range" min={0} max={100} value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs font-mono w-9 text-right text-content-muted">{progress}%</span>
          </div>
        ) : (
          <div className="min-w-[120px]">
            <div className="flex justify-between text-xs text-content-subtle mb-1">
              <span>계획 {pct(task.planned_progress)}</span>
              <span className="font-medium text-content-muted">실적 {pct(task.actual_progress)}</span>
            </div>
            <div className="h-2 bg-surface-hover rounded-full overflow-hidden relative">
              <div className="absolute h-full bg-line rounded-full"
                style={{ width: pct(task.planned_progress) }} />
              <div className={`absolute h-full rounded-full ${task.actual_progress >= task.planned_progress ? 'bg-success' : 'bg-blue-500'}`}
                style={{ width: pct(task.actual_progress) }} />
            </div>
          </div>
        )}
      </td>

      {/* 담당자 */}
      <td className="px-3 py-3">
        {editing && isPM ? (
          // PM: 멤버 드롭다운으로 지정
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="w-32 px-2 py-1 text-xs border border-line rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface"
          >
            <option value="">미지정</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name ?? m.email.split('@')[0]}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1 text-xs text-content-muted">
            {assignedMemberName ? (
              <>
                <User size={11} className="text-content-subtle" />
                <span>{assignedMemberName}</span>
              </>
            ) : (
              <span className="text-content-subtle">미지정</span>
            )}
          </div>
        )}
      </td>

      {/* 상태 */}
      <td className="px-3 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[task.status]}`}>
          {STATUS_ICON[task.status]}
          {STATUS_LABEL[task.status]}
        </span>
      </td>

      {/* 연결 산출물 */}
      <td className="px-3 py-3">
        {linkedFileCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-primary font-medium bg-blue-50 px-2 py-0.5 rounded-full">
            <FileSpreadsheet size={10} />
            {linkedFileCount}
          </span>
        ) : (
          <span className="text-xs text-content-subtle">—</span>
        )}
      </td>

      {/* 액션 */}
      <td className="px-3 py-3">
        {canEdit ? (
          editing ? (
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {saving && <Loader2 size={10} className="animate-spin" />}
                저장
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-xs text-content-muted border border-line rounded hover:bg-canvas"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs text-primary border border-primary/30 rounded hover:bg-blue-50"
            >
              수정
            </button>
          )
        ) : (
          // 권한 없음 → 자물쇠 표시
          <Lock size={13} className="text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </td>
    </tr>
  )
}

// ---------- 그룹 행 ----------
function GroupRow({
  level, code, name, tasks, expanded, onToggle,
}: {
  level: 1 | 2; code: string; name: string
  tasks: Task[]; expanded: boolean; onToggle: () => void
}) {
  const total   = tasks.length
  const done    = tasks.filter(t => t.status === 'completed').length
  const delayed = tasks.filter(t => t.status === 'delayed').length
  const avgActual = total > 0 ? tasks.reduce((s, t) => s + t.actual_progress, 0) / total : 0
  const avgPlan   = total > 0 ? tasks.reduce((s, t) => s + t.planned_progress, 0) / total : 0

  return (
    <tr
      className={`cursor-pointer ${level === 1 ? 'bg-blue-50 hover:bg-primary-soft' : 'bg-canvas hover:bg-surface-hover'}`}
      onClick={onToggle}
    >
      <td className={`py-3 font-mono text-xs ${level === 1 ? 'pl-4 text-blue-500' : 'pl-6 text-content-subtle'}`}>{code}</td>
      <td className={`px-3 py-3 font-semibold ${level === 1 ? 'text-blue-800 text-sm' : 'text-content-muted text-sm'}`}>
        {expanded
          ? <ChevronDown size={14} className="inline mr-1" />
          : <ChevronUp size={14} className="inline mr-1" />}
        {name}
      </td>
      <td className="px-3 py-3 text-xs text-content-subtle">하위 {total}개</td>
      <td className="px-3 py-3">
        <div className="min-w-[120px]">
          <div className="flex justify-between text-xs text-content-subtle mb-1">
            <span>계획 {pct(avgPlan)}</span>
            <span className="font-medium text-content-muted">실적 {pct(avgActual)}</span>
          </div>
          <div className="h-1.5 bg-line rounded-full overflow-hidden relative">
            <div className="absolute h-full bg-gray-300 rounded-full" style={{ width: pct(avgPlan) }} />
            <div className={`absolute h-full rounded-full ${avgActual >= avgPlan ? 'bg-success' : 'bg-blue-400'}`}
              style={{ width: pct(avgActual) }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-3" />
      <td className="px-3 py-3 text-xs text-content-muted whitespace-nowrap">
        완료 {done} / 지연 <span className={delayed > 0 ? 'text-danger font-medium' : ''}>{delayed}</span>
      </td>
      <td className="px-3 py-3" />
    </tr>
  )
}

// ---------- WBS 가져오기 모달 ----------
function ImportModal({
  projectId, onImport, onClose,
}: {
  projectId: string
  onImport: (buf: ArrayBuffer) => void
  onClose: () => void
}) {
  const [wbsFiles, setWbsFiles] = useState<WbsFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true)
    try {
      const { data, error } = await supabase
        .from('files')
        .select('id, original_name, storage_path, created_at')
        .eq('project_id', projectId)
        .neq('mime_type', 'folder')
        .or('original_name.ilike.%WBS%.xlsx,original_name.ilike.%WBS%.xls,original_name.ilike.%WBS%.xlsm')
        .order('created_at', { ascending: false })
      if (error) throw error
      setWbsFiles((data ?? []).map(r => ({
        id: r.id, name: r.original_name, storagePath: r.storage_path, createdAt: r.created_at,
      })))
    } catch (err) { setFetchError((err as Error).message) }
    finally { setLoadingFiles(false) }
  }, [projectId])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function handleSelect(file: WbsFile) {
    setDownloading(file.id)
    try {
      const { data, error } = await supabase.storage.from('documents').download(file.storagePath)
      if (error) throw error
      onImport(await data.arrayBuffer())
      onClose()
    } catch (err) {
      setFetchError(`다운로드 실패: ${(err as Error).message}`)
      setDownloading(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-base font-semibold text-content">WBS 파일 선택</h2>
          <button onClick={onClose} className="text-content-subtle hover:text-content-muted"><X size={18} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-content-muted mb-4">
            파일명에 <span className="font-semibold text-content-muted">WBS</span>가 포함된 Excel 파일 목록입니다. Schedule 시트에서 작업을 가져옵니다.
            <br /><span className="text-orange-600 font-medium">주의: 기존 작업 목록이 교체됩니다.</span>
          </p>
          {fetchError && <div className="mb-4 p-3 text-sm text-danger bg-red-50 rounded-lg">{fetchError}</div>}
          {loadingFiles ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-content-subtle" /></div>
          ) : wbsFiles.length === 0 ? (
            <div className="text-center py-8 text-content-subtle text-sm">
              <FileSpreadsheet size={32} className="mx-auto mb-2 text-gray-200" />
              파일명에 'WBS'가 포함된 Excel 파일이 없습니다. 산출물 목록에서 먼저 업로드하세요.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {wbsFiles.map(f => (
                <button key={f.id} onClick={() => handleSelect(f)} disabled={downloading !== null}
                  className="w-full flex items-center gap-3 px-4 py-3 border border-line rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50">
                  {downloading === f.id
                    ? <Loader2 size={18} className="animate-spin text-blue-500 shrink-0" />
                    : <FileSpreadsheet size={18} className="text-green-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-content truncate">{f.name}</div>
                    <div className="text-xs text-content-subtle mt-0.5">{new Date(f.createdAt).toLocaleDateString('ko-KR')}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- 메인 ----------
export default function TaskBoard() {
  const { id: projectId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { project } = useProject(projectId!)
  const { tasks, loading, importing, error, importTasks, updateTask } = useTasks(projectId!)
  const { members, getMyRole } = useMembers(projectId!)

  // 현재 유저 역할
  const [isPM, setIsPM] = useState(false)
  useEffect(() => {
    if (!user || !projectId) return
    // 프로젝트 생성자는 항상 PM
    if (project?.createdBy === user.id) { setIsPM(true); return }
    getMyRole(user.id).then(role => setIsPM(role === 'pm'))
  }, [user, projectId, project?.createdBy, getMyRole])

  const [showImport, setShowImport] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState('전체')
  const [filterStatus, setFilterStatus]     = useState<'전체' | Task['status']>('전체')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // 댓글 패널
  const [commentTask, setCommentTask] = useState<Task | null>(null)

  // 태스크별 연결 산출물 수
  const [fileCounts, setFileCounts] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    if (!projectId) return
    supabase
      .from('files')
      .select('task_id')
      .eq('project_id', projectId)
      .not('task_id', 'is', null)
      .neq('mime_type', 'folder')
      .then(({ data }) => {
        if (!data) return
        const map = new Map<string, number>()
        for (const row of data) {
          const tid = row.task_id as string
          map.set(tid, (map.get(tid) || 0) + 1)
        }
        setFileCounts(map)
      })
  }, [projectId, tasks.length])  // tasks 변경 시 재조회

  // 댓글 수 배지
  const l3Ids = useMemo(() => tasks.filter(t => t.wbs_level === 3).map(t => t.id), [tasks])
  const commentCounts = useCommentCounts(projectId!, 'task', l3Ids)

  // 담당자 목록 (멤버 기반 + 텍스트 기반)
  const assigneeOptions = ['전체', ...Array.from(new Set([
    ...members.map(m => m.display_name ?? m.email.split('@')[0]),
    ...tasks.filter(t => t.assignee_name).map(t => t.assignee_name!),
  ])).sort()]

  // 권한 체크: PM이면 전체, 아니면 본인 assignee_user_id인 작업만 수정 가능
  function canEditTask(task: Task): boolean {
    if (isPM) return true
    return !!user && task.assignee_user_id === user.id
  }

  // 필터
  const filtered = tasks.filter(t => {
    if (filterAssignee !== '전체') {
      const name = t.assignee_name
        ?? members.find(m => m.user_id === t.assignee_user_id)?.display_name
        ?? members.find(m => m.user_id === t.assignee_user_id)?.email.split('@')[0]
      if (name !== filterAssignee) return false
    }
    if (filterStatus !== '전체' && t.status !== filterStatus) return false
    return true
  })

  const l1Groups = filtered.filter(t => t.wbs_level === 1)
  const l2Groups = filtered.filter(t => t.wbs_level === 2)
  const l3Tasks  = filtered.filter(t => t.wbs_level === 3)
  const getL1Code = (l2Code: string) => l2Code.split('.')[0]
  const getL2Code = (l3Code: string) => l3Code.split('.').slice(0, 2).join('.')

  const l3Only = tasks.filter(t => t.wbs_level === 3)
  const avgActual  = l3Only.length > 0
    ? l3Only.reduce((s, t) => s + (t.actual_progress ?? 0), 0) / l3Only.length : 0
  const avgPlanned = l3Only.length > 0
    ? l3Only.reduce((s, t) => s + (t.planned_progress ?? 0), 0) / l3Only.length : 0
  const stats = {
    total:        l3Only.length,
    done:         l3Only.filter(t => t.status === 'completed').length,
    active:       l3Only.filter(t => t.status === 'in_progress').length,
    delayed:      l3Only.filter(t => t.status === 'delayed').length,
    actualPct:    Math.round(avgActual  * 100),
    plannedPct:   Math.round(avgPlanned * 100),
  }

  const toggleCollapse = (code: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(code) ? s.delete(code) : s.add(code); return s })

  async function handleImportBuffer(buf: ArrayBuffer) {
    setImportError(null)
    try {
      const parsed = parseWbsBuffer(buf)
      if (parsed.length === 0) { setImportError('Schedule 시트에서 작업을 찾을 수 없습니다.'); return }
      await importTasks(parsed)
    } catch (err) { setImportError((err as Error).message) }
  }

  return (
    <div className="p-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-content-muted mb-6">
        <Link to="/projects" className="hover:text-content-muted">프로젝트</Link>
        <ChevronRight size={14} />
        <Link to={`/projects/${projectId}`} className="hover:text-content-muted">{project?.name ?? '프로젝트 상세'}</Link>
        <ChevronRight size={14} />
        <span className="text-content">WBS 작업 관리</span>
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content flex items-center gap-2">
            <ClipboardList size={22} className="text-primary" />
            WBS 작업 관리
          </h1>
          <p className="text-content-muted text-sm mt-1 flex items-center gap-2">
            {isPM
              ? <><Crown size={13} className="text-blue-500" /> PM — 전체 수정 권한</>
              : <><Lock size={13} className="text-content-subtle" /> 담당 작업만 수정 가능</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 간트 차트 링크 */}
          <Link
            to={`/projects/${projectId}/gantt`}
            className="flex items-center gap-2 px-3 py-2 border border-line text-content-muted rounded-xl text-sm font-medium hover:border-indigo-300 hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <BarChart2 size={15} />
            간트 차트
          </Link>
          {isPM && (
            <button onClick={() => setShowImport(true)} disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importing ? '가져오는 중...' : 'WBS 가져오기'}
            </button>
          )}
        </div>
      </div>

      {/* 에러 */}
      {(error || importError) && (
        <div className="mb-4 p-3 text-sm text-danger bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle size={15} />{error || importError}
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: '전체 작업', value: stats.total,   color: 'text-content',  bg: 'bg-surface' },
          { label: '완료',      value: stats.done,    color: 'text-success', bg: 'bg-green-50' },
          { label: '진행중',    value: stats.active,  color: 'text-primary',  bg: 'bg-blue-50' },
          { label: '지연',      value: stats.delayed, color: 'text-danger',   bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-line p-4 text-center`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-content-muted mt-1">{s.label}</div>
          </div>
        ))}

        {/* 전체 진척률 */}
        <div className="bg-surface rounded-xl border border-line p-4">
          <div className="flex items-end justify-between mb-2">
            <span className="text-sm text-content-muted">전체 진척률</span>
            <span className={`text-xl font-bold ${stats.actualPct >= stats.plannedPct ? 'text-success' : 'text-orange-500'}`}>
              {stats.actualPct}%
            </span>
          </div>
          {/* 계획 대비 실제 바 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-subtle w-7 shrink-0">계획</span>
              <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-gray-300 rounded-full transition-all" style={{ width: `${stats.plannedPct}%` }} />
              </div>
              <span className="text-[10px] text-content-subtle w-6 text-right shrink-0">{stats.plannedPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-subtle w-7 shrink-0">실제</span>
              <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${stats.actualPct >= stats.plannedPct ? 'bg-success' : 'bg-orange-400'}`}
                     style={{ width: `${stats.actualPct}%` }} />
              </div>
              <span className={`text-[10px] w-6 text-right shrink-0 font-medium ${stats.actualPct >= stats.plannedPct ? 'text-success' : 'text-orange-500'}`}>
                {stats.actualPct}%
              </span>
            </div>
          </div>
          {stats.actualPct < stats.plannedPct && (
            <div className="mt-1.5 text-[10px] text-orange-500 text-right font-medium">
              -{stats.plannedPct - stats.actualPct}% 미달
            </div>
          )}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <User size={14} className="text-content-subtle" />
          <span className="text-content-muted text-xs font-medium">담당자</span>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            className="ml-1 px-2 py-1 border border-line rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface">
            {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-content-muted text-xs font-medium">상태</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-2 py-1 border border-line rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface">
            <option value="전체">전체</option>
            <option value="not_started">예정</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
            <option value="delayed">지연</option>
          </select>
        </div>
        {(filterAssignee !== '전체' || filterStatus !== '전체') && (
          <button onClick={() => { setFilterAssignee('전체'); setFilterStatus('전체') }}
            className="text-xs text-primary hover:underline">필터 초기화</button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-content-subtle" /></div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-content-subtle">
            <ClipboardList size={48} className="text-gray-200" />
            <p className="font-medium text-content-muted">작업이 없습니다</p>
            {isPM ? (
              <>
                <p className="text-sm text-center">
                  "WBS 가져오기" 버튼을 눌러<br />업로드된 Excel WBS 파일에서 작업을 가져오세요.
                </p>
                <button onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                  <Upload size={15} /> WBS 가져오기
                </button>
              </>
            ) : (
              <p className="text-sm text-center">PM이 WBS를 아직 등록하지 않았습니다.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="text-left pl-4 pr-3 py-3 text-xs font-medium text-content-muted w-24">WBS</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted">작업명</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-32">기간</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-44">진행률</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-28">
                  {isPM ? '담당자 지정' : '담당자'}
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-24 whitespace-nowrap">상태</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-20 whitespace-nowrap">산출물</th>
                <th className="px-3 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {l1Groups.map(l1 => {
                const l1Expanded = !collapsed.has(l1.wbs_code)
                const l1L2 = l2Groups.filter(g => getL1Code(g.wbs_code) === l1.wbs_code)
                const l1L3 = l3Tasks.filter(t => t.wbs_code.startsWith(`${l1.wbs_code}.`))
                return (
                  <React.Fragment key={l1.wbs_code}>
                    <GroupRow level={1} code={l1.wbs_code} name={l1.task_name}
                      tasks={l1L3} expanded={l1Expanded} onToggle={() => toggleCollapse(l1.wbs_code)} />
                    {l1Expanded && l1L2.map(l2 => {
                      const l2Expanded = !collapsed.has(l2.wbs_code)
                      const l2L3 = l3Tasks.filter(t => getL2Code(t.wbs_code) === l2.wbs_code)
                      return (
                        <React.Fragment key={l2.wbs_code}>
                          <GroupRow level={2} code={l2.wbs_code} name={l2.task_name}
                            tasks={l2L3} expanded={l2Expanded} onToggle={() => toggleCollapse(l2.wbs_code)} />
                          {l2Expanded && l2L3.map(task => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              canEdit={canEditTask(task)}
                              isPM={isPM}
                              members={members}
                              linkedFileCount={fileCounts.get(task.id) ?? 0}
                              commentCount={commentCounts.get(task.id) ?? 0}
                              onUpdate={updateTask}
                              onCommentClick={() => setCommentTask(task)}
                            />
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {tasks.length > 0 && (
        <p className="mt-3 text-xs text-content-subtle text-right">
          {filtered.length < tasks.length ? `${filtered.length} / ${tasks.length}개 표시` : `전체 ${tasks.length}개`}
        </p>
      )}

      {showImport && (
        <ImportModal projectId={projectId!} onImport={handleImportBuffer} onClose={() => setShowImport(false)} />
      )}

      {/* ── 댓글 모달 ── */}
      {commentTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setCommentTask(null)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl border border-line w-[420px] max-h-[580px] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
              <MessageSquare size={14} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-content truncate">{commentTask.task_name}</p>
                <p className="text-[10px] text-content-muted font-mono">{commentTask.wbs_code}</p>
              </div>
              <button
                onClick={() => setCommentTask(null)}
                className="p-1 rounded-lg text-content-muted hover:bg-surface-hover hover:text-content transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            {/* 댓글 스레드 */}
            <CommentThread
              projectId={projectId!}
              targetType="task"
              targetId={commentTask.id}
              maxHeight={500}
            />
          </div>
        </div>
      )}
    </div>
  )
}
