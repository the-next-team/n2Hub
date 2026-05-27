import React, { useState, useCallback, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronRight, ClipboardList, AlertCircle, CheckCircle2,
  Clock, Loader2, Upload, X, User, ChevronDown, ChevronUp,
  FileSpreadsheet, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTasks } from '../hooks/useTasks'
import { useProject } from '../hooks/useProject'
import { parseWbsBuffer } from '../utils/wbsParser'
import type { Task } from '../hooks/useTasks'
import { Button, PageHeader } from '../components/ui'

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
  const d = new Date(s)
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
}
function pct(v: number): string { return `${Math.round(v * 100)}%` }

// ---------- 파일 정보 ----------
interface WbsFile {
  id: string
  name: string
  storagePath: string
  createdAt: string
}

// ---------- 작업 행 ----------
function TaskRow({
  task, onUpdate,
}: {
  task: Task
  onUpdate: (id: string, changes: { actual_progress?: number; assignee_name?: string | null; status?: Task['status'] }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [progress, setProgress] = useState(Math.round(task.actual_progress * 100))
  const [assignee, setAssignee] = useState(task.assignee_name ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const actualProgress = progress / 100
    let status: Task['status'] = 'not_started'
    if (actualProgress >= 1) status = 'completed'
    else if (actualProgress > 0) status = 'in_progress'
    else if (task.end_date && task.end_date < new Date().toISOString().split('T')[0] && task.planned_progress > 0) status = 'delayed'
    await onUpdate(task.id, {
      actual_progress: actualProgress,
      assignee_name: assignee.trim() || null,
      status,
    })
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setProgress(Math.round(task.actual_progress * 100))
    setAssignee(task.assignee_name ?? '')
    setEditing(false)
  }

  return (
    <tr className="hover:bg-surface-hover transition-colors group">
      {/* WBS 코드 */}
      <td className="pl-8 pr-3 py-3 font-mono text-xs text-content-subtle whitespace-nowrap">
        {task.wbs_code}
      </td>
      {/* 작업명 */}
      <td className="px-3 py-3 text-sm font-medium text-content">
        {task.task_name}
      </td>
      {/* 기간 */}
      <td className="px-3 py-3 text-xs text-content-muted whitespace-nowrap">
        {fmtDate(task.start_date)} ~ {fmtDate(task.end_date)}
      </td>
      {/* 계획/실적 진행률 */}
      <td className="px-3 py-3">
        {editing ? (
          <div className="flex items-center gap-2 min-w-[160px]">
            <input
              type="range" min={0} max={100} value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs font-mono w-9 text-right text-content">{progress}%</span>
          </div>
        ) : (
          <div className="min-w-[120px]">
            <div className="flex justify-between text-xs text-content-subtle mb-1">
              <span>계획 {pct(task.planned_progress)}</span>
              <span className="font-medium text-content">실적 {pct(task.actual_progress)}</span>
            </div>
            <div className="h-2 bg-surface-hover rounded-full overflow-hidden relative">
              <div
                className="absolute h-full bg-surface-hover rounded-full"
                style={{ width: pct(task.planned_progress) }}
              />
              <div
                className={`absolute h-full rounded-full ${
                  task.actual_progress >= task.planned_progress ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: pct(task.actual_progress) }}
              />
            </div>
          </div>
        )}
      </td>
      {/* 담당자 */}
      <td className="px-3 py-3">
        {editing ? (
          <input
            type="text"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            placeholder="담당자 이름"
            className="w-24 px-2 py-1 text-xs border border-line rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <div className="flex items-center gap-1 text-xs text-content-muted">
            {task.assignee_name ? (
              <>
                <User size={11} className="text-content-subtle" />
                <span>{task.assignee_name}</span>
              </>
            ) : (
              <span className="text-content-subtle">미지정</span>
            )}
          </div>
        )}
      </td>
      {/* 상태 */}
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[task.status]}`}>
          {STATUS_ICON[task.status]}
          {STATUS_LABEL[task.status]}
        </span>
      </td>
      {/* 액션 */}
      <td className="px-3 py-3">
        {editing ? (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : null}
              저장
            </button>
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs text-content-muted border border-line rounded hover:bg-surface-hover"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs text-primary border border-primary/30 rounded hover:bg-primary-soft"
          >
            수정
          </button>
        )}
      </td>
    </tr>
  )
}

// ---------- 그룹 행 ----------
function GroupRow({
  level, code, name, tasks, expanded, onToggle,
}: {
  level: 1 | 2
  code: string
  name: string
  tasks: Task[]
  expanded: boolean
  onToggle: () => void
}) {
  const total = tasks.length
  const done  = tasks.filter(t => t.status === 'completed').length
  const delayed = tasks.filter(t => t.status === 'delayed').length
  const avgActual = total > 0 ? tasks.reduce((s, t) => s + t.actual_progress, 0) / total : 0
  const avgPlan   = total > 0 ? tasks.reduce((s, t) => s + t.planned_progress, 0) / total : 0

  return (
    <tr
      className={`cursor-pointer ${level === 1 ? 'bg-primary-soft hover:bg-primary-soft' : 'bg-canvas hover:bg-surface-hover'}`}
      onClick={onToggle}
    >
      <td className={`py-3 font-mono text-xs ${level === 1 ? 'pl-4 text-primary' : 'pl-6 text-content-subtle'}`}>
        {code}
      </td>
      <td className={`px-3 py-3 font-semibold ${level === 1 ? 'text-primary text-sm' : 'text-content text-sm'}`}>
        {expanded ? <ChevronDown size={14} className="inline mr-1" /> : <ChevronUp size={14} className="inline mr-1" />}
        {name}
      </td>
      <td className="px-3 py-3 text-xs text-content-subtle">하위 {total}개</td>
      <td className="px-3 py-3">
        <div className="min-w-[120px]">
          <div className="flex justify-between text-xs text-content-subtle mb-1">
            <span>계획 {pct(avgPlan)}</span>
            <span className="font-medium text-content-muted">실적 {pct(avgActual)}</span>
          </div>
          <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden relative">
            <div className="absolute h-full bg-surface-hover rounded-full" style={{ width: pct(avgPlan) }} />
            <div className={`absolute h-full rounded-full ${avgActual >= avgPlan ? 'bg-green-400' : 'bg-primary'}`} style={{ width: pct(avgActual) }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-3" />
      <td className="px-3 py-3 text-xs text-content-muted">
        완료 {done} / 지연 <span className={delayed > 0 ? 'text-red-500 font-medium' : ''}>{delayed}</span>
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
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from('files')
        .select('id, original_name, storage_path, created_at')
        .eq('project_id', projectId)
        .neq('mime_type', 'folder')
        .or('original_name.ilike.%.xlsx,original_name.ilike.%.xls,original_name.ilike.%.xlsm')
        .order('created_at', { ascending: false })
      if (error) throw error
      setWbsFiles((data ?? []).map(r => ({
        id: r.id,
        name: r.original_name,
        storagePath: r.storage_path,
        createdAt: r.created_at,
      })))
    } catch (err) {
      setFetchError((err as Error).message)
    } finally {
      setLoadingFiles(false)
    }
  }, [projectId])

  useEffect(() => { loadFiles() }, [loadFiles])

  const handleSelect = async (file: WbsFile) => {
    setDownloading(file.id)
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(file.storagePath)
      if (error) throw error
      const buf = await data.arrayBuffer()
      onImport(buf)
      onClose()
    } catch (err) {
      setFetchError(`다운로드 실패: ${(err as Error).message}`)
      setDownloading(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-modal w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-lg font-semibold text-content">WBS 파일 선택</h2>
          <button onClick={onClose} className="text-content-subtle hover:text-content-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-content-muted mb-4">
            이 프로젝트에 업로드된 Excel 파일을 선택하면 Schedule 시트에서 작업을 가져옵니다.
            <br />
            <span className="text-orange-600 font-medium">주의: 기존 작업 목록이 교체됩니다.</span>
          </p>
          {fetchError && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg">{fetchError}</div>
          )}
          {loadingFiles ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-content-subtle" />
            </div>
          ) : wbsFiles.length === 0 ? (
            <div className="text-center py-8 text-content-subtle text-sm">
              <FileSpreadsheet size={32} className="mx-auto mb-2 text-content-subtle" />
              Excel 파일이 없습니다. 산출물 목록에서 WBS 파일을 먼저 업로드하세요.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {wbsFiles.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleSelect(f)}
                  disabled={downloading !== null}
                  className="w-full flex items-center gap-3 px-4 py-3 border border-line rounded-xl hover:border-primary hover:bg-primary-soft transition-colors text-left disabled:opacity-50"
                >
                  {downloading === f.id
                    ? <Loader2 size={18} className="animate-spin text-primary shrink-0" />
                    : <FileSpreadsheet size={18} className="text-green-500 shrink-0" />
                  }
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-content truncate">{f.name}</div>
                    <div className="text-xs text-content-subtle mt-0.5">
                      {new Date(f.createdAt).toLocaleDateString('ko-KR')}
                    </div>
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

// ---------- 메인 페이지 ----------
export default function TaskBoard() {
  const { id: projectId } = useParams<{ id: string }>()
  const { project } = useProject(projectId!)
  const { tasks, loading, importing, error, importTasks, updateTask } = useTasks(projectId!)

  const [showImport, setShowImport] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState('전체')
  const [filterStatus, setFilterStatus]     = useState<'전체' | Task['status']>('전체')
  // 축소/확장 상태 (key = wbs_code)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // 담당자 목록
  const assignees = ['전체', ...Array.from(new Set(
    tasks.filter(t => t.assignee_name).map(t => t.assignee_name!)
  )).sort()]

  // 필터링
  const filtered = tasks.filter(t => {
    if (filterAssignee !== '전체' && t.assignee_name !== filterAssignee) return false
    if (filterStatus !== '전체' && t.status !== filterStatus) return false
    return true
  })

  // 그룹 구조: L1 → L2 → L3
  const l1Groups = filtered.filter(t => t.wbs_level === 1)
  const l2Groups = filtered.filter(t => t.wbs_level === 2)
  const l3Tasks  = filtered.filter(t => t.wbs_level === 3)

  // L2의 상위 L1 코드 추론
  const getL1Code = (l2Code: string) => l2Code.split('.').slice(0, 1).join('.')
  const getL2Code = (l3Code: string) => l3Code.split('.').slice(0, 2).join('.')

  // 통계
  const l3Only = tasks.filter(t => t.wbs_level === 3)
  const stats = {
    total:   l3Only.length,
    done:    l3Only.filter(t => t.status === 'completed').length,
    active:  l3Only.filter(t => t.status === 'in_progress').length,
    delayed: l3Only.filter(t => t.status === 'delayed').length,
  }

  const toggleCollapse = (code: string) =>
    setCollapsed(prev => {
      const s = new Set(prev)
      s.has(code) ? s.delete(code) : s.add(code)
      return s
    })

  const handleImportBuffer = async (buf: ArrayBuffer) => {
    setImportError(null)
    try {
      const parsed = parseWbsBuffer(buf)
      if (parsed.length === 0) {
        setImportError('Schedule 시트에서 작업을 찾을 수 없습니다.')
        return
      }
      await importTasks(parsed)
    } catch (err) {
      setImportError((err as Error).message)
    }
  }

  return (
    <div className="p-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-content-muted mb-6">
        <Link to="/projects" className="hover:text-content">프로젝트</Link>
        <ChevronRight size={14} />
        <Link to={`/projects/${projectId}`} className="hover:text-content">
          {project?.name ?? '프로젝트 상세'}
        </Link>
        <ChevronRight size={14} />
        <span className="text-content">WBS 작업 관리</span>
      </div>

      {/* 헤더 */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ClipboardList size={22} className="text-primary" />
            WBS 작업 관리
          </span>
        }
        description="WBS 파일에서 가져온 작업 목록으로 담당자별 일정을 관리합니다."
        actions={
          <Button onClick={() => setShowImport(true)} disabled={importing}>
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {importing ? '가져오는 중...' : 'WBS 가져오기'}
          </Button>
        }
      />

      {/* 에러 */}
      {(error || importError) && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 flex items-center gap-2">
          <AlertCircle size={15} />
          {error || importError}
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '전체 작업', value: stats.total, color: 'text-content', bg: 'bg-surface' },
          { label: '완료', value: stats.done, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
          { label: '진행중', value: stats.active, color: 'text-primary', bg: 'bg-primary-soft' },
          { label: '지연', value: stats.delayed, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-line p-4 text-center`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-content-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <User size={14} className="text-content-subtle" />
          <span className="text-content-muted text-xs font-medium">담당자</span>
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="ml-1 px-2 py-1 border border-line rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-surface"
          >
            {assignees.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-content-muted text-xs font-medium">상태</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-2 py-1 border border-line rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-surface"
          >
            <option value="전체">전체</option>
            <option value="not_started">예정</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
            <option value="delayed">지연</option>
          </select>
        </div>
        {(filterAssignee !== '전체' || filterStatus !== '전체') && (
          <button
            onClick={() => { setFilterAssignee('전체'); setFilterStatus('전체') }}
            className="text-xs text-primary hover:underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-content-subtle" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-content-subtle">
            <ClipboardList size={48} className="text-content-subtle" />
            <p className="font-medium text-content-muted">작업이 없습니다</p>
            <p className="text-sm text-center">
              "WBS 가져오기" 버튼을 눌러 산출물 목록에 업로드된<br />
              Excel WBS 파일에서 작업을 가져오세요.
            </p>
            <Button onClick={() => setShowImport(true)}>
              <Upload size={15} /> WBS 가져오기
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="text-left pl-4 pr-3 py-3 text-xs font-medium text-content-muted w-24">WBS</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted">작업명</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-32">기간</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-44">진행률</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-24">담당자</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-content-muted w-20">상태</th>
                <th className="px-3 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {l1Groups.map(l1 => {
                const l1Expanded = !collapsed.has(l1.wbs_code)
                const l1L2 = l2Groups.filter(g => getL1Code(g.wbs_code) === l1.wbs_code)
                const l1L3 = l3Tasks.filter(t => t.wbs_code.startsWith(`${l1.wbs_code}.`))

                return (
                  <React.Fragment key={l1.wbs_code}>
                    <GroupRow
                      level={1}
                      code={l1.wbs_code}
                      name={l1.task_name}
                      tasks={l1L3}
                      expanded={l1Expanded}
                      onToggle={() => toggleCollapse(l1.wbs_code)}
                    />
                    {l1Expanded && l1L2.map(l2 => {
                      const l2Expanded = !collapsed.has(l2.wbs_code)
                      const l2L3 = l3Tasks.filter(t => getL2Code(t.wbs_code) === l2.wbs_code)

                      return (
                        <React.Fragment key={l2.wbs_code}>
                          <GroupRow
                            level={2}
                            code={l2.wbs_code}
                            name={l2.task_name}
                            tasks={l2L3}
                            expanded={l2Expanded}
                            onToggle={() => toggleCollapse(l2.wbs_code)}
                          />
                          {l2Expanded && l2L3.map(task => (
                            <TaskRow key={task.id} task={task} onUpdate={updateTask} />
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

      {/* 작업 수 표시 */}
      {tasks.length > 0 && (
        <p className="mt-3 text-xs text-content-subtle text-right">
          {filtered.length < tasks.length
            ? `${filtered.length} / ${tasks.length}개 표시`
            : `전체 ${tasks.length}개`}
        </p>
      )}

      {/* Import 모달 */}
      {showImport && (
        <ImportModal
          projectId={projectId!}
          onImport={handleImportBuffer}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
