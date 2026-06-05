/**
 * GanttChart — WBS 기반 간트 차트 + 마일스톤 관리
 *
 * - 기존 useTasks 데이터 그대로 활용
 * - 마일스톤: 다이아몬드 마커 + 우측 관리 패널
 * - sticky thead + sticky 첫 컬럼으로 스크롤 시 고정
 */
import { useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, BarChart2, MoveRight, Flag, Plus, Trash2, Check } from 'lucide-react'
import { useTasks, type Task } from '../hooks/useTasks'
import { useMilestones, type Milestone } from '../hooks/useMilestones'

// ── 레이아웃 상수 ──────────────────────────────────────────
const ROW_H      = 38
const HEAD_H1    = 28
const HEAD_H2    = 22
const BAR_Y      = 9
const BAR_H      = 16
const MS_ROW_H   = 44        // 마일스톤 행 높이
const MS_DIA     = 10        // 다이아몬드 반경
const PAD_DAYS   = 10
const LEFT_W     = 340

// ── 상태 색상 ──────────────────────────────────────────────
const SC: Record<string, { bar: string; plan: string; dot: string; label: string }> = {
  not_started: { bar: '#94a3b8', plan: '#e2e8f0', dot: '#94a3b8', label: '예정'  },
  in_progress:  { bar: '#4f46e5', plan: '#c7d2fe', dot: '#4f46e5', label: '진행'  },
  completed:    { bar: '#16a34a', plan: '#bbf7d0', dot: '#16a34a', label: '완료'  },
  delayed:      { bar: '#dc2626', plan: '#fecaca', dot: '#dc2626', label: '지연'  },
}
const MS_COLOR: Record<Milestone['status'], { fill: string; stroke: string; text: string }> = {
  planned: { fill: '#eef2ff', stroke: '#4f46e5', text: '#4f46e5' },
  done:    { fill: 'var(--color-success-soft)', stroke: '#16a34a', text: '#16a34a' },
  missed:  { fill: '#fff1f2', stroke: '#dc2626', text: '#dc2626' },
}
const MS_STATUS_LABEL: Record<Milestone['status'], string> = {
  planned: '예정', done: '완료', missed: '초과',
}

// ── 날짜 유틸 ──────────────────────────────────────────────
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}
function cellWidth(totalDays: number): number {
  if (totalDays <= 60)  return 36
  if (totalDays <= 120) return 28
  if (totalDays <= 240) return 20
  if (totalDays <= 365) return 15
  return 10
}
function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
function toInputDate(s: string | null): string {
  return s ?? ''
}

// ── 헤더 세그먼트 ─────────────────────────────────────────
interface MonthSeg { label: string; offset: number; days: number; w: number }
function buildMonths(vs: Date, total: number, cw: number): MonthSeg[] {
  const segs: MonthSeg[] = []
  let cur = new Date(vs), off = 0
  const KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  while (off < total) {
    const y = cur.getFullYear(), m = cur.getMonth()
    const rem = daysInMonth(y, m) - cur.getDate() + 1
    const days = Math.min(rem, total - off)
    segs.push({ label: `${y}년 ${KR[m]}`, offset: off, days, w: days * cw })
    off += days
    cur = new Date(y, m + 1, 1)
  }
  return segs
}
function buildWeekX(vs: Date, total: number, cw: number): number[] {
  const xs: number[] = []
  let d = new Date(vs)
  while (d.getDay() !== 1) d = addDays(d, 1)
  while (diffDays(vs, d) < total) {
    xs.push(diffDays(vs, d) * cw)
    d = addDays(d, 7)
  }
  return xs
}
function levelStyle(level: number): { indent: number; fontW: string; nameSize: string } {
  switch (level) {
    case 1: return { indent: 0,  fontW: '700', nameSize: '12px' }
    case 2: return { indent: 14, fontW: '600', nameSize: '12px' }
    default:return { indent: 28, fontW: '400', nameSize: '11.5px' }
  }
}

