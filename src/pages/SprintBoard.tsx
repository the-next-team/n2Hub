import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Plus, Play, CheckCircle, Trash2, Pencil, X, Save, Loader2,
  CalendarDays, Target, ClipboardList, Bug, ChevronRight, Package,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { useSprints, type Sprint, type SprintPayload } from '../hooks/useSprints'
import { useSprintBoard, fetchBacklog, assignToSprint, type SprintItem, type BoardStatus } from '../hooks/useSprintBoard'
import { PageHeader, Button } from '../components/ui'
import { cn } from '../utils'

// ── 상태 설정 ─────────────────────────────────────────────────────────────────
const BOARD_COLS: { key: BoardStatus; label: string; cls: string }[] = [
  { key: 'todo',        label: '할 일',  cls: 'border-line' },
  { key: 'in_progress', label: '진행중', cls: 'border-primary/40' },
  { key: 'done',        label: '완료',   cls: 'border-success/40' },
]

// ── 번다운 차트 데이터 생성 ───────────────────────────────────────────────────
function buildBurndown(sprint: Sprint, total: number, done: number) {
  if (!sprint.startDate || !sprint.endDate || !total) return []
  const start  = new Date(sprint.startDate)
  const end    = new Date(sprint.endDate)
  const days   = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
  const today  = new Date()
  const elapsed = Math.min(days, Math.max(0, Math.ceil((today.getTime() - start.getTime()) / 86_400_000)))

  return Array.from({ length: days + 1 }, (_, i) => {
    const label   = i === 0 ? '시작' : i === days ? '종료' : `Day ${i}`
    const ideal   = Math.round(total - (total / days) * i)
    const actual  = i <= elapsed ? Math.max(0, total - Math.round((done / Math.max(1, elapsed)) * i)) : undefined
    return { label, ideal, actual }
  })
}

