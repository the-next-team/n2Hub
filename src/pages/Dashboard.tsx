import { Link } from 'react-router-dom'
import {
  FolderKanban, FileText, CheckCircle, Clock,
  ChevronRight, AlertCircle, ClipboardList, Loader2,
} from 'lucide-react'
import { useProjects } from '../hooks/useProject'
import { useMyTasks } from '../hooks/useMyTasks'
import { formatDate } from '../utils'
import { Card, PageHeader, SectionTitle } from '../components/ui'

const STATUS_LABEL = {
  not_started: '예정',
  in_progress:  '진행중',
  completed:    '완료',
  delayed:      '지연',
} as const

const STATUS_COLOR = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  completed:    'bg-green-100 text-green-700',
  delayed:      'bg-red-100 text-red-700',
} as const

function daysLeft(endDate: string | null): { label: string; urgent: boolean } {
  if (!endDate) return { label: '—', urgent: false }
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { label: `${Math.abs(days)}일 초과`, urgent: true }
  if (days === 0) return { label: '오늘 마감', urgent: true }
  if (days <= 3)  return { label: `D-${days}`, urgent: true }
  return { label: `D-${days}`, urgent: false }
}

export default function Dashboard() {
  const { projects, loading: projLoading } = useProjects()
  const { tasks: myTasks, loading: myLoading, overdue, dueSoon } = useMyTasks()

  const activeCount   = projects.filter(p => p.status === 'active').length
  const archivedCount = projects.filter(p => p.status === 'archived').length

  const stats = [
    {
      label: '전체 프로젝트',
      value: projLoading ? '-' : String(projects.length),
      icon: FolderKanban,
      color: 'text-primary bg-primary-soft',
    },
    {
      label: '진행중 프로젝트',
      value: projLoading ? '-' : String(activeCount),
      icon: Clock,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: '내 미완료 작업',
      value: myLoading ? '-' : String(myTasks.length),
      icon: ClipboardList,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: '마감 7일 이내',
      value: myLoading ? '-' : String(dueSoon.length + overdue.length),
      icon: AlertCircle,
      color: dueSoon.length + overdue.length > 0
        ? 'text-red-600 bg-red-50'
        : 'text-green-600 bg-green-50',
    },
  ]

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="대시보드"
        description="내 프로젝트 현황을 한눈에 확인하세요."
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-5">
            <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>
              <Icon size={20} />
            </div>
            <div className="text-2xl font-bold text-content">{value}</div>
            <div className="text-sm text-content-muted mt-1">{label}</div>
          </Card>
        ))}
      </div>

      {/* 내 작업 */}
      <Card>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <SectionTitle>내 작업 / 내 마감</SectionTitle>
          {!myLoading && myTasks.length > 0 && (
            <span className="text-xs text-content-subtle">{myTasks.length}개 미완료</span>
          )}
        </div>

        {myLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 size={22} className="animate-spin text-content-subtle" />
          </div>
        ) : myTasks.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
            <p className="text-sm text-content-subtle">배정된 작업이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {/* 초과/임박 작업 먼저 */}
            {[...overdue, ...dueSoon.filter(t => !overdue.includes(t))].length > 0 && (
              <div className="px-6 py-2 bg-red-50 text-xs text-red-600 font-medium">
                ⚠ 마감 초과 {overdue.length}개 · 7일 이내 {dueSoon.length}개
              </div>
            )}
            {myTasks.map(task => {
              const { label: dayLabel, urgent } = daysLeft(task.end_date)
              return (
                <Link
                  key={task.id}
                  to={`/projects/${task.project_id}/tasks`}
                  className="flex items-center gap-4 px-6 py-3 hover:bg-surface-hover transition-colors"
                >
                  {/* 진행률 링 */}
                  <div className="relative shrink-0 w-8 h-8">
                    <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
                      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor"
                        strokeWidth="3" className="text-line" />
                      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor"
                        strokeWidth="3" strokeDasharray={`${75.4 * task.actual_progress} 75.4`}
                        className={task.actual_progress >= task.planned_progress ? 'text-green-500' : 'text-primary'} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-content">
                      {Math.round(task.actual_progress * 100)}
                    </span>
                  </div>

                  {/* 작업 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-content-subtle">{task.wbs_code}</span>
                      <span className="text-sm font-medium text-content truncate">{task.task_name}</span>
                    </div>
                    <div className="text-xs text-content-subtle mt-0.5">{task.projectName}</div>
                  </div>

                  {/* 상태 */}
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[task.status]}`}>
                    {STATUS_LABEL[task.status]}
                  </span>

                  {/* 마감 */}
                  <span className={`shrink-0 text-xs font-medium w-16 text-right ${urgent ? 'text-red-600' : 'text-content-subtle'}`}>
                    {dayLabel}
                  </span>

                  <ChevronRight size={14} className="shrink-0 text-content-subtle" />
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      {/* 최근 프로젝트 */}
      <Card>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <SectionTitle>최근 프로젝트</SectionTitle>
          <Link to="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
            전체 보기 <ChevronRight size={14} />
          </Link>
        </div>
        {projLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-surface-hover rounded animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-content-subtle mb-3">프로젝트가 없습니다.</p>
            <Link to="/projects" className="text-sm text-primary hover:underline">
              첫 번째 프로젝트 만들기 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {projects.slice(0, 5).map(project => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    project.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm font-medium text-content">{project.name}</span>
                  {project.clientName && (
                    <span className="text-sm text-content-subtle">{project.clientName}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-content-subtle">
                  {project.endDate && <span>{formatDate(project.endDate)} 까지</span>}
                  <ChevronRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
