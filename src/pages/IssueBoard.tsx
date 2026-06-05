import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bug, Sparkles, CheckSquare, TrendingUp,
  AlertCircle, ArrowUp, Minus, ArrowDown,
  Circle, Clock, CheckCircle2, XCircle,
  Plus, X, Search, Pencil, Trash2, Loader2,
  TriangleAlert, MessageSquare, LayoutList, Columns2,
} from 'lucide-react'
import { useIssues, type Issue, type IssueType, type IssuePriority, type IssueStatus, type IssuePayload } from '../hooks/useIssues'
import { useMembers } from '../hooks/useMembers'
import { useCommentCounts } from '../hooks/useComments'
import CommentThread from '../components/CommentThread'
import { cn } from '../utils'

// ── 설정 ─────────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<IssueType, { label: string; Icon: React.ElementType; cls: string }> = {
  bug:         { label: '버그',  Icon: Bug,        cls: 'text-danger' },
  feature:     { label: '기능',  Icon: Sparkles,   cls: 'text-purple-500' },
  task:        { label: '작업',  Icon: CheckSquare, cls: 'text-blue-500' },
  improvement: { label: '개선',  Icon: TrendingUp, cls: 'text-green-500' },
}

const PRI_CFG: Record<IssuePriority, { label: string; Icon: React.ElementType; cls: string }> = {
  critical: { label: '긴급', Icon: AlertCircle, cls: 'bg-danger-soft text-danger' },
  high:     { label: '높음', Icon: ArrowUp,     cls: 'bg-warning-soft text-orange-700' },
  medium:   { label: '보통', Icon: Minus,       cls: 'bg-warning-soft text-yellow-700' },
  low:      { label: '낮음', Icon: ArrowDown,   cls: 'bg-surface-hover text-content-muted' },
}

const STATUS_CFG: Record<IssueStatus, { label: string; Icon: React.ElementType; cls: string }> = {
  open:        { label: '열림',   Icon: Circle,        cls: 'bg-primary-soft text-primary' },
  in_progress: { label: '진행중', Icon: Clock,          cls: 'bg-warning-soft text-yellow-700' },
  resolved:    { label: '해결됨', Icon: CheckCircle2,   cls: 'bg-success-soft text-success' },
  closed:      { label: '닫힘',   Icon: XCircle,        cls: 'bg-surface-hover text-content-muted' },
}

const STATUS_TABS: Array<{ key: IssueStatus | 'all'; label: string }> = [
  { key: 'all',        label: '전체' },
  { key: 'open',       label: '열림' },
  { key: 'in_progress',label: '진행중' },
  { key: 'resolved',   label: '해결됨' },
  { key: 'closed',     label: '닫힘' },
]

