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
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-gray-400">프로젝트를 찾을 수 없습니다.</div>
    )
  }

  const activeCount = documents.filter(d => d.status !== '완료').length
  const doneCount = documents.filter(d => d.status === '완료').length

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/projects" className="hover:text-gray-700">프로젝트</Link>
        <ChevronRight size={14} />
        <span className="text-gray-900">{project.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {project.status === 'active' ? '진행중' : '완료'}
            </span>
          </div>
          {project.description && (
            <p className="text-gray-500 text-sm">{project.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {project.clientName && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 size={15} className="text-gray-400" />
            <span className="font-medium">고객사:</span>
            <span>{project.clientName}</span>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={15} className="text-gray-400" />
            <span className="font-medium">기간:</span>
            <span>{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {docsLoading ? '-' : documents.length}
          </div>
          <div className="text-sm text-gray-500 mt-1">전체 산출물</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {docsLoading ? '-' : activeCount}
          </div>
          <div className="text-sm text-gray-500 mt-1">진행중</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {docsLoading ? '-' : doneCount}
          </div>
          <div className="text-sm text-gray-500 mt-1">완료</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Link
          to={`/projects/${id}/documents`}
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <FileText size={20} />
          </div>
          <div>
            <div className="font-medium text-gray-900">산출물 목록</div>
            <div className="text-sm text-gray-500 mt-0.5">
              {docsLoading ? '...' : `${documents.length}개`}
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 ml-auto" />
        </Link>

        <Link
          to={`/projects/${id}/tasks`}
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:shadow-sm transition-all"
        >
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="font-medium text-gray-900">WBS 작업 관리</div>
            <div className="text-sm text-gray-500 mt-0.5">담당자별 일정 및 진행률</div>
          </div>
          <ChevronRight size={16} className="text-gray-300 ml-auto" />
        </Link>

        <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 opacity-60 cursor-not-allowed">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Users size={20} />
          </div>
          <div>
            <div className="font-medium text-gray-900">멤버</div>
            <div className="text-sm text-gray-500 mt-0.5">팀원을 관리하세요</div>
          </div>
        </div>
      </div>
    </div>
  )
}
