import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  FileText, Users, Building2, Calendar, ChevronRight, ClipboardList,
  BarChart2, AlertCircle, CalendarDays, Activity, Bug, Diamond,
  Folder, TrendingUp,
} from 'lucide-react'
import { useProject } from '../hooks/useProject'
import { useDocuments } from '../hooks/useDocument'
import { supabase } from '../lib/supabase'
import { formatDate } from '../utils'
import { cn } from '../utils'

interface ProjectStats {
  fileCount:       number
  memberCount:     number
  issueOpen:       number
  issueCritical:   number
  taskTotal:       number
  taskCompleted:   number
  taskInProgress:  number
  taskDelayed:     number
  activeSprint:    string | null
  sprintDaysLeft:  number | null
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { project, loading } = useProject(id!)
  const { documents, loading: docsLoading } = useDocuments(id!)

  const [stats, setStats]   = useState<ProjectStats>({
    fileCount: 0, memberCount: 0,
    issueOpen: 0, issueCritical: 0,
    taskTotal: 0, taskCompleted: 0, taskInProgress: 0, taskDelayed: 0,
    activeSprint: null, sprintDaysLeft: null,
  })

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('files').select('id', { count: 'exact', head: true }).eq('project_id', id).neq('mime_type', 'folder'),
      supabase.from('project_members').select('id', { count: 'exact', head: true }).eq('project_id', id),
      supabase.from('issues').select('id, priority').eq('project_id', id).not('status', 'in', '("resolved","closed")'),
      supabase.from('wbs_tasks').select('id, status').eq('project_id', id),
      supabase.from('sprints').select('name, end_date').eq('project_id', id).eq('status', 'active').maybeSingle(),
    ]).then(([files, members, issues, tasks, sprint]) => {
      const issueData  = issues.data ?? []
      const taskData   = tasks.data ?? []
      const sprintData = sprint.data

      const daysLeft = sprintData?.end_date
        ? Math.ceil((new Date(sprintData.end_date).getTime() - Date.now()) / 86_400_000)
        : null

      setStats({
        fileCount:      files.count ?? 0,
        memberCount:    members.count ?? 0,
        issueOpen:      issueData.length,
        issueCritical:  issueData.filter(i => i.priority === 'critical').length,
        taskTotal:      taskData.length,
        taskCompleted:  taskData.filter(t => t.status === 'completed').length,
        taskInProgress: taskData.filter(t => t.status === 'in_progress').length,
        taskDelayed:    taskData.filter(t => t.status === 'delayed').length,
        activeSprint:   sprintData?.name ?? null,
        sprintDaysLeft: daysLeft,
      })
    })
  }, [id])

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-surface-hover rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  if (!project) return <div className="p-8 text-center text-content-subtle">프로젝트를 찾을 수 없습니다.</div>

  const totalFiles   = stats.fileCount + documents.length
  const taskProgress = stats.taskTotal > 0
    ? Math.round((stats.taskCompleted / stats.taskTotal) * 100) : 0
  const accent       = project.themeColor ?? '#4f46e5'

  // 프로젝트 기간 계산
  const totalDays    = project.startDate && project.endDate
    ? Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / 86_400_000) : 0
  const elapsedDays  = project.startDate
    ? Math.max(0, Math.ceil((Date.now() - new Date(project.startDate).getTime()) / 86_400_000)) : 0
  const periodPct    = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* ── 헤더 배너 ── */}
      <div className="shrink-0 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}05 100%)`, borderBottom: `3px solid ${accent}30` }}>
        <div className="px-8 pt-7 pb-6">
          {/* 브레드크럼 */}
          <div className="flex items-center gap-1.5 text-xs text-content-subtle mb-4">
            <Link to="/projects" className="hover:text-content">프로젝트</Link>
            <ChevronRight size={12} />
            <span className="text-content">{project.name}</span>
          </div>

          <div className="flex items-start gap-5">
            {/* 로고 */}
            {project.logoUrl ? (
              <img src={project.logoUrl} alt={project.name} className="w-14 h-14 rounded-2xl object-contain bg-surface border border-line p-1 shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-sm"
                   style={{ backgroundColor: accent }}>
                {(project.systemCode || project.name).slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-content leading-tight">{project.name}</h1>
                {project.systemCode && (
                  <span className="text-xs font-mono text-content-subtle bg-surface border border-line px-2 py-0.5 rounded-md">{project.systemCode}</span>
                )}
                <span className={cn('text-[11px] px-2.5 py-0.5 rounded-full font-semibold',
                  project.status === 'active' ? 'bg-success-soft text-success' : 'bg-surface-hover text-content-muted'
                )}>
                  {project.status === 'active' ? '진행중' : '완료'}
                </span>
              </div>
              {project.description && <p className="text-sm text-content-muted mt-0.5 mb-2">{project.description}</p>}

              <div className="flex flex-wrap gap-4 text-xs text-content-subtle">
                {project.clientName && (
                  <span className="flex items-center gap-1.5">
                    <Building2 size={12} /> {project.clientName}
                  </span>
                )}
                {project.systemName && (
                  <span className="flex items-center gap-1.5">
                    <TrendingUp size={12} /> {project.systemName}
                  </span>
                )}
                {(project.startDate || project.endDate) && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
                  </span>
                )}
              </div>
            </div>

            {/* 프로젝트 기간 진행률 */}
            {totalDays > 0 && (
              <div className="shrink-0 text-right min-w-[120px]">
                <p className="text-xs text-content-subtle mb-1.5">프로젝트 경과</p>
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden w-32">
                  <div className="h-full rounded-full transition-all" style={{ width: `${periodPct}%`, backgroundColor: accent }} />
                </div>
                <p className="text-xs text-content-subtle mt-1">{periodPct}% · {elapsedDays}/{totalDays}일</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 space-y-6">
        {/* ── 핵심 지표 ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: '전체 산출물', value: docsLoading ? '-' : totalFiles,
              sub: `파일 ${stats.fileCount} · 문서 ${documents.length}`,
              icon: Folder, color: 'text-primary bg-primary-soft',
              to: `/projects/${id}/documents`,
            },
            {
              label: 'WBS 완료율', value: `${taskProgress}%`,
              sub: `${stats.taskCompleted}/${stats.taskTotal} 완료${stats.taskDelayed > 0 ? ` · 지연 ${stats.taskDelayed}` : ''}`,
              icon: ClipboardList, color: stats.taskDelayed > 0 ? 'text-danger bg-danger-soft' : 'text-emerald-600 bg-emerald-50',
              to: `/projects/${id}/tasks`,
            },
            {
              label: '이슈', value: stats.issueOpen,
              sub: stats.issueCritical > 0 ? `긴급 ${stats.issueCritical}개 포함` : '긴급 없음',
              icon: Bug, color: stats.issueCritical > 0 ? 'text-danger bg-danger-soft' : 'text-orange-600 bg-orange-50',
              to: `/projects/${id}/issues`,
            },
            {
              label: '팀원', value: stats.memberCount,
              sub: stats.activeSprint ? `스프린트: ${stats.activeSprint}` : '활성 스프린트 없음',
              icon: Users, color: 'text-purple-600 bg-purple-50',
              to: `/projects/${id}/members`,
            },
          ].map(card => (
            <Link key={card.label} to={card.to}
              className="bg-surface border border-line rounded-2xl p-5 hover:border-primary/30 hover:shadow-card transition-all group">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', card.color)}>
                <card.icon size={18} />
              </div>
              <div className="text-2xl font-bold text-content mb-0.5">{card.value}</div>
              <div className="text-xs text-content-muted">{card.label}</div>
              {card.sub && <div className="text-[11px] text-content-subtle mt-0.5">{card.sub}</div>}
            </Link>
          ))}
        </div>

        {/* ── WBS 진행 현황 ── */}
        {stats.taskTotal > 0 && (
          <div className="bg-surface border border-line rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
              <BarChart2 size={15} className="text-content-subtle" /> WBS 진행 현황
            </h3>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 h-3 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${taskProgress}%`, backgroundColor: accent }} />
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: accent }}>{taskProgress}%</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '전체',   val: stats.taskTotal,      cls: 'text-content' },
                { label: '진행중', val: stats.taskInProgress,  cls: 'text-primary' },
                { label: '완료',   val: stats.taskCompleted,   cls: 'text-success' },
                { label: '지연',   val: stats.taskDelayed,     cls: stats.taskDelayed > 0 ? 'text-danger font-semibold' : 'text-content-subtle' },
              ].map(s => (
                <div key={s.label} className="bg-canvas rounded-xl p-3 text-center">
                  <div className={cn('text-lg font-bold', s.cls)}>{s.val}</div>
                  <div className="text-[11px] text-content-subtle">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 빠른 이동 ── */}
        <div>
          <h3 className="text-sm font-semibold text-content mb-3">빠른 이동</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { to: 'documents',   icon: FileText,     label: '산출물 목록',   color: 'text-primary bg-primary-soft' },
              { to: 'tasks',       icon: ClipboardList,label: 'WBS 작업관리',  color: 'text-orange-600 bg-orange-50' },
              { to: 'gantt',       icon: BarChart2,    label: '간트 차트',     color: 'text-sky-600 bg-sky-50' },
              { to: 'issues',      icon: AlertCircle,  label: '이슈 관리',     color: 'text-danger bg-red-50' },
              { to: 'action-items',icon: Diamond,      label: '액션 아이템',   color: 'text-amber-600 bg-amber-50' },
              { to: 'members',     icon: Users,        label: '멤버 관리',     color: 'text-purple-600 bg-purple-50' },
              { to: 'activity',    icon: Activity,     label: '활동 로그',     color: 'text-content-muted bg-slate-50' },
            ].map(nav => (
              <Link key={nav.to} to={`/projects/${id}/${nav.to}`}
                className="flex items-center gap-3 bg-surface border border-line rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', nav.color)}>
                  <nav.icon size={15} />
                </div>
                <span className="text-sm font-medium text-content group-hover:text-primary transition-colors">{nav.label}</span>
                <ChevronRight size={14} className="text-content-subtle ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
