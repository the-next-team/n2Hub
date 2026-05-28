/**
 * GanttChart — WBS 기반 간트 차트
 *
 * - 기존 useTasks 데이터 그대로 활용 (start_date, end_date, actual_progress, status)
 * - 왼쪽 패널(고정) + 오른쪽 패널(가로 스크롤)
 * - sticky thead + sticky 첫 번째 컬럼으로 스크롤 시 헤더/레이블 고정
 * - 오늘 마커, 주 구분선, 계획/실제 이중 프로그레스 바
 */
import { useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, BarChart2, MoveRight } from 'lucide-react'
import { useTasks, type Task } from '../hooks/useTasks'

// ── 레이아웃 상수 ─────────────────────────────────────────
const ROW_H = 38        // 행 높이 px
const HEAD_H1 = 28      // 월 헤더 높이 px
const HEAD_H2 = 22      // 주 헤더 높이 px
const BAR_Y = 9         // 셀 상단에서 바 시작 y (px)
const BAR_H = 16        // 바 높이 px
const PAD_DAYS = 10     // 범위 앞뒤 여유 일수
const LEFT_W = 340      // 왼쪽 패널 너비 px

// ── 상태 색상 ─────────────────────────────────────────────
const SC: Record<string, { bar: string; plan: string; dot: string; label: string }> = {
  not_started: { bar: '#94a3b8', plan: '#e2e8f0', dot: '#94a3b8', label: '예정' },
  in_progress:  { bar: '#4f46e5', plan: '#c7d2fe', dot: '#4f46e5', label: '진행' },
  completed:    { bar: '#16a34a', plan: '#bbf7d0', dot: '#16a34a', label: '완료' },
  delayed:      { bar: '#dc2626', plan: '#fecaca', dot: '#dc2626', label: '지연' },
}

// ── 날짜 유틸 ─────────────────────────────────────────────
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

// ── 월 세그먼트 계산 ──────────────────────────────────────
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

// ── 주 구분선 x 좌표 ──────────────────────────────────────
function buildWeekX(vs: Date, total: number, cw: number): number[] {
  const xs: number[] = []
  let d = new Date(vs)
  // 첫 번째 월요일 찾기
  while (d.getDay() !== 1) d = addDays(d, 1)
  while (diffDays(vs, d) < total) {
    xs.push(diffDays(vs, d) * cw)
    d = addDays(d, 7)
  }
  return xs
}

// ── 레벨별 스타일 ─────────────────────────────────────────
function levelStyle(level: number): { bgRow: string; indent: number; fontW: string; nameSize: string } {
  switch (level) {
    case 1: return { bgRow: '#f8fafc', indent: 0,  fontW: '700', nameSize: '12px' }
    case 2: return { bgRow: '#ffffff', indent: 14, fontW: '600', nameSize: '12px' }
    default:return { bgRow: '#ffffff', indent: 28, fontW: '400', nameSize: '11.5px' }
  }
}

