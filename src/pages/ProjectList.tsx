import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, Calendar, ChevronRight, FolderKanban, X, Pencil, Upload, Check } from 'lucide-react'
import { useProjects } from '../hooks/useProject'
import { supabase } from '../lib/supabase'
import { formatDate } from '../utils'
import type { Project } from '../types'
import { Button, Badge, Card, PageHeader } from '../components/ui'
import { THEME_PALETTE } from '../contexts/ProjectThemeContext'

/* ── 프로젝트 폼 입력 타입 ── */
type ProjectForm = {
  name: string
  description: string
  clientName: string
  startDate: string
  endDate: string
  systemCode: string
  systemName: string
  themeColor: string | null
}

const DEFAULT_FORM: ProjectForm = {
  name: '', description: '', clientName: '',
  startDate: '', endDate: '',
  systemCode: '', systemName: '',
  themeColor: null,
}

/* ── 로고 업로드 ── */
async function uploadLogo(file: File, projectId: string): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'png'
  const path = `${projectId}.${ext}`
  await supabase.storage.from('logos').upload(path, file, { upsert: true })
  const { data } = supabase.storage.from('logos').getPublicUrl(path)
  return data.publicUrl
}

/* ── 메인 페이지 ── */
export default function ProjectList() {
  const { projects, loading, createProject, updateProject } = useProjects()
  const [search, setSearch]         = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const navigate = useNavigate()

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.systemCode || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(form: ProjectForm, logo: File | null) {
    const project = await createProject({ ...form, themeColor: form.themeColor })
    if (logo) {
      const url = await uploadLogo(logo, project.id)
      await updateProject(project.id, { logoUrl: url })
    }
    setShowCreate(false)
    navigate(`/projects/${project.id}`)
  }

  async function handleUpdate(form: ProjectForm, logo: File | null) {
    if (!editTarget) return
    let logoUrl: string | undefined
    if (logo) logoUrl = await uploadLogo(logo, editTarget.id)
    await updateProject(editTarget.id, { ...form, themeColor: form.themeColor, ...(logoUrl ? { logoUrl } : {}) })
    setEditTarget(null)
  }

  return (
    <div className="p-8">
      <PageHeader
        title="프로젝트"
        description={loading ? '불러오는 중...' : `${projects.length}개의 프로젝트`}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            새 프로젝트
          </Button>
        }
      />

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="프로젝트명, 고객사, 시스템코드 검색..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-surface border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-5 bg-surface-hover rounded w-3/4 mb-3" />
              <div className="h-4 bg-surface-hover rounded w-1/2 mb-2" />
              <div className="h-4 bg-surface-hover rounded w-2/3" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={search} onNew={() => setShowCreate(true)} />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => setEditTarget(project)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <ProjectModal
          title="새 프로젝트"
          initialForm={DEFAULT_FORM}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {editTarget && (
        <ProjectModal
          title="프로젝트 수정"
          initialForm={{
            name:        editTarget.name,
            description: editTarget.description,
            clientName:  editTarget.clientName,
            startDate:   editTarget.startDate,
            endDate:     editTarget.endDate,
            systemCode:  editTarget.systemCode  ?? '',
            systemName:  editTarget.systemName  ?? '',
            themeColor:  editTarget.themeColor  ?? null,
          }}
          existingLogoUrl={editTarget.logoUrl}
          onClose={() => setEditTarget(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  )
}

/* ── 프로젝트 카드 ── */
function ProjectCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const accent = project.themeColor ?? '#4f46e5'
  const initials = (project.systemCode || project.name).slice(0, 2).toUpperCase()
  const [imgError, setImgError] = useState(false)

  return (
    <div className="relative group">
      <Link
        to={`/projects/${project.id}`}
        className="bg-surface rounded-xl border border-line p-5 hover:border-primary/40 hover:shadow-card transition-all flex flex-col block"
        style={{ borderTopColor: accent, borderTopWidth: 3 }}
      >
        {/* 로고 + 배지 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {project.logoUrl && !imgError ? (
              <img
                src={project.logoUrl}
                alt={project.name}
                className="w-9 h-9 rounded-lg object-contain bg-surface-hover p-0.5 shrink-0 border border-line"
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm"
                style={{ backgroundColor: accent }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-content group-hover:text-primary transition-colors leading-tight truncate">
                {project.name}
              </h3>
              {project.systemCode && (
                <span className="text-[10px] font-mono text-content-subtle">{project.systemCode}</span>
              )}
            </div>
          </div>
          <Badge tone={project.status === 'active' ? 'green' : 'gray'} className="shrink-0 ml-2">
            {project.status === 'active' ? '진행중' : '완료'}
          </Badge>
        </div>

        <div className="space-y-1 flex-1">
          {project.clientName && (
            <div className="flex items-center gap-1.5 text-sm text-content-muted">
              <Building2 size={13} className="shrink-0" />
              <span className="truncate">{project.clientName}</span>
            </div>
          )}
          {project.systemName && (
            <div className="flex items-center gap-1.5 text-sm text-content-subtle">
              <span className="text-xs">{project.systemName}</span>
            </div>
          )}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-1.5 text-sm text-content-subtle">
              <Calendar size={13} className="shrink-0" />
              <span>{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
            </div>
          )}
          {project.description && (
            <p className="text-sm text-content-subtle mt-2 line-clamp-2">{project.description}</p>
          )}
        </div>

        <div className="flex items-center justify-end mt-4 text-xs text-content-subtle group-hover:text-primary transition-colors">
          산출물 보기 <ChevronRight size={14} />
        </div>
      </Link>

      {/* 수정 버튼 */}
      <button
        onClick={e => { e.preventDefault(); onEdit() }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-md bg-surface border border-line text-content-subtle hover:text-primary hover:border-primary/40 transition-all"
        title="프로젝트 수정"
      >
        <Pencil size={13} />
      </button>
    </div>
  )
}

/* ── 빈 상태 ── */
function EmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <Card className="p-16 text-center">
      <div className="inline-flex p-4 bg-surface-hover rounded-full mb-4">
        <FolderKanban size={32} className="text-content-subtle" />
      </div>
      <p className="text-content-muted font-medium mb-1">
        {search ? '검색 결과가 없습니다.' : '아직 프로젝트가 없습니다.'}
      </p>
      {!search && (
        <Button onClick={onNew} className="mt-4">
          <Plus size={14} />
          첫 번째 프로젝트 만들기
        </Button>
      )}
    </Card>
  )
}

/* ── 프로젝트 생성/수정 모달 ── */
function ProjectModal({
  title,
  initialForm,
  existingLogoUrl,
  onClose,
  onSubmit,
}: {
  title: string
  initialForm: ProjectForm
  existingLogoUrl?: string | null
  onClose: () => void
  onSubmit: (form: ProjectForm, logo: File | null) => Promise<void>
}) {
  const [form, setForm]           = useState<ProjectForm>(initialForm)
  const [logo, setLogo]           = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(existingLogoUrl ?? null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof ProjectForm>(key: K, val: ProjectForm[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogo(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit(form, logo)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-canvas'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-scale">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 className="text-lg font-semibold text-content">{title}</h2>
          <button onClick={onClose} className="text-content-subtle hover:text-content-muted"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">

            {/* 로고 + 테마 컬러 */}
            <div className="flex items-start gap-5">
              {/* 로고 업로드 */}
              <div className="shrink-0">
                <label className="block text-sm font-medium text-content mb-1.5">회사 로고</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-line hover:border-primary/40 cursor-pointer flex items-center justify-center bg-canvas transition-colors overflow-hidden"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Upload size={20} className="text-content-subtle" />
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <p className="text-xs text-content-subtle mt-1 text-center">PNG, JPG, SVG</p>
              </div>

              {/* 기본 정보 */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-content mb-1">프로젝트명 *</label>
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                    className={inputCls} placeholder="예: 핀다AI뱅크 저축은행 뱅킹시스템 구축" required autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">시스템 코드</label>
                    <input type="text" value={form.systemCode} onChange={e => set('systemCode', e.target.value.toUpperCase())}
                      className={inputCls + ' font-mono'} placeholder="FNDB" maxLength={20} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">시스템 영문명</label>
                    <input type="text" value={form.systemName} onChange={e => set('systemName', e.target.value)}
                      className={inputCls} placeholder="FINDA BANK" />
                  </div>
                </div>
              </div>
            </div>

            {/* 테마 컬러 */}
            <div>
              <label className="block text-sm font-medium text-content mb-2">프로젝트 테마 컬러</label>
              <div className="flex flex-wrap gap-2">
                {THEME_PALETTE.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    title={t.label}
                    onClick={() => set('themeColor', form.themeColor === t.value ? null : t.value)}
                    className="relative w-8 h-8 rounded-lg border-2 transition-all"
                    style={{
                      backgroundColor: t.value,
                      borderColor: form.themeColor === t.value ? '#000' : 'transparent',
                      transform: form.themeColor === t.value ? 'scale(1.15)' : undefined,
                    }}
                  >
                    {form.themeColor === t.value && (
                      <Check size={14} className="absolute inset-0 m-auto text-white" />
                    )}
                  </button>
                ))}
                {/* 선택 해제 */}
                {form.themeColor && (
                  <button type="button" onClick={() => set('themeColor', null)}
                    className="px-2 py-1 text-xs text-content-muted border border-line rounded-lg hover:bg-surface-hover">
                    기본
                  </button>
                )}
              </div>
              {form.themeColor && (
                <p className="text-xs text-content-subtle mt-1.5">
                  선택: {THEME_PALETTE.find(t => t.value === form.themeColor)?.label ?? form.themeColor}
                </p>
              )}
            </div>

            {/* 고객사 + 기간 */}
            <div>
              <label className="block text-sm font-medium text-content mb-1">고객사</label>
              <input type="text" value={form.clientName} onChange={e => set('clientName', e.target.value)}
                className={inputCls} placeholder="예: (주)핀다" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-content mb-1">시작일</label>
                <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-content mb-1">종료일</label>
                <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-content mb-1">설명</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} className={inputCls + ' resize-none'} placeholder="프로젝트에 대한 간단한 설명" />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger-soft border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>

          {/* 푸터 */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-line bg-canvas shrink-0 sticky bottom-0">
            <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? '저장 중...' : title}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