// ── 스프린트 카드 아이템 ──────────────────────────────────────────────────────
function BoardCard({ item, onDragStart }: { item: SprintItem; onDragStart: () => void }) {
  const isIssue = item.kind === 'issue'
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-surface border border-line rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-sm transition-all select-none"
    >
      <div className="flex items-start gap-2 mb-2">
        {isIssue
          ? <Bug size={12} className="text-orange-500 shrink-0 mt-0.5" />
          : <ClipboardList size={12} className="text-primary shrink-0 mt-0.5" />}
        <p className="text-xs font-medium text-content leading-snug line-clamp-2 flex-1">{item.title}</p>
      </div>
      {(item.assigneeName || item.priority) && (
        <div className="flex items-center gap-2">
          {item.priority && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', {
              'bg-danger-soft text-danger': item.priority === 'critical',
              'bg-warning-soft text-orange-700': item.priority === 'high',
              'bg-warning-soft text-yellow-700': item.priority === 'medium',
              'bg-surface-hover text-content-muted': item.priority === 'low',
            })}>
              {item.priority === 'critical' ? '긴급' : item.priority === 'high' ? '높음' : item.priority === 'medium' ? '보통' : '낮음'}
            </span>
          )}
          {item.assigneeName && (
            <span className="text-[10px] text-content-subtle ml-auto">{item.assigneeName}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── 백로그 패널 ───────────────────────────────────────────────────────────────
function BacklogPanel({ projectId, sprintId, onAdded }: { projectId: string; sprintId: string; onAdded: () => void }) {
  const [items, setItems] = useState<{ id: string; kind: 'task' | 'issue'; title: string; assigneeName: string | null; priority?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | 'task' | 'issue'>('all')

  useEffect(() => {
    fetchBacklog(projectId, sprintId).then(({ tasks, issues }) => {
      setItems([...tasks, ...issues])
      setLoading(false)
    })
  }, [projectId, sprintId])

  const handleAdd = async (item: typeof items[0]) => {
    setAdding(item.id)
    await assignToSprint(item.kind, item.id, sprintId)
    setItems(prev => prev.filter(i => i.id !== item.id))
    onAdded()
    setAdding(null)
  }

  const filtered = items.filter(i => filter === 'all' || i.kind === filter)

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-canvas">
        <span className="text-sm font-semibold text-content flex items-center gap-2">
          <Package size={14} className="text-content-subtle" /> 백로그
          <span className="text-xs text-content-subtle font-normal">{items.length}개</span>
        </span>
        <div className="flex gap-1">
          {(['all', 'task', 'issue'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                filter === f ? 'bg-primary text-white' : 'text-content-subtle hover:bg-surface-hover'
              )}>
              {f === 'all' ? '전체' : f === 'task' ? '태스크' : '이슈'}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-line">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-content-subtle" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-content-subtle italic">백로그가 비어있습니다</p>
        ) : filtered.map(item => (
          <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-hover transition-colors">
            {item.kind === 'issue'
              ? <Bug size={12} className="text-orange-500 shrink-0" />
              : <ClipboardList size={12} className="text-primary shrink-0" />}
            <span className="flex-1 text-xs text-content truncate">{item.title}</span>
            <button onClick={() => handleAdd(item)} disabled={adding === item.id}
              className="shrink-0 text-[11px] px-2 py-1 border border-primary/30 text-primary rounded-lg hover:bg-primary-soft transition-colors disabled:opacity-40 flex items-center gap-1">
              {adding === item.id ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              추가
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 스프린트 생성/수정 폼 ─────────────────────────────────────────────────────
function SprintForm({ initial, onSave, onCancel, saving }: {
  initial?: Partial<SprintPayload>; onSave: (p: SprintPayload) => Promise<void>
  onCancel: () => void; saving: boolean
}) {
  const [form, setForm] = useState<SprintPayload>({
    name: initial?.name ?? '', goal: initial?.goal ?? '',
    startDate: initial?.startDate ?? '', endDate: initial?.endDate ?? '',
  })
  const set = (k: keyof SprintPayload, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/40 transition'

  return (
    <form onSubmit={async e => { e.preventDefault(); await onSave(form) }}
      className="space-y-3 p-4 bg-surface border border-line rounded-2xl animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-content-muted mb-1">스프린트 이름 *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Sprint 1" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-content-muted mb-1">시작일</label>
          <input type="date" value={form.startDate ?? ''} onChange={e => set('startDate', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-content-muted mb-1">종료일</label>
          <input type="date" value={form.endDate ?? ''} onChange={e => set('endDate', e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-content-muted mb-1">목표</label>
          <textarea value={form.goal ?? ''} onChange={e => set('goal', e.target.value)} rows={2}
            className={inputCls + ' resize-none'} placeholder="이번 스프린트의 목표..." />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={saving || !form.name.trim()}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
        </Button>
      </div>
    </form>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function SprintBoard() {
  const { id: projectId = '' } = useParams<{ id: string }>()
  const { sprints, loading: sprintsLoading, create, update, remove } = useSprints(projectId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<Sprint | null>(null)
  const [saving, setSaving]         = useState(false)
  const [showBacklog, setShowBacklog] = useState(false)
  const [draggingItem, setDraggingItem] = useState<SprintItem | null>(null)

  // 선택된 스프린트 자동 설정 (활성 스프린트 우선)
  useEffect(() => {
    if (!sprints.length || selectedId) return
    const active = sprints.find(s => s.status === 'active')
    setSelectedId(active?.id ?? sprints[0].id)
  }, [sprints, selectedId])

  const selected = sprints.find(s => s.id === selectedId) ?? null
  const { items, loading: boardLoading, moveItem, total, done, remaining, refetch } = useSprintBoard(selectedId, projectId)

  const burndownData = selected ? buildBurndown(selected, total, done) : []
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  const daysLeft = selected?.endDate
    ? Math.ceil((new Date(selected.endDate).getTime() - Date.now()) / 86_400_000)
    : null
  const isOverdue = daysLeft !== null && daysLeft < 0 && selected?.status === 'active'

  const handleCreate = async (payload: SprintPayload) => { setSaving(true); try { const s = await create(payload); setSelectedId(s.id); setShowForm(false) } finally { setSaving(false) } }
  const handleUpdate = async (payload: SprintPayload) => { if (!editTarget) return; setSaving(true); try { await update(editTarget.id, payload); setEditTarget(null) } finally { setSaving(false) } }

  const handleDrop = async (col: BoardStatus) => {
    if (!draggingItem || draggingItem.status === col) { setDraggingItem(null); return }
    await moveItem(draggingItem, col)
    setDraggingItem(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단: 스프린트 선택 바 */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-line bg-canvas overflow-x-auto">
        <span className="text-xs font-medium text-content-subtle shrink-0">스프린트:</span>
        {sprints.map(s => (
          <button key={s.id} onClick={() => setSelectedId(s.id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0',
              selectedId === s.id ? 'bg-primary text-white' : 'border border-line text-content-muted hover:border-primary/40 hover:text-primary'
            )}>
            {s.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            {s.name}
          </button>
        ))}
        <button onClick={() => { setShowForm(true); setEditTarget(null) }}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-line text-xs text-content-subtle hover:border-primary hover:text-primary transition-colors">
          <Plus size={12} /> 새 스프린트
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* 새 스프린트 폼 */}
        {showForm && !editTarget && (
          <SprintForm onSave={handleCreate} onCancel={() => setShowForm(false)} saving={saving} />
        )}

        {sprintsLoading && <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-content-subtle" /></div>}

        {!sprintsLoading && sprints.length === 0 && !showForm && (
          <div className="flex flex-col items-center py-20 text-content-subtle">
            <CalendarDays size={40} className="mb-3 opacity-20" />
            <p className="text-sm mb-3">스프린트가 없습니다.</p>
            <Button onClick={() => setShowForm(true)}><Plus size={14} /> 첫 스프린트 만들기</Button>
          </div>
        )}

        {selected && (
          <>
            {/* 스프린트 헤더 카드 */}
            {editTarget?.id === selected.id ? (
              <SprintForm initial={selected} onSave={handleUpdate} onCancel={() => setEditTarget(null)} saving={saving} />
            ) : (
              <div className={cn('bg-surface border-2 rounded-2xl p-5', selected.status === 'active' ? 'border-primary/30' : 'border-line')}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold', {
                        'bg-primary-soft text-primary': selected.status === 'active',
                        'bg-surface-hover text-content-muted': selected.status === 'planning',
                        'bg-success-soft text-success': selected.status === 'completed',
                      })}>
                        {selected.status === 'active' ? '진행중' : selected.status === 'planning' ? '계획중' : '완료'}
                      </span>
                      {isOverdue && <span className="text-[11px] text-danger font-semibold">기간 초과</span>}
                    </div>
                    <h2 className="text-lg font-bold text-content">{selected.name}</h2>
                    {selected.goal && (
                      <p className="text-sm text-content-muted mt-1 flex items-start gap-1.5">
                        <Target size={13} className="text-content-subtle shrink-0 mt-0.5" />{selected.goal}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setEditTarget(selected)} className="p-1.5 rounded text-content-subtle hover:text-primary hover:bg-primary-soft transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => { if (confirm('삭제?')) { remove(selected.id); setSelectedId(null) } }} className="p-1.5 rounded text-content-subtle hover:text-danger hover:bg-danger-soft transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* 기간 + 통계 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {selected.startDate && (
                    <div className="bg-canvas rounded-xl p-3">
                      <p className="text-[10px] text-content-subtle mb-0.5">기간</p>
                      <p className="text-xs font-semibold text-content">
                        {new Date(selected.startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        {' ~ '}
                        {selected.endDate ? new Date(selected.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '미정'}
                      </p>
                    </div>
                  )}
                  {daysLeft !== null && selected.status === 'active' && (
                    <div className="bg-canvas rounded-xl p-3">
                      <p className="text-[10px] text-content-subtle mb-0.5">남은 기간</p>
                      <p className={cn('text-xs font-semibold', isOverdue ? 'text-danger' : 'text-content')}>
                        {isOverdue ? `${Math.abs(daysLeft)}일 초과` : daysLeft === 0 ? '오늘 종료' : `D-${daysLeft}`}
                      </p>
                    </div>
                  )}
                  <div className="bg-canvas rounded-xl p-3">
                    <p className="text-[10px] text-content-subtle mb-0.5">작업 수</p>
                    <p className="text-xs font-semibold text-content">{done} / {total} 완료</p>
                  </div>
                  <div className="bg-canvas rounded-xl p-3">
                    <p className="text-[10px] text-content-subtle mb-1">진행률</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${completionRate}%` }} />
                      </div>
                      <span className="text-xs font-bold text-primary shrink-0">{completionRate}%</span>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-2 mt-4">
                  {selected.status === 'planning' && (
                    <button onClick={() => update(selected.id, { status: 'active' })}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors">
                      <Play size={14} /> 스프린트 시작
                    </button>
                  )}
                  {selected.status === 'active' && (
                    <button onClick={() => update(selected.id, { status: 'completed' })}
                      className="flex items-center gap-1.5 px-4 py-2 bg-success text-white text-sm rounded-lg hover:opacity-90 transition-colors">
                      <CheckCircle size={14} /> 스프린트 완료
                    </button>
                  )}
                  <button onClick={() => setShowBacklog(s => !s)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-line text-sm text-content-muted rounded-lg hover:border-primary/40 hover:text-primary hover:bg-primary-soft transition-colors">
                    <Package size={14} /> {showBacklog ? '백로그 닫기' : '백로그에서 추가'}
                  </button>
                </div>
              </div>
            )}

            {/* 번다운 차트 */}
            {burndownData.length > 0 && total > 0 && (
              <div className="bg-surface border border-line rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-content mb-4">번다운 차트</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={burndownData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v}개`]} />
                    <Legend iconType="circle" iconSize={8} />
                    <ReferenceLine y={0} stroke="var(--color-line)" />
                    <Line type="monotone" dataKey="ideal" name="이상적 진행" stroke="#94a3b8" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="actual" name="실제 진행" stroke="var(--primary)" dot={{ r: 3 }} strokeWidth={2} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 백로그 패널 */}
            {showBacklog && (
              <BacklogPanel projectId={projectId} sprintId={selected.id} onAdded={() => { refetch(); setShowBacklog(false) }} />
            )}

            {/* 스프린트 칸반 보드 */}
            <div>
              <h3 className="text-sm font-semibold text-content mb-3 flex items-center gap-2">
                스프린트 보드
                <span className="text-xs font-normal text-content-subtle">{total}개 작업</span>
              </h3>
              {boardLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-content-subtle" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {BOARD_COLS.map(col => {
                    const colItems = items.filter(i => i.status === col.key)
                    return (
                      <div
                        key={col.key}
                        className={cn('flex flex-col rounded-2xl border-2 bg-canvas transition-colors min-h-[200px]', col.cls,
                          draggingItem && draggingItem.status !== col.key && 'border-dashed border-primary/40 bg-primary-soft/20'
                        )}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDrop(col.key)}
                      >
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-line/60 shrink-0">
                          <span className="text-xs font-semibold text-content">{col.label}</span>
                          <span className="text-[10px] bg-surface-hover text-content-subtle px-1.5 py-0.5 rounded-full">{colItems.length}</span>
                        </div>
                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                          {colItems.map(item => (
                            <BoardCard key={item.id} item={item} onDragStart={() => setDraggingItem(item)} />
                          ))}
                          {colItems.length === 0 && (
                            <div className="flex items-center justify-center h-20 text-xs text-content-subtle italic">없음</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
