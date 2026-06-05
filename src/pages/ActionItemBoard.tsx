import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Circle, Clock, Plus, Trash2, ExternalLink, ClipboardList, Loader2 } from 'lucide-react'
import { useActionItems, type ActionItem } from '../hooks/useActionItems'
import { useMembers } from '../hooks/useMembers'
import { useIssues } from '../hooks/useIssues'
import { PageHeader, Button } from '../components/ui'
import { cn } from '../utils'

const STATUS_CFG = {
  pending:     { label: '대기',   icon: Circle,       cls: 'text-content-subtle' },
  in_progress: { label: '진행중', icon: Clock,        cls: 'text-primary' },
  completed:   { label: '완료',   icon: CheckCircle,  cls: 'text-success' },
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function ActionItemBoard() {
  const { id: projectId = '' } = useParams<{ id: string }>()
  const { items, loading, create, update, remove, createIssue } = useActionItems(projectId)
  const { members } = useMembers(projectId)
  const { issues }  = useIssues(projectId)

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [creating, setCreating]   = useState(false)
  const [newTitle, setNewTitle]   = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDue, setNewDue]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [creatingIssueId, setCreatingIssueId] = useState<string | null>(null)

  const filtered = items.filter(i => {
    if (filter === 'pending')   return i.status !== 'completed'
    if (filter === 'completed') return i.status === 'completed'
    return true
  })

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const member = members.find(m => m.user_id === newAssignee)
      await create(projectId, {
        title: newTitle.trim(),
        assigneeId:   member?.user_id,
        assigneeName: member?.display_name || member?.email?.split('@')[0],
        dueDate:      newDue || undefined,
      })
      setNewTitle(''); setNewAssignee(''); setNewDue(''); setCreating(false)
    } finally { setSaving(false) }
  }

  const handleCreateIssue = async (item: ActionItem) => {
    setCreatingIssueId(item.id)
    try { await createIssue(item) }
    finally { setCreatingIssueId(null) }
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="액션 아이템"
        description="회의에서 도출된 할 일과 담당자를 관리합니다."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> 액션 아이템 추가
          </Button>
        }
      />

      {/* 필터 */}
      <div className="flex gap-1 mb-5 bg-canvas border border-line rounded-lg p-0.5 w-fit">
        {(['pending', 'all', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors',
              filter === f ? 'bg-primary text-white' : 'text-content-muted hover:bg-surface-hover'
            )}>
            {f === 'pending' ? '진행 중' : f === 'completed' ? '완료됨' : '전체'}
          </button>
        ))}
      </div>

      {/* 새 아이템 입력폼 */}
      {creating && (
        <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-xl space-y-3">
          <input
            autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="액션 아이템 내용..."
            className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
          <div className="flex gap-2">
            <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-line rounded-lg text-xs bg-surface focus:outline-none">
              <option value="">담당자 선택</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
            </select>
            <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-line rounded-lg text-xs bg-surface focus:outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCreating(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={saving || !newTitle.trim()}
              className="bg-amber-500 hover:bg-amber-600 border-amber-500">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 추가
            </Button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-content-subtle" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-content-subtle">
          <ClipboardList size={36} className="mb-3 opacity-20" />
          <p className="text-sm">액션 아이템이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const { icon: Icon, cls } = STATUS_CFG[item.status] ?? STATUS_CFG.pending
            const isOverdue = item.dueDate && item.status !== 'completed' && new Date(item.dueDate) < new Date()
            const linkedIssue = item.issueId ? issues.find(i => i.id === item.issueId) : null
            const isCreatingIssue = creatingIssueId === item.id

            return (
              <div key={item.id} className={cn(
                'flex items-start gap-3 p-4 bg-surface border rounded-xl transition-all',
                item.status === 'completed' ? 'opacity-60 border-line' : 'border-line hover:border-primary/30 hover:shadow-sm'
              )}>
                {/* 상태 토글 */}
                <button onClick={() => update(item.id, {
                    status: item.status === 'completed' ? 'pending' : item.status === 'pending' ? 'in_progress' : 'completed'
                  })}
                  title="상태 변경" className="mt-0.5 shrink-0">
                  <Icon size={18} className={cls} />
                </button>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium text-content', item.status === 'completed' && 'line-through text-content-muted')}>
                    {item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    {item.assigneeName && (
                      <span className="text-xs text-content-subtle flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-primary-soft text-primary text-[9px] font-bold flex items-center justify-center">
                          {item.assigneeName[0].toUpperCase()}
                        </span>
                        {item.assigneeName}
                      </span>
                    )}
                    {item.dueDate && (
                      <span className={cn('text-xs', isOverdue ? 'text-danger font-medium' : 'text-content-subtle')}>
                        📅 {formatDate(item.dueDate)}{isOverdue ? ' (초과)' : ''}
                      </span>
                    )}
                    {item.source === 'meeting' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary-soft text-primary rounded-full">회의록</span>
                    )}
                    {linkedIssue && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-surface-hover text-content-muted rounded-full flex items-center gap-1">
                        <ExternalLink size={9} /> 이슈 연결됨
                      </span>
                    )}
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-1 shrink-0">
                  {!item.issueId && item.status !== 'completed' && (
                    <button onClick={() => handleCreateIssue(item)} disabled={isCreatingIssue}
                      title="이슈로 생성"
                      className="text-[10px] px-2 py-1 border border-line rounded-md text-content-subtle hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50">
                      {isCreatingIssue ? <Loader2 size={10} className="animate-spin" /> : '→ 이슈'}
                    </button>
                  )}
                  <button onClick={() => remove(item.id)}
                    className="p-1.5 rounded text-content-subtle hover:text-danger hover:bg-danger-soft transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
