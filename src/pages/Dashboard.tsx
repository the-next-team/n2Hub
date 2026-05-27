import { Link } from 'react-router-dom'
import { FolderKanban, FileText, CheckCircle, Clock, ChevronRight } from 'lucide-react'
import { useProjects } from '../hooks/useProject'
import { formatDate } from '../utils'
import { Card, PageHeader, SectionTitle } from '../components/ui'

export default function Dashboard() {
  const { projects, loading } = useProjects()

  const activeCount = projects.filter(p => p.status === 'active').length
  const archivedCount = projects.filter(p => p.status === 'archived').length

  const stats = [
    { label: '전체 프로젝트', value: loading ? '-' : String(projects.length), icon: FolderKanban, color: 'text-primary bg-primary-soft' },
    { label: '진행중', value: loading ? '-' : String(activeCount), icon: Clock, color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/15' },
    { label: '완료', value: loading ? '-' : String(archivedCount), icon: CheckCircle, color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/15' },
    { label: '산출물', value: '-', icon: FileText, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/15' },
  ]

  const recentProjects = projects.slice(0, 5)

  return (
    <div className="p-8">
      <PageHeader
        title="대시보드"
        description="내 프로젝트 현황을 한눈에 확인하세요."
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
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

      <Card>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <SectionTitle>최근 프로젝트</SectionTitle>
          <Link to="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
            전체 보기 <ChevronRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-surface-hover rounded animate-pulse" />
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-content-subtle mb-3">프로젝트가 없습니다.</p>
            <Link to="/projects" className="text-sm text-primary hover:underline">
              첫 번째 프로젝트 만들기 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {recentProjects.map(project => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${project.status === 'active' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
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