// ── 간트 바 ────────────────────────────────────────────────
function GanttBar({ task, vsDate, cellW: cw }: { task: Task; vsDate: Date; cellW: number }) {
  const s = parseDate(task.start_date), e = parseDate(task.end_date)
  if (!s || !e) return null
  const x = Math.max(0, diffDays(vsDate, s)) * cw
  const w = Math.max((diffDays(s, e) + 1) * cw, cw)
  const color = SC[task.status] ?? SC.not_started
  const actualW = Math.round(w * (task.actual_progress / 100))
  const plannedW = Math.round(w * (task.planned_progress / 100))
  return (
    <g>
      <rect x={x} y={BAR_Y} width={w} height={BAR_H} rx={3} fill={color.plan} />
      {actualW > 0 && <rect x={x} y={BAR_Y} width={actualW} height={BAR_H} rx={3} fill={color.bar} />}
      {plannedW > 0 && plannedW < w && (
        <line x1={x + plannedW} y1={BAR_Y - 2} x2={x + plannedW} y2={BAR_Y + BAR_H + 2}
          stroke={color.bar} strokeWidth="1.5" strokeDasharray="2 2" opacity="0.6" />
      )}
      {w > 40 && (
        <text x={x + w / 2} y={BAR_Y + BAR_H / 2 + 1}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill={actualW > w / 2 ? 'var(--color-surface)' : color.bar} fontWeight="600">
          {task.actual_progress}%
        </text>
      )}
    </g>
  )
}

