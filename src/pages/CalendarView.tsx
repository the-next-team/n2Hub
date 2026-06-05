import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Calendar,
  ClipboardList, Diamond, Bug, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../utils'

// ── 이벤트 타입 ────────────────────────────────────────────────────────────────

type EventKind = 'task' | 'milestone' | 'issue'

interface CalEvent {
  id:       string
  kind:     EventKind
  label:    string
  date:     string  // YYYY-MM-DD
  status:   string
  priority?: string
  extra?:   string  // 담당자 등
}

const KIND_CFG: Record<EventKind, {
  Icon: React.ElementType
  dot: string    // bg color for dot
  pill: string   // bg+text for pill
  label: string
}> = {
  task:      { Icon: ClipboardList, dot: 'bg-blue-500',   pill: 'bg-blue-50 text-blue-700 border border-blue-200',     label: 'WBS 작업' },
  milestone: { Icon: Diamond,       dot: 'bg-primary-soft0', pill: 'bg-primary-soft text-indigo-700 border border-indigo-200', label: '마일스톤' },
  issue:     { Icon: Bug,           dot: 'bg-red-500',    pill: 'bg-red-50 text-red-700 border border-red-200',          label: '이슈' },
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월',
                '7월', '8월', '9월', '10월', '11월', '12월']

function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── 훅: 캘린더 이벤트 패치 ────────────────────────────────────────────────────

function useCalendarEvents(projectId: string, from: string, to: string) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const results: CalEvent[] = []

    // 1) WBS 작업 (level 3, end_date 기준)
    try {
      const { data } = await supabase
        .from('wbs_tasks')
        .select('id, task_name, end_date, status, assignee_name, wbs_level')
        .eq('project_id', projectId)
        .eq('wbs_level', 3)
        .gte('end_date', from)
        .lte('end_date', to)
        .not('end_date', 'is', null)
      for (const row of data ?? []) {
        results.push({
          id:    row.id,
          kind:  'task',
          label: row.task_name,
          date:  row.end_date,
          status: row.status ?? '',
          extra: row.assignee_name ?? '',
        })
      }
    } catch { /* wbs_tasks 없을 시 무시 */ }

    // 2) 마일스톤
    try {
      const { data } = await supabase
        .from('milestones')
        .select('id, name, due_date, status')
        .eq('project_id', projectId)
        .gte('due_date', from)
        .lte('due_date', to)
        .not('due_date', 'is', null)
      for (const row of data ?? []) {
        results.push({
          id:    row.id,
          kind:  'milestone',
          label: row.name,
          date:  row.due_date,
          status: row.status ?? '',
        })
      }
    } catch { /* milestones 없을 시 무시 */ }

    // 3) 이슈
    try {
      const { data } = await supabase
        .from('issues')
        .select('id, title, due_date, status, priority, type')
        .eq('project_id', projectId)
        .gte('due_date', from)
        .lte('due_date', to)
        .not('due_date', 'is', null)
      for (const row of data ?? []) {
        results.push({
          id:       row.id,
          kind:     'issue',
          label:    row.title,
          date:     row.due_date,
          status:   row.status ?? '',
          priority: row.priority ?? '',
        })
      }
    } catch { /* issues 없을 시 무시 */ }

    setEvents(results)
    setLoading(false)
  }, [projectId, from, to])

  useEffect(() => { fetch() }, [fetch])

  return { events, loading, refetch: fetch }
}

// ── 이벤트 필 컴포넌트 ────────────────────────────────────────────────────────

function EventPill({ event, compact }: { event: CalEvent; compact?: boolean }) {
  const { pill, label } = KIND_CFG[event.kind]
  return (
    <div
      title={`[${label}] ${event.label}`}
      className={cn(
        'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-default',
        pill,
        compact && 'text-[9px] px-1 py-0.5',
      )}
    >
      <span className="truncate">{event.label}</span>
    </div>
  )
}

// ── 범례 ─────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-content-muted">
      {(Object.keys(KIND_CFG) as EventKind[]).map(k => (
        <div key={k} className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', KIND_CFG[k].dot)} />
          {KIND_CFG[k].label}
        </div>
      ))}
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