function fmt(date: string | null): string {
  if (!date) return '—'
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isOverdue(date: string | null, status: IssueStatus): boolean {
  if (!date || status === 'resolved' || status === 'closed') return false
  return new Date(date) < new Date()
}

// ── 이슈 패널 폼 ──────────────────────────────────────────────────────────────

interface PanelFormState {
  title:         string
  description:   string
  type:          IssueType
  priority:      IssuePriority
  status:        IssueStatus
  assignee_id:   string
  assignee_name: string
  due_date:      string
}

const DEFAULT_FORM: PanelFormState = {
  title: '', description: '',
  type: 'task', priority: 'medium', status: 'open',
  assignee_id: '', assignee_name: '', due_date: '',
}

interface IssuePanelProps {
  issue: Issue | null      // null = 새로 만들기
  members: import('../hooks/useMembers').ProjectMember[]
  saving: boolean
  onSave: (payload: IssuePayload) => void
  onClose: () => void
}

function IssuePanel({ issue, members, saving, onSave, onClose }: IssuePanelProps) {
  const [form, setForm] = useState<PanelFormState>(() =>
    issue
      ? {
          title:         issue.title,
          description:   issue.description ?? '',
          type:          issue.type,
          priority:      issue.priority,
          status:        issue.status,
          assignee_id:   issue.assignee_id ?? '',
          assignee_name: issue.assignee_name ?? '',
          due_date:      issue.due_date ?? '',
        }
      : { ...DEFAULT_FORM }
  )

  const set = (k: keyof PanelFormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleAssignee = (userId: string) => {
    if (!userId) { set('assignee_id', ''); set('assignee_name', ''); return }
    const m = members.find(m => m.user_id === userId)
    set('assignee_id', userId)
    set('assignee_name', m?.display_name || m?.email?.split('@')[0] || '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      title:         form.title.trim(),
      description:   form.description.trim() || null,
      type:          form.type,
      priority:      form.priority,
      status:        form.status,
      assignee_id:   form.assignee_id || null,
      assignee_name: form.assignee_name || null,
      due_date:      form.due_date || null,
    })
  }

  const inputCls = 'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-content placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition'
  const selectCls = inputCls

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 오버레이 */}
      <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* 패널 */}
      <div className="w-[400px] h-full bg-canvas border-l border-line flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h2 className="text-sm font-semibold text-content">
            {issue ? '이슈 수정' : '새 이슈'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-content-muted hover:text-content hover:bg-surface-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* 제목 */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">
              제목 <span className="text-danger">*</span>
            </label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="이슈 제목을 입력하세요"
              className={inputCls}
              autoFocus
            />
          </div>

          {/* 유형 + 우선순위 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1.5">유형</label>
              <select value={form.type} onChange={e => set('type', e.target.value as IssueType)} className={selectCls}>
                {(Object.keys(TYPE_CFG) as IssueType[]).map(k => (
                  <option key={k} value={k}>{TYPE_CFG[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1.5">우선순위</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value as IssuePriority)} className={selectCls}>
                {(Object.keys(PRI_CFG) as IssuePriority[]).map(k => (
                  <option key={k} value={k}>{PRI_CFG[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">상태</label>
            <select value={form.status} onChange={e => set('status', e.target.value as IssueStatus)} className={selectCls}>
              {(Object.keys(STATUS_CFG) as IssueStatus[]).map(k => (
                <option key={k} value={k}>{STATUS_CFG[k].label}</option>
              ))}
            </select>
          </div>

          {/* 담당자 */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">담당자</label>
            <select
              value={form.assignee_id}
              onChange={e => handleAssignee(e.target.value)}
              className={selectCls}
            >
              <option value="">담당자 없음</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email.split('@')[0]}
                </option>
              ))}
            </select>
          </div>

          {/* 마감일 */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">마감일</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => set('due_date', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">설명</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={5}
              placeholder="이슈에 대해 자세히 설명해주세요..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </form>

        {/* 푸터 */}
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-line">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-line text-content-muted hover:bg-surface-hover transition-colors">
            취소
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={!form.title.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {issue ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 뱃지 컴포넌트 ──────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: IssueType }) {
  const { Icon, cls } = TYPE_CFG[type]
  return <Icon size={14} className={cls} />
}

function PriBadge({ priority }: { priority: IssuePriority }) {
  const { label, Icon, cls } = PRI_CFG[priority]
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>
      <Icon size={9} /> {label}
    </span>
  )
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const { label, Icon, cls } = STATUS_CFG[status]
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>
      <Icon size={9} /> {label}
    </span>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────────────

// ── 칸반 카드 ────────────────────────────────────────────────────────────────
function IssueCard({
  issue, commentCount, onDragStart, onClick,
}: {
  issue: Issue; commentCount: number
  onDragStart: (id: string) => void; onClick: () => void
}) {
  const { Icon: TIcon, cls: TCls } = TYPE_CFG[issue.type]
  const { label: PLabel, cls: PCls } = PRI_CFG[issue.priority]
  return (
    <div
      draggable
      onDragStart={() => onDragStart(issue.id)}
      onClick={onClick}
      className="bg-surface border border-line rounded-xl p-3 cursor-pointer hover:border-primary/40 hover:shadow-card transition-all select-none"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <TIcon size={14} className={TCls} />
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', PCls)}>{PLabel}</span>
      </div>
      <p className="text-sm text-content font-medium line-clamp-2 leading-snug">{issue.title}</p>
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-1.5">
          {issue.assignee_name && (
            <div className="w-5 h-5 rounded-full bg-primary-soft text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
              {issue.assignee_name[0].toUpperCase()}
            </div>
          )}
          {issue.due_date && (
            <span className={cn('text-[10px]', isOverdue(issue.due_date, issue.status) ? 'text-danger' : 'text-content-subtle')}>
              {fmt(issue.due_date)}
            </span>
          )}
        </div>
        {commentCount > 0 && (
          <div className="flex items-center gap-0.5 text-[10px] text-content-subtle">
            <MessageSquare size={10} />{commentCount}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 칸반 컬럼 ────────────────────────────────────────────────────────────────
const KANBAN_STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed']

function KanbanColumn({
  status, issues, draggingId, commentCounts,
  onDragStart, onDrop, onCardClick, onAddClick,
}: {
  status: IssueStatus; issues: Issue[]; draggingId: string | null
  commentCounts: Record<string, number>
  onDragStart: (id: string) => void; onDrop: (newStatus: IssueStatus) => void
  onCardClick: (issue: Issue) => void; onAddClick: (status: IssueStatus) => void
}) {
  const [over, setOver] = useState(false)
  const { label, Icon, cls } = STATUS_CFG[status]
  return (
    <div
      className={cn(
        'flex flex-col min-w-[220px] flex-1 rounded-xl border-2 transition-colors',
        over && draggingId ? 'border-primary bg-primary-soft/20' : 'border-line bg-canvas',
      )}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(status) }}
    >
      {/* 컬럼 헤더 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-line shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={12} className={cls.split(' ')[1] ?? 'text-content-muted'} />
          <span className="text-xs font-semibold text-content">{label}</span>
          <span className="text-[10px] bg-surface-hover text-content-subtle px-1.5 py-0.5 rounded-full">{issues.length}</span>
        </div>
        <button onClick={() => onAddClick(status)} className="p-0.5 rounded text-content-subtle hover:text-primary hover:bg-primary-soft transition-colors">
          <Plus size={14} />
        </button>
      </div>
      {/* 카드 목록 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {issues.map(issue => (
          <IssueCard
            key={issue.id}
            issue={issue}
            commentCount={commentCounts[issue.id] ?? 0}
            onDragStart={onDragStart}
            onClick={() => onCardClick(issue)}
          />
        ))}
        {issues.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-content-subtle italic">없음</div>
        )}
      </div>
    </div>
  )
}

// ── 이슈 상세 패널 ────────────────────────────────────────────────────────────
function IssueDetailPanel({
  issue, members, projectId, onClose, onUpdate, onDelete,
}: {
  issue: Issue; members: import('../hooks/useMembers').ProjectMember[]
  projectId: string; onClose: () => void
  onUpdate: (id: string, patch: IssuePayload) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<PanelFormState>({
    title: issue.title, description: issue.description ?? '',
    type: issue.type, priority: issue.priority, status: issue.status,
    assignee_id: issue.assignee_id ?? '', assignee_name: issue.assignee_name ?? '',
    due_date: issue.due_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof PanelFormState, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(issue.id, {
        title: form.title, description: form.description || null,
        type: form.type, priority: form.priority, status: form.status,
        assignee_id: form.assignee_id || null, assignee_name: form.assignee_name || null,
        due_date: form.due_date || null,
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[520px] h-full bg-canvas border-l border-line flex flex-col shadow-2xl overflow-hidden animate-slide-in-right">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <TypeBadge type={issue.type} />
            <StatusBadge status={form.status} />
          </div>
          <div className="flex items-center gap-1">
            {!editing && (
              <>
                <button onClick={() => setEditing(true)} className="p-1.5 rounded text-content-muted hover:text-primary hover:bg-primary-soft transition-colors" title="수정">
                  <Pencil size={14} />
                </button>
                <button onClick={() => { if (confirm('삭제하시겠습니까?')) { onDelete(issue.id); onClose() } }}
                  className="p-1.5 rounded text-content-muted hover:text-danger hover:bg-danger-soft transition-colors" title="삭제">
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded text-content-muted hover:bg-surface-hover transition-colors"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">
            {/* 제목 */}
            {editing
              ? <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls + ' text-base font-semibold'} />
              : <h2 className="text-base font-semibold text-content leading-snug">{issue.title}</h2>}

            {/* 메타 그리드 */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* 상태 */}
              <div>
                <label className="block text-xs text-content-subtle mb-1">상태</label>
                {editing
                  ? <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                      {(Object.keys(STATUS_CFG) as IssueStatus[]).map(k => <option key={k} value={k}>{STATUS_CFG[k].label}</option>)}
                    </select>
                  : <StatusBadge status={issue.status} />}
              </div>
              {/* 우선순위 */}
              <div>
                <label className="block text-xs text-content-subtle mb-1">우선순위</label>
                {editing
                  ? <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
                      {(Object.keys(PRI_CFG) as IssuePriority[]).map(k => <option key={k} value={k}>{PRI_CFG[k].label}</option>)}
                    </select>
                  : <PriBadge priority={issue.priority} />}
              </div>
              {/* 유형 */}
              <div>
                <label className="block text-xs text-content-subtle mb-1">유형</label>
                {editing
                  ? <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                      {(Object.keys(TYPE_CFG) as IssueType[]).map(k => <option key={k} value={k}>{TYPE_CFG[k].label}</option>)}
                    </select>
                  : <span className="text-sm text-content">{TYPE_CFG[issue.type].label}</span>}
              </div>
              {/* 담당자 */}
              <div>
                <label className="block text-xs text-content-subtle mb-1">담당자</label>
                {editing
                  ? <select value={form.assignee_id} onChange={e => {
                      const m = members.find(m => m.user_id === e.target.value)
                      set('assignee_id', e.target.value)
                      set('assignee_name', m?.display_name || m?.email?.split('@')[0] || '')
                    }} className={inputCls}>
                      <option value="">없음</option>
                      {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
                    </select>
                  : <span className="text-sm text-content">{issue.assignee_name ?? '—'}</span>}
              </div>
              {/* 마감일 */}
              <div>
                <label className="block text-xs text-content-subtle mb-1">마감일</label>
                {editing
                  ? <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inputCls} />
                  : <span className={cn('text-sm', isOverdue(issue.due_date, issue.status) ? 'text-danger font-medium' : 'text-content')}>
                      {issue.due_date ? fmt(issue.due_date) : '—'}
                    </span>}
              </div>
              {/* 보고자 */}
              <div>
                <label className="block text-xs text-content-subtle mb-1">보고자</label>
                <span className="text-sm text-content">{issue.reporter_name ?? '—'}</span>
              </div>
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-xs text-content-subtle mb-1.5">설명</label>
              {editing
                ? <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={5}
                    className={inputCls + ' resize-none'} placeholder="이슈 설명..." />
                : <p className="text-sm text-content whitespace-pre-wrap min-h-[40px] text-content-muted">
                    {issue.description || '설명 없음'}
                  </p>}
            </div>

            {/* 수정 액션 */}
            {editing && (
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null} 저장
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-line text-sm rounded-lg hover:bg-surface-hover transition-colors">
                  취소
                </button>
              </div>
            )}

            <div className="border-t border-line pt-4">
              <p className="text-xs font-semibold text-content-muted mb-3">댓글</p>
              <CommentThread projectId={projectId} entityType="issue" entityId={issue.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────────────

export default function IssueBoard() {
  const { id: projectId = '' } = useParams<{ id: string }>()
  const { issues, loading, error, create, update, remove } = useIssues(projectId)
  const { members } = useMembers(projectId)

  const [view, setView]                 = useState<'list' | 'kanban'>('list')
  const [activeStatus, setActiveStatus] = useState<IssueStatus | 'all'>('all')
  const [filterType, setFilterType]     = useState<IssueType | 'all'>('all')
  const [filterPri, setFilterPri]       = useState<IssuePriority | 'all'>('all')
  const [search, setSearch]             = useState('')
  const [panelOpen, setPanelOpen]       = useState(false)
  const [editTarget, setEditTarget]     = useState<Issue | null>(null)
  const [saving, setSaving]             = useState(false)
  const [deleteId, setDeleteId]         = useState<string | null>(null)
  const [commentIssueId, setCommentIssueId] = useState<string | null>(null)
  const [detailIssue, setDetailIssue]   = useState<Issue | null>(null)
  const [draggingId, setDraggingId]     = useState<string | null>(null)

  // 댓글 수 뱃지
  const issueIds = useMemo(() => issues.map(i => i.id), [issues])
  const commentCounts = useCommentCounts(projectId, 'issue', issueIds)

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = { all: issues.length }
    for (const i of issues) map[i.status] = (map[i.status] || 0) + 1
    return map
  }, [issues])

  // 필터링
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return issues.filter(i => {
      if (activeStatus !== 'all' && i.status !== activeStatus) return false
      if (filterType !== 'all' && i.type !== filterType) return false
      if (filterPri !== 'all' && i.priority !== filterPri) return false
      if (q && !i.title.toLowerCase().includes(q) && !(i.description?.toLowerCase().includes(q))) return false
      return true
    })
  }, [issues, activeStatus, filterType, filterPri, search])

  const openCreate = useCallback((defaultStatus?: IssueStatus) => {
    setEditTarget(null)
    // 칸반에서 특정 컬럼 + 클릭 시 해당 상태로 기본값 세팅은 IssuePanel 내부에서 처리
    setPanelOpen(true)
    if (defaultStatus) setActiveStatus(defaultStatus)
  }, [])
  const openEdit   = useCallback((issue: Issue) => { setEditTarget(issue); setPanelOpen(true) }, [])
  const closePanel = useCallback(() => { setPanelOpen(false); setEditTarget(null) }, [])

  const handleDrop = useCallback(async (newStatus: IssueStatus) => {
    if (!draggingId) return
    const issue = issues.find(i => i.id === draggingId)
    if (issue && issue.status !== newStatus) {
      await update(draggingId, { ...issue, status: newStatus, description: issue.description ?? null,
        assignee_id: issue.assignee_id ?? null, assignee_name: issue.assignee_name ?? null, due_date: issue.due_date ?? null })
    }
    setDraggingId(null)
  }, [draggingId, issues, update])

  const handleSave = useCallback(async (payload: IssuePayload) => {
    setSaving(true)
    try {
      if (editTarget) await update(editTarget.id, payload)
      else await create(payload)
      closePanel()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }, [editTarget, create, update, closePanel])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('이슈를 삭제하시겠습니까?')) return
    setDeleteId(id)
    try {
      await remove(id)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setDeleteId(null)
    }
  }, [remove])

  const selCls = 'text-sm border border-line rounded-lg px-2.5 py-1.5 bg-canvas text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 헤더 ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-line bg-canvas">
        <div>
          <h1 className="text-lg font-bold text-content">이슈 관리</h1>
          <p className="text-xs text-content-muted mt-0.5">버그, 개선 요청, 작업 이슈를 추적합니다</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="flex gap-0.5 bg-canvas border border-line rounded-lg p-0.5">
            <button onClick={() => setView('list')} title="리스트"
              className={cn('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-primary text-white' : 'text-content-muted hover:bg-surface-hover')}>
              <LayoutList size={15} />
            </button>
            <button onClick={() => setView('kanban')} title="칸반"
              className={cn('p-1.5 rounded-md transition-colors', view === 'kanban' ? 'bg-primary text-white' : 'text-content-muted hover:bg-surface-hover')}>
              <Columns2 size={15} />
            </button>
          </div>
          <button onClick={() => openCreate()}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors">
            <Plus size={14} /> 이슈 추가
          </button>
        </div>
      </div>

      {/* ── 필터 바 ── */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-line bg-surface">
        {/* 상태 탭 */}
        <div className="flex gap-1 bg-canvas border border-line rounded-lg p-0.5">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                activeStatus === tab.key
                  ? 'bg-primary text-white'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover'
              )}
            >
              {tab.label}
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                activeStatus === tab.key ? 'bg-surface/20 text-white' : 'bg-surface text-content-subtle'
              )}>
                {statusCounts[tab.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* 유형 */}
        <select value={filterType} onChange={e => setFilterType(e.target.value as IssueType | 'all')} className={selCls}>
          <option value="all">유형 전체</option>
          {(Object.keys(TYPE_CFG) as IssueType[]).map(k => (
            <option key={k} value={k}>{TYPE_CFG[k].label}</option>
          ))}
        </select>

        {/* 우선순위 */}
        <select value={filterPri} onChange={e => setFilterPri(e.target.value as IssuePriority | 'all')} className={selCls}>
          <option value="all">우선순위 전체</option>
          {(Object.keys(PRI_CFG) as IssuePriority[]).map(k => (
            <option key={k} value={k}>{PRI_CFG[k].label}</option>
          ))}
        </select>

        {/* 검색 */}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-subtle" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이슈 검색…"
            className="pl-7 pr-3 py-1.5 text-sm border border-line rounded-lg bg-canvas text-content placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition w-48"
          />
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className={cn('flex-1 overflow-auto', view === 'kanban' && 'flex gap-3 p-4')}>

        {/* ── 칸반 뷰 ── */}
        {view === 'kanban' && !loading && KANBAN_STATUSES.map(status => {
          const colIssues = filtered.filter(i => i.status === status)
          return (
            <KanbanColumn
              key={status}
              status={status}
              issues={colIssues}
              draggingId={draggingId}
              commentCounts={commentCounts}
              onDragStart={setDraggingId}
              onDrop={handleDrop}
              onCardClick={setDetailIssue}
              onAddClick={() => openCreate(status)}
            />
          )
        })}

        {/* ── 리스트 뷰 ── */}
        {view === 'list' && loading && (
          <div className="flex items-center justify-center py-20 gap-2 text-content-muted">
            <Loader2 size={16} className="animate-spin" /> 로딩 중…
          </div>
        )}

        {view === 'list' && !loading && error && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-danger-soft text-danger text-sm flex items-center gap-2">
            <TriangleAlert size={15} /> {error}
          </div>
        )}

        {view === 'list' && !loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-content-subtle">
            <Bug size={32} className="mb-3 opacity-30" />
            <p className="text-sm">
              {issues.length === 0 ? '이슈가 없습니다.' : '조건에 맞는 이슈가 없습니다.'}
            </p>
            {issues.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-3 text-xs text-primary hover:underline"
              >
                첫 이슈를 추가해보세요
              </button>
            )}
          </div>
        )}

        {view === 'list' && !loading && filtered.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="sticky top-0 bg-surface border-b border-line z-10">
                <th className="w-8 px-4 py-2.5 text-left text-xs font-medium text-content-muted">유형</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-content-muted">제목</th>
                <th className="w-20 px-3 py-2.5 text-left text-xs font-medium text-content-muted">우선순위</th>
                <th className="w-20 px-3 py-2.5 text-left text-xs font-medium text-content-muted">상태</th>
                <th className="w-24 px-3 py-2.5 text-left text-xs font-medium text-content-muted">담당자</th>
                <th className="w-16 px-3 py-2.5 text-left text-xs font-medium text-content-muted">마감일</th>
                <th className="w-16 px-3 py-2.5 text-left text-xs font-medium text-content-muted">등록일</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(issue => {
                const overdue = isOverdue(issue.due_date, issue.status)
                return (
                  <tr
                    key={issue.id}
                    className="group border-b border-line hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => setDetailIssue(issue)}
                  >
                    {/* 유형 아이콘 */}
                    <td className="px-4 py-2.5 text-center">
                      <TypeBadge type={issue.type} />
                    </td>

                    {/* 제목 */}
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        'text-sm font-medium line-clamp-1',
                        issue.status === 'closed' || issue.status === 'resolved'
                          ? 'text-content-muted line-through'
                          : 'text-content'
                      )}>
                        {issue.title}
                      </span>
                      {issue.description && (
                        <p className="text-xs text-content-subtle mt-0.5 line-clamp-1">{issue.description}</p>
                      )}
                    </td>

                    {/* 우선순위 */}
                    <td className="px-3 py-2.5">
                      <PriBadge priority={issue.priority} />
                    </td>

                    {/* 상태 */}
                    <td className="px-3 py-2.5">
                      <StatusBadge status={issue.status} />
                    </td>

                    {/* 담당자 */}
                    <td className="px-3 py-2.5 text-xs text-content-muted">
                      {issue.assignee_name || '—'}
                    </td>

                    {/* 마감일 */}
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs', overdue ? 'text-danger font-medium' : 'text-content-muted')}>
                        {overdue && <TriangleAlert size={9} className="inline mr-0.5 mb-0.5" />}
                        {fmt(issue.due_date)}
                      </span>
                    </td>

                    {/* 등록일 */}
                    <td className="px-3 py-2.5 text-xs text-content-subtle">
                      {fmt(issue.created_at)}
                    </td>

                    {/* 액션 */}
                    <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* 댓글 버튼 */}
                        <button
                          onClick={() => setCommentIssueId(issue.id)}
                          className="relative p-1 rounded text-content-muted hover:text-primary hover:bg-primary-soft transition-colors"
                        >
                          <MessageSquare size={12} />
                          {(commentCounts.get(issue.id) ?? 0) > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-white text-[8px] rounded-full flex items-center justify-center font-bold">
                              {commentCounts.get(issue.id)}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(issue)}
                          className="p-1 rounded text-content-muted hover:text-primary hover:bg-primary-soft transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(issue.id)}
                          disabled={deleteId === issue.id}
                          className="p-1 rounded text-content-muted hover:text-danger hover:bg-danger-soft transition-colors"
                        >
                          {deleteId === issue.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 이슈 상세 패널 ── */}
      {detailIssue && (
        <IssueDetailPanel
          issue={detailIssue}
          members={members}
          projectId={projectId}
          onClose={() => setDetailIssue(null)}
          onUpdate={async (id, patch) => { await update(id, patch); setDetailIssue(prev => prev?.id === id ? { ...prev, ...patch } as Issue : prev) }}
          onDelete={async (id) => { await remove(id) }}
        />
      )}

      {/* ── 생성/수정 슬라이드 패널 ── */}
      {panelOpen && (
        <IssuePanel
          issue={editTarget}
          members={members}
          saving={saving}
          onSave={handleSave}
          onClose={closePanel}
        />
      )}

      {/* ── 댓글 모달 ── */}
      {commentIssueId && (() => {
        const issue = issues.find(i => i.id === commentIssueId)
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCommentIssueId(null)} />
            <div className="relative z-10 w-full max-w-lg bg-canvas rounded-2xl shadow-2xl border border-line overflow-hidden">
              {/* 모달 헤더 */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <TypeBadge type={issue?.type ?? 'task'} />
                <span className="text-sm font-semibold text-content truncate flex-1">{issue?.title}</span>
                <button
                  onClick={() => setCommentIssueId(null)}
                  className="p-1 rounded text-content-muted hover:text-content hover:bg-surface-hover transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
              <CommentThread
                projectId={projectId}
                targetType="issue"
                targetId={commentIssueId}
                title="댓글"
                maxHeight={420}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}