// ── 마일스톤 관리 패널 ──────────────────────────────────────
function MilestonePanel({
  milestones,
  onClose,
  onCreate,
  onUpdate,
  onRemove,
}: {
  milestones: Milestone[]
  onClose: () => void
  onCreate: (name: string, date: string | null) => Promise<void>
  onUpdate: (id: string, changes: Partial<Milestone>) => Promise<void>
  onRemove: (id: string) => void
}) {
  const [name, setName]   = useState('')
  const [date, setDate]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setSaving(true)
    try { await onCreate(name, date || null) } finally { setSaving(false) }
    setName(''); setDate('')
  }

  return (
    <div className="w-64 shrink-0 border-l border-line bg-surface flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2 text-sm font-semibold text-content">
          <Flag size={14} className="text-primary" />
          마일스톤
        </div>
        <button onClick={onClose}
          className="text-content-muted hover:text-content rounded p-0.5 hover:bg-surface-hover transition-colors">
          ✕
        </button>
      </div>

      {/* 추가 폼 */}
      <div className="px-3 py-3 border-b border-line space-y-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="마일스톤 이름"
          className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-sm text-content placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim() || saving}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          <Plus size={13} />
          {saving ? '추가 중…' : '추가'}
        </button>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto divide-y divide-line">
        {milestones.length === 0 ? (
          <p className="text-xs text-content-subtle text-center py-6">마일스톤이 없습니다.</p>
        ) : (
          milestones.map(ms => {
            const c = MS_COLOR[ms.status]
            const isPast = ms.due_date ? ms.due_date < new Date().toISOString().slice(0,10) : false
            return (
              <div key={ms.id} className="px-3 py-2.5 group">
                <div className="flex items-start gap-2">
                  {/* 다이아몬드 아이콘 */}
                  <svg width="14" height="14" viewBox="-7 -7 14 14" className="shrink-0 mt-0.5">
                    <polygon points="0,-6 6,0 0,6 -6,0"
                      fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-content truncate">{ms.name}</p>
                    <p className="text-[10px] text-content-muted mt-0.5">
                      {fmtDate(ms.due_date)}
                      {isPast && ms.status === 'planned' && (
                        <span className="ml-1 text-danger">초과</span>
                      )}
                    </p>
                  </div>
                  {/* 액션 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {ms.status !== 'done' && (
                      <button
                        onClick={() => onUpdate(ms.id, { status: 'done' })}
                        title="완료 처리"
                        className="p-0.5 rounded text-success hover:bg-success-soft transition-colors"
                      >
                        <Check size={11} />
                      </button>
                    )}
                    {ms.status === 'done' && (
                      <button
                        onClick={() => onUpdate(ms.id, { status: 'planned' })}
                        title="예정으로 되돌리기"
                        className="p-0.5 rounded text-content-muted hover:bg-surface-hover transition-colors"
                      >
                        <Check size={11} />
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(ms.id)}
                      className="p-0.5 rounded text-content-muted hover:text-danger hover:bg-danger-soft transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                {/* 상태 배지 (인라인 편집) */}
                <div className="mt-1.5 ml-6">
                  <select
                    value={ms.status}
                    onChange={e => onUpdate(ms.id, { status: e.target.value as Milestone['status'] })}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-line bg-surface text-content-muted focus:outline-none"
                    style={{ color: c.text }}
                  >
                    <option value="planned">예정</option>
                    <option value="done">완료</option>
                    <option value="missed">초과</option>
                  </select>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function GanttChart() {
  const { id: projectId } = useParams<{ id: string }>()
  const { tasks, loading }                           = useTasks(projectId!)
  const { milestones, create, update, remove }       = useMilestones(projectId!)
  const scrollRef                                    = useRef<HTMLDivElement>(null)
  const [showMsPanel, setShowMsPanel]                = useState(false)

  const today = startOfDay(new Date())

  // ── 뷰 범위 계산 ────────────────────────────────────────
  const { viewStart, totalDays, cw } = useMemo(() => {
    const withDates = [
      ...tasks.filter(t => t.start_date && t.end_date),
    ]
    const msWithDates = milestones.filter(m => m.due_date)

    if (!withDates.length && !msWithDates.length) {
      const vs = addDays(today, -PAD_DAYS)
      return { viewStart: vs, totalDays: 90, cw: cellWidth(90) }
    }

    const starts = withDates.map(t => parseDate(t.start_date)!.getTime())
    const ends   = [
      ...withDates.map(t => parseDate(t.end_date)!.getTime()),
      ...msWithDates.map(m => parseDate(m.due_date)!.getTime()),
    ]

    const minD = starts.length
      ? startOfDay(new Date(Math.min(...starts)))
      : startOfDay(new Date(Math.min(...ends)))
    const maxD = startOfDay(new Date(Math.max(...ends)))

    const vs = addDays(minD, -PAD_DAYS)
    const ve = addDays(maxD, PAD_DAYS)
    const total = Math.max(diffDays(vs, ve), 30)
    return { viewStart: vs, totalDays: total, cw: cellWidth(total) }
  }, [tasks, milestones, today])

  const totalW  = totalDays * cw
  const months  = useMemo(() => buildMonths(viewStart, totalDays, cw),  [viewStart, totalDays, cw])
  const weekXs  = useMemo(() => buildWeekX(viewStart, totalDays, cw),   [viewStart, totalDays, cw])
  const todayX  = diffDays(viewStart, today) * cw

  const scrollToToday = () => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - 200)
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-content-muted text-sm">로딩 중…</div>
  }

  if (!tasks.length) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <BarChart2 size={40} className="text-content-subtle" />
          <p className="text-sm text-content-muted">WBS 데이터가 없습니다.</p>
          <Link to={`/projects/${projectId}/tasks`} className="text-sm text-primary hover:underline">
            WBS 작업관리에서 데이터를 등록하세요 →
          </Link>
        </div>
      </div>
    )
  }

  const headH = HEAD_H1 + HEAD_H2

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 상단 툴바 ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-line bg-surface shrink-0 print:hidden">
        <div className="flex items-center gap-1.5 text-xs text-content-muted">
          <Link to="/projects" className="hover:text-content">프로젝트</Link>
          <ChevronRight size={12} />
          <Link to={`/projects/${projectId}/tasks`} className="hover:text-content">WBS</Link>
          <ChevronRight size={12} />
          <span className="text-content font-medium">간트 차트</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 범례 */}
          <div className="hidden sm:flex items-center gap-3 mr-2">
            {Object.entries(SC).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: v.bar }} />
                <span className="text-xs text-content-muted">{v.label}</span>
              </div>
            ))}
          </div>
          {/* 마일스톤 패널 토글 */}
          <button
            onClick={() => setShowMsPanel(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              showMsPanel
                ? 'border-primary/40 bg-primary-soft text-primary'
                : 'border-line text-content-muted hover:border-primary/40 hover:text-primary hover:bg-primary-soft'
            }`}
          >
            <Flag size={12} />
            마일스톤
            {milestones.length > 0 && (
              <span className="ml-0.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0 rounded-full">
                {milestones.length}
              </span>
            )}
          </button>
          {/* 오늘로 이동 */}
          <button
            onClick={scrollToToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-content-muted hover:border-primary/40 hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <MoveRight size={12} />
            오늘
          </button>
        </div>
      </div>

      {/* ── 본체 (간트 + 마일스톤 패널) ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── 간트 스크롤 영역 ── */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <table style={{
            borderCollapse: 'separate', borderSpacing: 0,
            tableLayout: 'fixed',
            minWidth: LEFT_W + totalW,
          }}>
            <colgroup>
              <col style={{ width: LEFT_W }} />
              <col style={{ width: totalW }} />
            </colgroup>

            {/* ── 헤더 ── */}
            <thead>
              {/* 월 행 */}
              <tr>
                <th rowSpan={2} style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 30,
                  width: LEFT_W, height: headH,
                  background: 'var(--color-canvas)',
                  borderBottom: '1px solid var(--color-line)',
                  borderRight: '2px solid var(--color-line)',
                  padding: '0 12px', textAlign: 'left', verticalAlign: 'middle',
                }}>
                  <div className="flex items-center gap-2 text-xs font-semibold text-content-muted">
                    <BarChart2 size={13} />
                    <span>WBS 작업</span>
                    <span className="ml-auto text-[10px] font-normal text-content-subtle">계획/실적</span>
                  </div>
                </th>
                <th style={{
                  position: 'sticky', top: 0, zIndex: 20,
                  height: HEAD_H1, padding: 0,
                  background: 'var(--color-canvas)',
                  borderBottom: '1px solid var(--color-line)',
                }}>
                  <div style={{ position: 'relative', width: totalW, height: HEAD_H1 }}>
                    {months.map((seg, i) => (
                      <div key={i} style={{
                        position: 'absolute', left: seg.offset * cw, top: 0,
                        width: seg.w, height: HEAD_H1,
                        borderRight: '1px solid var(--color-line)',
                        display: 'flex', alignItems: 'center', paddingLeft: 8,
                        fontSize: 11, fontWeight: 600, color: 'var(--color-content-muted)',
                        overflow: 'hidden', whiteSpace: 'nowrap',
                      }}>
                        {seg.w > 50 ? seg.label : ''}
                      </div>
                    ))}
                  </div>
                </th>
              </tr>
              {/* 주 행 */}
              <tr>
                <th style={{
                  position: 'sticky', top: HEAD_H1, zIndex: 20,
                  height: HEAD_H2, padding: 0,
                  background: 'var(--color-canvas)',
                  borderBottom: '2px solid var(--color-line)',
                }}>
                  <div style={{ position: 'relative', width: totalW, height: HEAD_H2 }}>
                    {weekXs.map((x, i) => (
                      <div key={i} style={{
                        position: 'absolute', left: x, top: 0, height: HEAD_H2,
                        borderLeft: '1px solid var(--color-line)',
                        paddingLeft: 3,
                        display: 'flex', alignItems: 'center',
                        fontSize: 9.5, color: 'var(--color-content-subtle)',
                      }}>
                        {addDays(viewStart, Math.round(x / cw)).getDate()}
                      </div>
                    ))}
                    {todayX >= 0 && todayX <= totalW && (
                      <div style={{
                        position: 'absolute', left: todayX, top: 0,
                        height: HEAD_H2, width: 1,
                        background: '#ef4444', opacity: 0.8, zIndex: 2,
                      }} />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            {/* ── 바디: 태스크 행 ── */}
            <tbody>
              {tasks.map((task, rowIdx) => {
                const ls = levelStyle(task.wbs_level)
                const color = SC[task.status] ?? SC.not_started
                const isOdd = rowIdx % 2 === 1
                const rowBg = task.wbs_level === 1 ? 'var(--color-canvas)' : isOdd ? 'var(--color-canvas)' : 'var(--color-surface)'

                return (
                  <tr key={task.id}>
                    {/* 왼쪽 레이블 */}
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 10,
                      width: LEFT_W, height: ROW_H,
                      background: rowBg,
                      borderBottom: '1px solid var(--color-line)',
                      borderRight: '2px solid var(--color-line)',
                      padding: `0 8px 0 ${ls.indent + 8}px`,
                      verticalAlign: 'middle',
                    }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span style={{ fontSize: 10, color: 'var(--color-content-subtle)', fontFamily: 'monospace', flexShrink: 0, minWidth: 44 }}>
                          {task.wbs_code}
                        </span>
                        <span style={{
                          fontSize: ls.nameSize, fontWeight: ls.fontW,
                          color: task.wbs_level === 1 ? '#18181b' : '#3f3f46',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={task.task_name}>
                          {task.task_name}
                        </span>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: color.dot }} />
                      </div>
                      {task.wbs_level === 3 && (task.assignee_name || task.actual_progress > 0) && (
                        <div className="flex items-center gap-1.5 mt-0.5" style={{ paddingLeft: 44 }}>
                          {task.assignee_name && <span style={{ fontSize: 9.5, color: 'var(--color-content-subtle)' }}>{task.assignee_name}</span>}
                          {task.actual_progress > 0 && <span style={{ fontSize: 9.5, color: color.dot, fontWeight: 600 }}>{task.actual_progress}%</span>}
                        </div>
                      )}
                    </td>
                    {/* 간트 셀 */}
                    <td style={{ height: ROW_H, padding: 0, position: 'relative', background: rowBg, borderBottom: '1px solid var(--color-line)' }}>
                      <svg width={totalW} height={ROW_H} style={{ display: 'block', overflow: 'visible' }}>
                        {weekXs.map((x, i) => <line key={i} x1={x} y1={0} x2={x} y2={ROW_H} stroke="var(--color-line)" strokeWidth="1" />)}
                        {todayX >= 0 && todayX <= totalW && (
                          <line x1={todayX} y1={0} x2={todayX} y2={ROW_H} stroke="#ef4444" strokeWidth="1.5" opacity="0.5" />
                        )}
                        <GanttBar task={task} vsDate={viewStart} cellW={cw} />
                      </svg>
                    </td>
                  </tr>
                )
              })}

              {/* ── 마일스톤 행 ── */}
              {milestones.length > 0 && (
                <tr>
                  {/* 왼쪽: 레이블 */}
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 10,
                    width: LEFT_W, height: MS_ROW_H,
                    background: 'var(--color-success-soft)',
                    borderTop: '2px solid var(--color-line)',
                    borderRight: '2px solid var(--color-line)',
                    padding: '0 12px',
                    verticalAlign: 'middle',
                  }}>
                    <div className="flex items-center gap-2">
                      <Flag size={11} className="text-primary shrink-0" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-content)' }}>마일스톤</span>
                      <span style={{ fontSize: 10, color: 'var(--color-content-subtle)' }}>{milestones.length}개</span>
                    </div>
                  </td>
                  {/* 오른쪽: 다이아몬드 마커들 */}
                  <td style={{ height: MS_ROW_H, padding: 0, background: 'var(--color-success-soft)', borderTop: '2px solid var(--color-line)' }}>
                    <svg width={totalW} height={MS_ROW_H} style={{ display: 'block', overflow: 'visible' }}>
                      {/* 주 구분선 */}
                      {weekXs.map((x, i) => <line key={i} x1={x} y1={0} x2={x} y2={MS_ROW_H} stroke="var(--color-line)" strokeWidth="1" />)}
                      {/* 오늘 */}
                      {todayX >= 0 && todayX <= totalW && (
                        <line x1={todayX} y1={0} x2={todayX} y2={MS_ROW_H} stroke="#ef4444" strokeWidth="1.5" opacity="0.4" />
                      )}
                      {/* 마일스톤 다이아몬드 */}
                      {milestones.map(ms => {
                        const d = parseDate(ms.due_date)
                        if (!d) return null
                        const x = diffDays(viewStart, d) * cw
                        if (x < -MS_DIA || x > totalW + MS_DIA) return null
                        const cy = MS_ROW_H / 2
                        const c = MS_COLOR[ms.status]
                        const pts = `${x},${cy - MS_DIA} ${x + MS_DIA},${cy} ${x},${cy + MS_DIA} ${x - MS_DIA},${cy}`
                        return (
                          <g key={ms.id}>
                            <polygon points={pts} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
                            <text x={x} y={cy - MS_DIA - 3}
                              textAnchor="middle" fontSize="9" fill={c.text} fontWeight="600">
                              {ms.name.length > 8 ? ms.name.slice(0, 7) + '…' : ms.name}
                            </text>
                            <text x={x} y={cy + MS_DIA + 10}
                              textAnchor="middle" fontSize="8.5" fill="#a1a1aa">
                              {fmtDate(ms.due_date)}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── 마일스톤 관리 패널 ── */}
        {showMsPanel && (
          <MilestonePanel
            milestones={milestones}
            onClose={() => setShowMsPanel(false)}
            onCreate={create}
            onUpdate={update}
            onRemove={remove}
          />
        )}
      </div>

      {/* ── 하단 통계 ── */}
      <div className="shrink-0 border-t border-line bg-surface px-5 py-2 flex items-center gap-4 text-xs text-content-muted print:hidden">
        <span>작업 {tasks.length}개</span>
        {Object.entries(SC).map(([k, v]) => {
          const cnt = tasks.filter(t => t.status === k).length
          return cnt ? (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: v.dot }} />
              {v.label} {cnt}
            </span>
          ) : null
        })}
        {milestones.length > 0 && (
          <span className="flex items-center gap-1 border-l border-line pl-4">
            <Flag size={10} className="text-primary" />
            마일스톤 {milestones.length}개
            &nbsp;·&nbsp;
            완료 {milestones.filter(m => m.status === 'done').length}
          </span>
        )}
        <span className="ml-auto text-content-subtle">
          {viewStart.toLocaleDateString('ko-KR')} ~ {addDays(viewStart, totalDays).toLocaleDateString('ko-KR')}
          &ensp;·&ensp;{cw}px/일
        </span>
      </div>
    </div>
  )
}
