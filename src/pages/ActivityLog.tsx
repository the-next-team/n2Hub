import { useParams, Link } from 'react-router-dom'
import {
  FileText, Bug, MessageSquare, Diamond,
  CheckSquare, Activity, Loader2, RefreshCw,
} from 'lucide-react'
import { useActivityLog, type ActivityEvent, type ActivityKind } from '../hooks/useActivityLog'
import { cn } from '../utils'

// ── 종류별 설정 ───────────────────────────────────────────────────────────────

const KIND_CFG: Record<ActivityKind, {
  Icon: React.ElementType
  dot: string
  label: string
}> = {
  document_saved:    { Icon: FileText,     dot: 'bg-blue-500',    label: '문서 저장' },
  issue_created:     { Icon: Bug,          dot: 'bg-red-500',     label: '이슈 생성' },
  issue_updated:     { Icon: Bug,          dot: 'bg-orange-400',  label: '이슈 변경' },
  comment_posted:    { Icon: MessageSquare,dot: 'bg-teal-500',    label: '댓글' },
  milestone_created: { Icon: Diamond,      dot: 'bg-primary-soft0',  label: '마일스톤' },
  task_updated:      { Icon: CheckSquare,  dot: 'bg-green-500',   label: '작업 변경' },
}

// ── 날짜 그룹 레이블 ──────────────────────────────────────────────────────────

function dateGroup(ts: string): string {
  const d = new Date(ts)
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.floor((today.getTime() - new Date(d.toDateString()).getTime()) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7)  return `${diff}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function timeStr(ts: string): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// ── 이벤트 항목 ───────────────────────────────────────────────────────────────

function EventItem({ event }: { event: ActivityEvent }) {
  const { Icon, dot } = KIND_CFG[event.kind]
  const inner = (
    <div className="flex items-start gap-3 group">
      {/* 점 */}
      <div className="relative flex flex-col items-center shrink-0 mt-1">
        <span className={cn('w-2.5 h-2.5 rounded-full border-2 border-canvas', dot)} />
      </div>

      {/* 내용 */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] text-content-subtle font-mono">{timeStr(event.ts)}</span>
          {event.actor && (
            <span className="text-xs font-semibold text-content">{event.actor}</span>
          )}
          <span className="text-xs text-content-muted">{event.summary}</span>
        </div>
        {event.detail && (
          <p className="text-xs text-content-subtle mt-0.5 line-clamp-2">{event.detail}</p>
        )}
      </div>

      {/* 아이콘 */}
      <Icon size={12} className="shrink-0 text-content-subtle mt-1.5 opacity-60" />
    </div>
  )

  if (event.link) {
    return (
      <Link to={event.link} className="block hover:bg-surface-hover rounded-lg px-3 py-1 -mx-3 transition-colors">
        {inner}
      </Link>
    )
  }
  return <div className="px-3 -mx-3">{inner}</div>
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

export default function ActivityLog() {
  const { id: projectId = '' } = useParams<{ id: string }>()
  const { events, loading, refetch } = useActivityLog(projectId)

  // 날짜별 그룹화
  const groups: { label: string; events: ActivityEvent[] }[] = []
  for (const ev of events) {
    const label = dateGroup(ev.ts)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.events.push(ev)
    else groups.push({ label, events: [ev] })
  }

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-line">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-content">활동 로그</h1>
          {loading && <Loader2 size={14} className="animate-spin text-content-subtle" />}
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-line text-content-muted hover:bg-surface-hover transition-colors"
        >
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-2 text-content-muted">
            <Loader2 size={16} className="animate-spin" /> 불러오는 중…
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-content-subtle">
            <Activity size={32} className="mb-3 opacity-30" />
            <p className="text-sm">활동 내역이 없습니다.</p>
          </div>
        )}

        {!loading && groups.map(group => (
          <div key={group.label} className="px-6 py-4">
            {/* 날짜 구분선 */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold text-content-muted bg-surface-hover px-2 py-0.5 rounded-full">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-line" />
            </div>

            {/* 이벤트 목록 (타임라인 선) */}
            <div className="relative ml-1.5">
              {/* 수직선 */}
              <div className="absolute left-[4px] top-2 bottom-0 w-px bg-line" />
              <div className="space-y-0.5">
                {group.events.map(ev => <EventItem key={ev.id} event={ev} />)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 범례 */}
      {!loading && events.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-3 px-6 py-3 border-t border-line bg-surface">
          {(Object.keys(KIND_CFG) as ActivityKind[]).map(k => (
            <div key={k} className="flex items-center gap-1.5 text-[10px] text-content-subtle">
              <span className={cn('w-2 h-2 rounded-full', KIND_CFG[k].dot)} />
              {KIND_CFG[k].label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
