import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pin, PinOff, Clock, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useParams } from 'react-router-dom'
import { cn } from '../utils'

interface TodayTask {
  id: string
  taskName: string
  projectId: string
  projectName: string
  endDate: string | null
  plannedProgress: number
  actualProgress: number
  status: string
  deficit: number        // planned - actual (0~1)
  isOverdue: boolean
  isDueToday: boolean
}

function pct(v: number) { return `${Math.round(v * 100)}%` }

interface WbsStat { actual: number; planned: number; total: number; done: number; delayed: number }

const STORAGE_KEY = 'n2hub-today-panel-pinned'

export default function TodayTaskPanel() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const { id: projectId } = useParams<{ id?: string }>()
  const [wbs, setWbs] = useState<WbsStat | null>(null)
  const [open, setOpen]     = useState(false)
  const [pinned, setPinned] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')
  const closeTimer          = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleClose = useCallback(() => {
    if (pinned) return
    closeTimer.current = setTimeout(() => setOpen(false), 300)
  }, [pinned])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }, [])
  const [tasks, setTasks] = useState<TodayTask[]>([])
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  // 오늘 날짜 기준 태스크 로드
  // WBS 전체 진척률
  useEffect(() => {
    if (!projectId || (!open && !pinned)) return
    supabase.from('wbs_tasks').select('actual_progress, planned_progress, status')
      .eq('project_id', projectId).eq('wbs_level', 3)
      .then(({ data }) => {
        if (!data?.length) { setWbs(null); return }
        const a = data.reduce((s, t) => s + (t.actual_progress ?? 0), 0) / data.length
        const p = data.reduce((s, t) => s + (t.planned_progress ?? 0), 0) / data.length
        setWbs({
          actual: Math.round(a * 100), planned: Math.round(p * 100),
          total: data.length,
          done: data.filter(t => t.status === 'completed').length,
          delayed: data.filter(t => t.status === 'delayed').length,
        })
      })
  }, [projectId, open, pinned])

  const fetchTasks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('wbs_tasks')
        .select('id, task_name, project_id, end_date, planned_progress, actual_progress, status')
        .eq('assignee_id', user.id)
        .neq('status', 'completed')
        .order('end_date', { ascending: true })

      // 프로젝트명 조회
      const projectIds = [...new Set((data ?? []).map(t => t.project_id))]
      const { data: projects } = await supabase
        .from('projects').select('id, name').in('id', projectIds)
      const pMap: Record<string, string> = {}
      for (const p of projects ?? []) pMap[p.id] = p.name

      const mapped: TodayTask[] = (data ?? [])
        .map(t => {
          const planned = t.planned_progress ?? 0
          const actual  = t.actual_progress  ?? 0
          const deficit = Math.max(0, planned - actual)
          const endDate = t.end_date
          const isOverdue  = !!endDate && endDate < today
          const isDueToday = endDate === today
          return {
            id: t.id, taskName: t.task_name, projectId: t.project_id,
            projectName: pMap[t.project_id] ?? '프로젝트',
            endDate, plannedProgress: planned, actualProgress: actual,
            status: t.status, deficit, isOverdue, isDueToday,
          }
        })
        // 오늘 마감 또는 초과 또는 진행률 미달인 것만
        .filter(t => t.isOverdue || t.isDueToday || t.deficit > 0.05)
        // 정렬: 초과 → 오늘 마감 → 진행률 미달 순
        .sort((a, b) => {
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
          if (a.isDueToday !== b.isDueToday) return a.isDueToday ? -1 : 1
          return b.deficit - a.deficit
        })

      setTasks(mapped)
    } finally { setLoading(false) }
  }, [user, today])

  useEffect(() => { if (open || pinned) fetchTasks() }, [open, pinned, fetchTasks])

  // 마우스 우측 끝 트리거 (딜레이 기반)
  useEffect(() => {
    if (pinned) return
    const onMouseMove = (e: MouseEvent) => {
      const nearRight = e.clientX >= window.innerWidth - 20
      if (nearRight) cancelClose()
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => document.removeEventListener('mousemove', onMouseMove)
  }, [pinned, cancelClose])

  const togglePin = () => {
    const next = !pinned
    setPinned(next)
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    if (next) fetchTasks()
  }

  const isVisible = open || pinned
  const overdueCount  = tasks.filter(t => t.isOverdue).length
  const todayCount    = tasks.filter(t => t.isDueToday && !t.isOverdue).length
  const deficitCount  = tasks.filter(t => !t.isOverdue && !t.isDueToday && t.deficit > 0.05).length

  return (
    <>
      {/* 우측 트리거 핫존 */}
      {!pinned && (
        <div
          className="fixed right-0 top-0 h-full w-4 z-40"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}

      {/* 슬라이드 패널 */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full z-50 flex flex-col',
          'bg-surface border-l border-line shadow-2xl',
          'transition-transform duration-200 ease-out',
          isVisible ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ width: 300 }}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-canvas shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-primary" />
            <span className="text-sm font-semibold text-content">오늘의 Task</span>
            {tasks.length > 0 && (
              <span className="text-[11px] bg-danger text-white rounded-full px-1.5 py-0.5 font-bold">
                {tasks.length}
              </span>
            )}
          </div>
          <button
            onClick={togglePin}
            title={pinned ? '고정 해제' : '고정'}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              pinned
                ? 'bg-primary-soft text-primary'
                : 'text-content-subtle hover:bg-surface-hover hover:text-content'
            )}
          >
            {pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        </div>

        {/* WBS 전체 진척률 */}
        {wbs && (
          <div className="px-4 py-3 border-b border-line shrink-0 bg-canvas">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-content-subtle">WBS 전체 진척률</span>
              <span className={cn('text-xs font-bold', wbs.actual >= wbs.planned ? 'text-success' : 'text-orange-500')}>
                {wbs.actual}%
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-content-subtle w-7 shrink-0">계획</span>
                <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-line rounded-full" style={{ width: `${wbs.planned}%` }} />
                </div>
                <span className="text-[10px] text-content-subtle w-6 text-right">{wbs.planned}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-content-subtle w-7 shrink-0">실제</span>
                <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', wbs.actual >= wbs.planned ? 'bg-success' : 'bg-orange-400')}
                       style={{ width: `${wbs.actual}%` }} />
                </div>
                <span className={cn('text-[10px] w-6 text-right font-medium', wbs.actual >= wbs.planned ? 'text-success' : 'text-orange-500')}>
                  {wbs.actual}%
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-content-subtle">
              <span>전체 {wbs.total}</span>
              <span className="text-success">완료 {wbs.done}</span>
              {wbs.delayed > 0 && <span className="text-danger font-medium">지연 {wbs.delayed}</span>}
              {wbs.actual < wbs.planned && (
                <span className="ml-auto text-orange-500 font-medium">-{wbs.planned - wbs.actual}% 미달</span>
              )}
            </div>
          </div>
        )}

        {/* 요약 뱃지 */}
        {tasks.length > 0 && (
          <div className="flex gap-2 px-4 py-2.5 border-b border-line shrink-0 bg-canvas">
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-danger-soft text-danger rounded-full font-semibold">
                <AlertTriangle size={10} /> 기간초과 {overdueCount}
              </span>
            )}
            {todayCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-warning-soft text-warning rounded-full font-semibold">
                <Clock size={10} /> 오늘마감 {todayCount}
              </span>
            )}
            {deficitCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full font-semibold">
                진행률미달 {deficitCount}
              </span>
            )}
          </div>
        )}

        {/* 태스크 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-content-subtle">로딩 중…</div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-content-subtle">
              <CheckCircle2 size={28} className="opacity-30" />
              <p className="text-xs">오늘 처리할 Task가 없습니다 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer group"
                  onClick={() => navigate(`/projects/${task.projectId}/tasks`)}
                >
                  {/* 태스크명 + 이동 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-content leading-snug line-clamp-2">{task.taskName}</p>
                      <p className="text-[10px] text-content-subtle mt-0.5">{task.projectName}</p>
                    </div>
                    <ChevronRight size={13} className="text-content-subtle opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
                  </div>

                  {/* 상태 뱃지 */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {task.isOverdue && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-danger-soft text-danger rounded font-semibold flex items-center gap-0.5">
                        <AlertTriangle size={9} />
                        {Math.ceil((Date.now() - new Date(task.endDate!).getTime()) / 86_400_000)}일 초과
                      </span>
                    )}
                    {task.isDueToday && !task.isOverdue && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-warning-soft text-warning rounded font-semibold">
                        오늘 마감
                      </span>
                    )}
                    {task.deficit > 0.05 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded font-semibold">
                        -{pct(task.deficit)} 미달
                      </span>
                    )}
                  </div>

                  {/* 진행률 바 */}
                  <div>
                    <div className="flex justify-between text-[10px] text-content-subtle mb-1">
                      <span>계획 {pct(task.plannedProgress)}</span>
                      <span className={task.deficit > 0.05 ? 'text-orange-600 font-semibold' : ''}>
                        실제 {pct(task.actualProgress)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden relative">
                      {/* 계획 */}
                      <div className="absolute h-full bg-line rounded-full"
                           style={{ width: pct(task.plannedProgress) }} />
                      {/* 실제 */}
                      <div className={cn('absolute h-full rounded-full',
                           task.deficit > 0.05 ? 'bg-orange-400' : 'bg-success')}
                           style={{ width: pct(task.actualProgress) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-4 py-2.5 border-t border-line text-[10px] text-content-subtle bg-canvas shrink-0">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} 기준
        </div>
      </div>
    </>
  )
}
