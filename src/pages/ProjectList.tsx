import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, Calendar, ChevronRight, FolderKanban } from 'lucide-react'
import { useProjects } from '../hooks/useProject'
import { formatDate } from '../utils'
import type { Project } from '../types'

type CreateInput = {
  name: string
  description: string
  clientName: string
  startDate: string
  endDate: string
}

export default function ProjectList() {
  const { projects, loading, createProject } = useProjects()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.clientName.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(input: CreateInput) {
    const project = await createProject(input)
    setShowModal(false)
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">프로젝트</h1>
          <p className="text-gray-500 mt-1">
            {loading ? '불러오는 중...' : `${projects.length}개의 프로젝트`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          새 프로젝트
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="프로젝트명, 고객사 검색..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={search} onNew={() => setShowModal(true)} />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showModal && (
        <CreateProjectModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight pr-2">
          {project.name}
        </h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
          project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {project.status === 'active' ? '진행중' : '완료'}
        </span>
      </div>

      <div className="space-y-1.5 flex-1">
        {project.clientName && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Building2 size={13} className="shrink-0" />
            <span className="truncate">{project.clientName}</span>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Calendar size={13} className="shrink-0" />
            <span>{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
          </div>
        )}
        {project.description && (
          <p className="text-sm text-gray-400 mt-2 line-clamp-2">{project.description}</p>
        )}
      </div>

      <div className="flex items-center justify-end mt-4 text-xs text-gray-300 group-hover:text-blue-400 transition-colors">
        산출물 보기 <ChevronRight size={14} />
      </div>
    </Link>
  )
}

function EmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
      <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
        <FolderKanban size={32} className="text-gray-400" />
      </div>
      <p className="text-gray-500 font-medium mb-1">
        {search ? '검색 결과가 없습니다.' : '아직 프로젝트가 없습니다.'}
      </p>
      {!search && (
        <button
          onClick={onNew}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          첫 번째 프로젝트 만들기
        </button>
      )}
    </div>
  )
}

function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: CreateInput) => Promise<void>
}) {
  const [form, setForm] = useState<CreateInput>({
    name: '', description: '', clientName: '', startDate: '', endDate: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof CreateInput, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onCreate(form)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">새 프로젝트</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프로젝트명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 홈페이지 리뉴얼 프로젝트"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">고객사</label>
            <input
              type="text"
              value={form.clientName}
              onChange={e => set('clientName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: (주)○○○"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => set('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="프로젝트에 대한 간단한 설명"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '생성 중...' : '프로젝트 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