// ── GanttBar 컴포넌트 ─────────────────────────────────────
function GanttBar({
  task, vsDate, cellW: cw,
}: { task: Task; vsDate: Date; cellW: number }) {
  const s = parseDate(task.start_date)
  const e = parseDate(task.end_date)
  if (!s || !e) return null

  const x = Math.max(0, diffDays(vsDate, s)) * cw
  const rawW = (diffDays(s, e) + 1) * cw
  const w = Math.max(rawW, cw) // 최소 1일 너비

  const color = SC[task.status] ?? SC.not_started
  const actualW = Math.round(w * (task.actual_progress / 100))
  const plannedW = Math.round(w * (task.planned_progress / 100))

  return (
    <g>
      {/* 계획 진행률 (연한 색) */}
      <rect
        x={x} y={BAR_Y} width={w} height={BAR_H}
        rx={3} ry={3} fill={color.plan} />
      {/* 실제 진행률 (진한 색) */}
      {actualW > 0 && (
        <rect
          x={x} y={BAR_Y} width={actualW} height={BAR_H}
          rx={3} ry={3} fill={color.bar} />
      )}
      {/* 계획 진행 경계선 */}
      {plannedW > 0 && plannedW < w && (
        <line
          x1={x + plannedW} y1={BAR_Y - 2}
          x2={x + plannedW} y2={BAR_Y + BAR_H + 2}
          stroke={color.bar} strokeWidth="1.5" strokeDasharray="2 2" opacity="0.6" />
      )}
      {/* 진행률 텍스트 (바 안에) */}
      {w > 40 && (
        <text
          x={x + w / 2} y={BAR_Y + BAR_H / 2 + 1}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill={actualW > w / 2 ? '#ffffff' : color.bar}
          fontWeight="600">
          {task.actual_progress}%
        </text>
      )}
    </g>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function GanttChart() {
  const { id: projectId } = useParams<{ id: string }>()
  const { tasks, loading } = useTasks(projectId!)
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = startOfDay(new Date())

  // 뷰 범위 계산
  const { viewStart, totalDays, cw } = useMemo(() => {
    const withDates = tasks.filter(t => t.start_date && t.end_date)
    if (!withDates.length) {
      const vs = addDays(today, -PAD_DAYS)
      return { viewStart: vs, totalDays: 90, cw: cellWidth(90) }
    }
    const starts = withDates.map(t => parseDate(t.start_date)!.getTime())
    const ends   = withDates.map(t => parseDate(t.end_date)!.getTime())
    const minD = startOfDay(new Date(Math.min(...starts)))
    const maxD = startOfDay(new Date(Math.max(...ends)))
    const vs = addDays(minD, -PAD_DAYS)
    const ve = addDays(maxD, PAD_DAYS)
    const total = Math.max(diffDays(vs, ve), 30)
    return { viewStart: vs, totalDays: total, cw: cellWidth(total) }
  }, [tasks, today])

  const totalW = totalDays * cw
  const months = useMemo(() => buildMonths(viewStart, totalDays, cw), [viewStart, totalDays, cw])
  const weekXs = useMemo(() => buildWeekX(viewStart, totalDays, cw), [viewStart, totalDays, cw])
  const todayX = diffDays(viewStart, today) * cw

  // 오늘로 스크롤
  const scrollToToday = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayX - 200)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-content-muted text-sm">
        로딩 중…
      </div>
    )
  }

  if (!tasks.length) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <BarChart2 size={40} className="text-content-subtle" />
          <p className="text-sm text-content-muted">WBS 데이터가 없습니다.</p>
          <Link
            to={`/projects/${projectId}/tasks`}
            className="text-sm text-primary hover:underline"
          >
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
        <div className="flex items-center gap-1.5 text-xs text-content-muted min-w-0">
          <Link to="/projects" className="hover:text-content">프로젝트</Link>
          <ChevronRight size={12} />
          <Link to={`/projects/${projectId}/tasks`} className="hover:text-content">WBS</Link>
          <ChevronRight size={12} />
          <span className="text-content font-medium">간트 차트</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 범례 */}
          <div className="flex items-center gap-3 mr-2">
            {Object.entries(SC).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: v.bar }} />
                <span className="text-xs text-content-muted">{v.label}</span>
              </div>
            ))}
          </div>
          {/* 오늘로 이동 버튼 */}
          <button
            onClick={scrollToToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-content-muted hover:border-primary/40 hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <MoveRight size={12} />
            오늘
          </button>
        </div>
      </div>

      {/* ── 간트 본체 ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        style={{ position: 'relative' }}
      >
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            tableLayout: 'fixed',
            minWidth: LEFT_W + totalW,
          }}
        >
          {/* 열 너비 정의 */}
          <colgroup>
            <col style={{ width: LEFT_W }} />
            <col style={{ width: totalW }} />
          </colgroup>

          {/* ── 헤더 ── */}
          <thead>
            {/* 월 행 */}
            <tr>
              {/* 왼쪽 헤더 셀 */}
              <th
                rowSpan={2}
                style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 30,
                  width: LEFT_W, minWidth: LEFT_W, maxWidth: LEFT_W,
                  height: headH, background: '#f8fafc',
                  borderBottom: '1px solid #e4e4e7',
                  borderRight: '2px solid #e4e4e7',
                  padding: '0 12px',
                  textAlign: 'left', verticalAlign: 'middle',
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-content-muted">
                  <BarChart2 size={13} />
                  <span>WBS 작업</span>
                  <span className="ml-auto text-[10px] font-normal text-content-subtle">
                    계획/실적
                  </span>
                </div>
              </th>
              {/* 월 세그먼트 */}
              <th
                style={{
                  position: 'sticky', top: 0, zIndex: 20,
                  height: HEAD_H1, padding: 0,
                  background: '#f8fafc',
                  borderBottom: '1px solid #e4e4e7',
                }}
              >
                <div style={{ position: 'relative', width: totalW, height: HEAD_H1 }}>
                  {months.map((seg, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: seg.offset * cw,
                        top: 0,
                        width: seg.w,
                        height: HEAD_H1,
                        borderRight: '1px solid #e4e4e7',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#52525b',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {seg.w > 50 ? seg.label : ''}
                    </div>
                  ))}
                </div>
              </th>
            </tr>
            {/* 주 행 */}
            <tr>
              <th
                style={{
                  position: 'sticky', top: HEAD_H1, zIndex: 20,
                  height: HEAD_H2, padding: 0,
                  background: '#f8fafc',
                  borderBottom: '2px solid #e4e4e7',
                }}
              >
                <div style={{ position: 'relative', width: totalW, height: HEAD_H2 }}>
                  {/* 주 구분 날짜 */}
                  {weekXs.map((x, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute', left: x,
                        top: 0, height: HEAD_H2,
                        borderLeft: '1px solid #e4e4e7',
                        paddingLeft: 3,
                        display: 'flex', alignItems: 'center',
                        fontSize: 9.5, color: '#a1a1aa',
                        pointerEvents: 'none',
                      }}
                    >
                      {addDays(viewStart, Math.round(x / cw)).getDate()}
                    </div>
                  ))}
                  {/* 오늘 마커 (헤더) */}
                  {todayX >= 0 && todayX <= totalW && (
                    <div
                      style={{
                        position: 'absolute', left: todayX,
                        top: 0, height: HEAD_H2, width: 1,
                        background: '#ef4444', opacity: 0.8,
                        zIndex: 2,
                      }}
                    />
                  )}
                </div>
              </th>
            </tr>
          </thead>

          {/* ── 바디 ── */}
          <tbody>
            {tasks.map((task, rowIdx) => {
              const ls = levelStyle(task.wbs_level)
              const color = SC[task.status] ?? SC.not_started
              const isOdd = rowIdx % 2 === 1

              return (
                <tr key={task.id}>
                  {/* ── 왼쪽 레이블 셀 ── */}
                  <td
                    style={{
                      position: 'sticky', left: 0, zIndex: 10,
                      width: LEFT_W, minWidth: LEFT_W, maxWidth: LEFT_W,
                      height: ROW_H,
                      background: task.wbs_level === 1
                        ? '#f8fafc'
                        : isOdd ? '#fafafa' : '#ffffff',
                      borderBottom: '1px solid #f4f4f5',
                      borderRight: '2px solid #e4e4e7',
                      padding: `0 8px 0 ${ls.indent + 8}px`,
                      verticalAlign: 'middle',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* WBS 코드 */}
                      <span
                        style={{
                          fontSize: 10, color: '#a1a1aa', fontFamily: 'monospace',
                          flexShrink: 0, minWidth: 44,
                        }}
                      >
                        {task.wbs_code}
                      </span>
                      {/* 작업명 */}
                      <span
                        style={{
                          fontSize: ls.nameSize, fontWeight: ls.fontW,
                          color: task.wbs_level === 1 ? '#18181b' : '#3f3f46',
                          flex: 1, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={task.task_name}
                      >
                        {task.task_name}
                      </span>
                      {/* 상태 도트 */}
                      <span
                        style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: color.dot,
                        }}
                        title={color.label}
                      />
                    </div>
                    {/* 담당자 + 진행률 (레벨 3만) */}
                    {task.wbs_level === 3 && (task.assignee_name || task.actual_progress > 0) && (
                      <div className="flex items-center gap-1.5 mt-0.5" style={{ paddingLeft: 44 }}>
                        {task.assignee_name && (
                          <span style={{ fontSize: 9.5, color: '#a1a1aa' }}>{task.assignee_name}</span>
                        )}
                        {task.actual_progress > 0 && (
                          <span style={{ fontSize: 9.5, color: color.dot, fontWeight: 600 }}>
                            {task.actual_progress}%
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* ── 오른쪽 간트 셀 ── */}
                  <td
                    style={{
                      height: ROW_H, padding: 0, position: 'relative',
                      background: task.wbs_level === 1
                        ? '#f8fafc'
                        : isOdd ? '#fafafa' : '#ffffff',
                      borderBottom: '1px solid #f4f4f5',
                    }}
                  >
                    <svg
                      width={totalW} height={ROW_H}
                      style={{ display: 'block', overflow: 'visible' }}
                    >
                      {/* 주 구분선 */}
                      {weekXs.map((x, i) => (
                        <line key={i} x1={x} y1={0} x2={x} y2={ROW_H}
                          stroke="#e4e4e7" strokeWidth="1" />
                      ))}
                      {/* 오늘 마커 */}
                      {todayX >= 0 && todayX <= totalW && (
                        <line x1={todayX} y1={0} x2={todayX} y2={ROW_H}
                          stroke="#ef4444" strokeWidth="1.5" opacity="0.5" />
                      )}
                      {/* 간트 바 */}
                      <GanttBar task={task} vsDate={viewStart} cellW={cw} />
                    </svg>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── 하단 통계 ── */}
      <div className="shrink-0 border-t border-line bg-surface px-5 py-2 flex items-center gap-4 text-xs text-content-muted print:hidden">
        <span>전체 {tasks.length}개 작업</span>
        {Object.entries(SC).map(([k, v]) => {
          const cnt = tasks.filter(t => t.status === k).length
          if (!cnt) return null
          return (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: v.dot }} />
              {v.label} {cnt}
            </span>
          )
        })}
        <span className="ml-auto text-content-subtle">
          범위: {viewStart.toLocaleDateString('ko-KR')} ~ {addDays(viewStart, totalDays).toLocaleDateString('ko-KR')}
          &ensp;·&ensp;{cw}px/일
        </span>
      </div>
    </div>
  )
}
