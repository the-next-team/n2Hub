import { useParams, Link } from 'react-router-dom'
import { FileText, Users, Building2, Calendar, ChevronRight, ClipboardList } from 'lucide-react'
import { useProject } from '../hooks/useProject'
import { useDocuments } from '../hooks/useDocument'
import { formatDate } from '../utils'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const { project, loading } = useProject(id!)
  const { documents, loading: docsLoading } = useDocuments(id!)

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 bg-surface-hover rounded animate-pulse mb-4" />
        <div className="h-8 w-64 bg-surface-hover rounded animate-pulse" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-content-subtle">프로젝트를 찾을 수 없습니다.</div>
    )
  }

  const activeCount = documents.filter(d => d.status !== '완료').length
  const doneCount = documents.filter(d => d.status === '완료').length

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 text-sm text-content-muted mb-6">
        <Link to="/projects" className="hover:text-content">프로젝트</Link>
        <ChevronRight size={14} />
        <span className="text-content">{project.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-content">{project.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-surface-hover text-content-muted'
            }`}>
              {project.status === 'active' ? '진행중' : '완료'}
            </span>
          </div>
          {project.description && (
            <p className="text-content-muted text-sm">{project.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {project.clientName && (
          <div className="flex items-center gap-2 text-sm text-content-muted">
            <Building2 size={15} className="text-content-subtle" />
            <span className="font-medium">고객사:</span>
            <span>{project.clientName}</span>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex items-center gap-2 text-sm text-content-muted">
            <Calendar size={15} className="text-content-subtle" />
            <span className="font-medium">기간:</span>
            <span>{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-bold text-content">
            {docsLoading ? '-' : documents.length}
          </div>
          <div className="text-sm text-content-muted mt-1">전체 산출물</div>
        </div>
        <div className="bg-surface rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {docsLoading ? '-' : activeCount}
          </div>
          <div className="text-sm text-content-muted mt-1">진행중</div>
        </div>
        <div className="bg-surface rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {docsLoading ? '-' : doneCount}
          </div>
          <div className="text-sm text-content-muted mt-1">완료</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Link
          to={`/projects/${id}/documents`}
          className="flex items-center gap-4 bg-surface rounded-xl border border-line p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="p-3 bg-primary-soft rounded-lg text-primary">
            <FileText size={20} />
          </div>
          <div>
            <div className="font-medium text-content">산출물 목록</div>
            <div className="text-sm text-content-muted mt-0.5">
              {docsLoading ? '...' : `${documents.length}개`}
            </div>
          </div>
          <ChevronRight size={16} className="text-content-subtle ml-auto" />
        </Link>

        <Link
          to={`/projects/${id}/tasks`}
          className="flex items-center gap-4 bg-surface rounded-xl border border-line p-5 hover:border-orange-300 hover:shadow-sm transition-all"
        >
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="font-medium text-content">WBS 작업 관리</div>
            <div className="text-sm text-content-muted mt-0.5">담당자별 일정 및 진행률</div>
          </div>
          <ChevronRight size={16} className="text-content-subtle ml-auto" />
        </Link>

        <div className="flex items-center gap-4 bg-surface rounded-xl border border-line p-5 opacity-60 cursor-not-allowed">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Users size={20} />
          </div>
          <div>
            <div className="font-medium text-content">멤버</div>
            <div className="text-sm text-content-muted mt-0.5">팀원을 관리하세요</div>
          </div>
        </div>
      </div>
    </div>
  )
}