export default function CalendarView() {
  const { id: projectId = '' } = useParams<{ id: string }>()

  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate]     = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string>(toLocalDate(today))

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // 그리드 범위 계산
  const { gridStart, gridEnd, cells } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const gs = new Date(firstDay)
    gs.setDate(1 - firstDay.getDay())   // 해당 주의 일요일

    const lastDay = new Date(year, month + 1, 0)
    const ge = new Date(lastDay)
    const remaining = 6 - lastDay.getDay()
    ge.setDate(lastDay.getDate() + remaining)

    const cs: Date[] = []
    const d = new Date(gs)
    while (d <= ge || cs.length % 7 !== 0) {
      cs.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    // 최소 35칸 (5행), 필요시 42칸 (6행)
    while (cs.length < 35) { cs.push(new Date(d)); d.setDate(d.getDate() + 1) }

    return {
      gridStart: toLocalDate(gs),
      gridEnd:   toLocalDate(ge.getDate() > 0 ? ge : d),
      cells:     cs,
    }
  }, [year, month])

  const { events, loading } = useCalendarEvents(projectId, gridStart, gridEnd)

  // 날짜별 이벤트 맵
  const eventMap = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const ev of events) {
      const list = map.get(ev.date) ?? []
      list.push(ev)
      map.set(ev.date, list)
    }
    return map
  }, [events])

  const selectedEvents = useMemo(() => eventMap.get(selectedDay) ?? [], [eventMap, selectedDay])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))
  const goToday   = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDay(toLocalDate(today))
  }

  const todayStr = toLocalDate(today)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* ── 헤더 ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-content">
            {year}년 {MONTHS[month]}
          </h1>
          {loading && <Loader2 size={14} className="animate-spin text-content-subtle" />}
        </div>
        <div className="flex items-center gap-2">
          <Legend />
          <div className="w-px h-4 bg-line mx-1" />
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs rounded-lg border border-line bg-canvas text-content-muted hover:bg-surface-hover hover:text-content transition-colors"
          >
            오늘
          </button>
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-line hover:bg-surface-hover transition-colors text-content-muted">
            <ChevronLeft size={14} />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-line hover:bg-surface-hover transition-colors text-content-muted">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── 캘린더 + 상세 패널 ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── 캘린더 그리드 ── */}
        <div className="flex-1 overflow-auto p-4">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className={cn(
                  'py-1 text-center text-xs font-medium',
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-content-muted'
                )}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map(cell => {
              const ds        = toLocalDate(cell)
              const isToday   = ds === todayStr
              const isSel     = ds === selectedDay
              const isCurMo   = cell.getMonth() === month
              const dayEvents = eventMap.get(ds) ?? []
              const isWeekend = cell.getDay() === 0 || cell.getDay() === 6
              const MAX_SHOW  = 3

              return (
                <div
                  key={ds}
                  onClick={() => setSelectedDay(ds)}
                  className={cn(
                    'min-h-[90px] rounded-lg border p-1.5 cursor-pointer transition-colors',
                    isSel
                      ? 'border-primary bg-primary-soft ring-1 ring-primary/20'
                      : 'border-line hover:border-primary/40 hover:bg-surface-hover',
                    !isCurMo && 'opacity-40',
                  )}
                >
                  {/* 날짜 숫자 */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold',
                        isToday
                          ? 'bg-primary text-white'
                          : isWeekend
                            ? cell.getDay() === 0 ? 'text-red-500' : 'text-blue-500'
                            : isSel ? 'text-primary' : 'text-content',
                      )}
                    >
                      {cell.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5">
                        {(Object.keys(KIND_CFG) as EventKind[]).map(k => {
                          const cnt = dayEvents.filter(e => e.kind === k).length
                          if (!cnt) return null
                          return (
                            <span key={k} className={cn('w-1.5 h-1.5 rounded-full', KIND_CFG[k].dot)} />
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* 이벤트 필 */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, MAX_SHOW).map(ev => (
                      <EventPill key={ev.id} event={ev} compact />
                    ))}
                    {dayEvents.length > MAX_SHOW && (
                      <div className="text-[9px] text-content-subtle px-1">
                        +{dayEvents.length - MAX_SHOW}개 더
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 우측 상세 패널 ── */}
        <div className="w-64 shrink-0 border-l border-line bg-surface flex flex-col">
          {/* 패널 헤더 */}
          <div className="px-4 py-3 border-b border-line">
            <p className="text-xs font-semibold text-content">
              {(() => {
                const d = new Date(selectedDay + 'T00:00:00')
                return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
              })()}
            </p>
            <p className="text-xs text-content-muted mt-0.5">
              {selectedEvents.length > 0
                ? `${selectedEvents.length}개 일정`
                : '일정 없음'}
            </p>
          </div>

          {/* 이벤트 목록 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-content-subtle">
                <Calendar size={24} className="mb-2 opacity-30" />
                <p className="text-xs">일정이 없습니다</p>
              </div>
            ) : (
              selectedEvents.map(ev => {
                const { Icon, pill, label: kindLabel } = KIND_CFG[ev.kind]
                return (
                  <div key={ev.id} className={cn('rounded-lg p-2.5', pill)}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={11} className="shrink-0 opacity-70" />
                      <span className="text-[10px] font-medium opacity-70">{kindLabel}</span>
                    </div>
                    <p className="text-xs font-medium leading-snug">{ev.label}</p>
                    {ev.status && (
                      <p className="text-[10px] mt-1 opacity-70">상태: {ev.status}</p>
                    )}
                    {ev.extra && (
                      <p className="text-[10px] mt-0.5 opacity-70">담당: {ev.extra}</p>
                    )}
                    {ev.priority && (
                      <p className="text-[10px] mt-0.5 opacity-70">우선순위: {ev.priority}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* 이번 달 요약 */}
          <div className="border-t border-line p-3">
            <p className="text-xs font-semibold text-content-muted mb-2">이번 달 요약</p>
            {(Object.keys(KIND_CFG) as EventKind[]).map(k => {
              const cnt = events.filter(e => e.kind === k).length
              if (!cnt) return null
              const { dot, label } = KIND_CFG[k]
              return (
                <div key={k} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-full', dot)} />
                    <span className="text-xs text-content-muted">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-content">{cnt}</span>
                </div>
              )
            })}
            {events.length === 0 && (
              <p className="text-xs text-content-subtle">일정 없음</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
