import { Link } from 'react-router-dom'
import {
  FolderKanban, CheckCircle, Clock,
  ChevronRight, AlertCircle, ClipboardList, Loader2,
  Bug, Diamond,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'
import { useProjects } from '../hooks/useProject'
import { useMyTasks } from '../hooks/useMyTasks'
import { useDashboardStats } from '../hooks/useDashboardStats'
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
  in_progress:  'bg-primary-soft text-blue-700',
  completed:    'bg-success-soft text-green-700',
  delayed:      'bg-danger-soft text-red-700',
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
  const { openIssues, criticalIssues, upcomingMilestones, overdueMilestones, loading: statsLoading } = useDashboardStats()

  const activeCount = projects.filter(p => p.status === 'active').length

  const stats = [
    {
      label: '전체 프로젝트',
      value: projLoading ? '-' : String(projects.length),
      sub: `진행중 ${activeCount}개`,
      icon: FolderKanban,
      color: 'text-primary bg-primary-soft',
    },
    {
      label: '내 미완료 작업',
      value: myLoading ? '-' : String(myTasks.length),
      sub: overdue.length > 0 ? `초과 ${overdue.length}개` : `임박 ${dueSoon.length}개`,
      icon: ClipboardList,
      color: overdue.length > 0 ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50',
    },
    {
      label: '열린 이슈',
      value: statsLoading ? '-' : String(openIssues),
      sub: criticalIssues > 0 ? `긴급 ${criticalIssues}개` : '긴급 없음',
      icon: Bug,
      color: criticalIssues > 0 ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50',
    },
    {
      label: '다가오는 마일스톤',
      value: statsLoading ? '-' : String(upcomingMilestones.length),
      sub: overdueMilestones > 0 ? `기한 초과 ${overdueMilestones}개` : '7일 이내',
      icon: Diamond,
      color: overdueMilestones > 0 ? 'text-red-600 bg-red-50' : 'text-primary bg-primary-soft',
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
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="p-5">
            <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>
              <Icon size={20} />
            </div>
            <div className="text-2xl font-bold text-content">{value}</div>
            <div className="text-sm text-content-muted mt-0.5">{label}</div>
            {sub && <div className="text-xs text-content-subtle mt-1">{sub}</div>}
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

      {/* 다가오는 마일스톤 */}
      {!statsLoading && upcomingMilestones.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 px-6 py-4 border-b border-line">
            <Diamond size={15} className="text-indigo-500" />
            <SectionTitle>다가오는 마일스톤 (7일 이내)</SectionTitle>
          </div>
          <div className="divide-y divide-line">
            {upcomingMilestones.map(ms => {
              const days = Math.ceil((new Date(ms.due_date).getTime() - Date.now()) / 86_400_000)
              return (
                <Link
                  key={ms.id}
                  to={`/projects/${ms.project_id}/gantt`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-sm text-content">{ms.name}</span>
                  </div>
                  <span className={`text-xs font-medium ${days <= 1 ? 'text-red-600' : days <= 3 ? 'text-orange-500' : 'text-content-subtle'}`}>
                    {days === 0 ? '오늘' : `D-${days}`}
                  </span>
                </Link>
              )
            })}
          </div>
        </Card>
      )}

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

      {/* ── 이슈 현황 차트 ── */}
      {!statsLoading && (
        <div className="grid grid-cols-2 gap-4">
          {/* 이슈 상태 도넛 */}
          <Card>
            <div className="px-6 py-4 border-b border-line">
              <SectionTitle>이슈 현황</SectionTitle>
            </div>
            <div className="p-6">
              {(() => {
                const data = [
                  { name: '열림',   value: openIssues - (criticalIssues ?? 0), color: '#3b82f6' },
                  { name: '긴급',   value: criticalIssues,                      color: '#ef4444' },
                  { name: '마감임박', value: upcomingMilestones.length,          color: '#f59e0b' },
                ]
                const total = data.reduce((s, d) => s + d.value, 0)
                if (!total) return <p className="text-center text-sm text-content-subtle py-8">이슈 없음</p>
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v}건`]} />
                      <Legend iconType="circle" iconSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              })()}
            </div>
          </Card>

          {/* 프로젝트 진행 상태 바 차트 */}
          <Card>
            <div className="px-6 py-4 border-b border-line">
              <SectionTitle>프로젝트 현황</SectionTitle>
            </div>
            <div className="p-6">
              {projLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-content-subtle" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={projects.slice(0, 5).map(p => ({ name: p.systemCode || p.name.slice(0, 6), 진행중: p.status === 'active' ? 1 : 0, 완료: p.status === 'archived' ? 1 : 0 }))} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="진행중" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="완료"   fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Legend iconType="circle" iconSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
