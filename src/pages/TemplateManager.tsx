import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, X, Loader2, Trash2, Pencil,
  BookOpen, Search,
} from 'lucide-react'
import { useTemplates, type Template, type TemplatePayload } from '../hooks/useTemplates'
import { useProjects } from '../hooks/useProject'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cn } from '../utils'
import { PageHeader } from '../components/ui'

// ── 카테고리 ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['전체', '계획', '분석', '설계', '개발', '테스트', '운영', '기타']

const CAT_COLOR: Record<string, string> = {
  계획: 'bg-primary-soft text-blue-700',
  분석: 'bg-purple-100 text-purple-700',
  설계: 'bg-indigo-100 text-indigo-700',
  개발: 'bg-success-soft text-green-700',
  테스트: 'bg-warning-soft text-yellow-700',
  운영: 'bg-warning-soft text-orange-700',
  기타: 'bg-surface-hover text-slate-600',
}

// ── 기본 제공 템플릿 ──────────────────────────────────────────────────────────

const BUILTIN_TEMPLATES: Omit<Template, 'id' | 'created_by' | 'created_at' | 'is_public'>[] = [
  {
    name: '사업수행계획서',
    description: '프로젝트 범위, 일정, 자원, 위험 관리를 포함한 종합 계획서',
    category: '계획',
    content_text: `# 사업수행계획서

## 1. 사업 개요
### 1.1 사업 목적
### 1.2 사업 범위
### 1.3 추진 체계

## 2. 추진 일정
### 2.1 단계별 일정
### 2.2 주요 마일스톤

## 3. 자원 계획
### 3.1 인력 계획
### 3.2 예산 계획

## 4. 위험 관리
### 4.1 위험 식별
### 4.2 위험 대응 방안

## 5. 품질 보증 계획`,
  },
  {
    name: '요구사항 정의서',
    description: '기능 요구사항, 비기능 요구사항, 인터페이스 요구사항 정의',
    category: '분석',
    content_text: `# 요구사항 정의서

## 1. 개요
### 1.1 목적
### 1.2 범위

## 2. 기능 요구사항
| 요구사항 ID | 기능명 | 우선순위 | 설명 |
|---|---|---|---|
| FR-001 | | High | |

## 3. 비기능 요구사항
### 3.1 성능 요구사항
### 3.2 보안 요구사항
### 3.3 가용성 요구사항

## 4. 인터페이스 요구사항
### 4.1 외부 시스템 연동
### 4.2 API 명세`,
  },
  {
    name: '시스템 설계서',
    description: '시스템 아키텍처, 데이터베이스, 컴포넌트 설계 문서',
    category: '설계',
    content_text: `# 시스템 설계서

## 1. 시스템 아키텍처
### 1.1 전체 구조
### 1.2 배포 아키텍처

## 2. 데이터베이스 설계
### 2.1 ERD
### 2.2 테이블 정의

## 3. 컴포넌트 설계
### 3.1 컴포넌트 목록
### 3.2 인터페이스 정의

## 4. 보안 설계
### 4.1 인증/인가
### 4.2 데이터 암호화`,
  },
  {
    name: '테스트 계획서',
    description: '테스트 범위, 전략, 일정, 합격 기준 정의',
    category: '테스트',
    content_text: `# 테스트 계획서

## 1. 테스트 개요
### 1.1 테스트 목적
### 1.2 테스트 범위

## 2. 테스트 전략
### 2.1 단위 테스트
### 2.2 통합 테스트
### 2.3 시스템 테스트
### 2.4 성능 테스트

## 3. 테스트 일정
### 3.1 단계별 일정
### 3.2 자원 계획

## 4. 합격 기준
### 4.1 기능 테스트 기준
### 4.2 성능 테스트 기준

## 5. 결함 관리`,
  },
  {
    name: '운영 매뉴얼',
    description: '시스템 운영, 장애 대응, 모니터링 절차 안내',
    category: '운영',
    content_text: `# 운영 매뉴얼

## 1. 시스템 개요
### 1.1 구성 요소
### 1.2 담당자 연락처

## 2. 일상 운영 절차
### 2.1 시스템 기동/종료
### 2.2 배치 작업 관리
### 2.3 모니터링

## 3. 장애 대응
### 3.1 장애 유형별 대응
### 3.2 에스컬레이션 절차

## 4. 백업 및 복구
### 4.1 백업 정책
### 4.2 복구 절차

## 5. 변경 관리`,
  },
  {
    name: '회의록',
    description: '회의 결과, 결정 사항, 액션 아이템 정리',
    category: '기타',
    content_text: `# 회의록

- 일시:
- 장소:
- 참석자:

## 안건
1.
2.

## 논의 내용

## 결정 사항

## 액션 아이템
| 번호 | 내용 | 담당자 | 기한 |
|---|---|---|---|
| 1 | | | |

## 차기 회의 일정`,
  },
]

// ── 템플릿 사용하기 모달 ──────────────────────────────────────────────────────

interface UseModalProps {
  template: Template | typeof BUILTIN_TEMPLATES[0]
  onClose: () => void
}

function UseTemplateModal({ template, onClose }: UseModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { projects } = useProjects()
  const [projectId, setProjectId] = useState('')
  const [title, setTitle]         = useState(template.name)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const handleUse = async () => {
    if (!projectId || !title.trim()) return
    setSaving(true); setError('')
    try {
      // documents 테이블에 문서 생성
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          title: title.trim(),
          description: template.description || '',
          category: template.category,
          status: 'draft',
          current_version: 'v1.0',
        })
        .select().single()
      if (docErr) throw docErr

      // document_versions에 내용 저장
      const content = template.content_text || ''
      const contentJson = {
        type: 'doc',
        content: content.split('\n').filter(Boolean).map(line => ({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        })),
      }

      await supabase.from('document_versions').insert({
        document_id: doc.id,
        version: 'v1.0',
        content_json: contentJson,
        change_note: `${template.name} 템플릿으로 생성`,
        created_by: user?.id,
      })

      navigate(`/documents/${doc.id}`)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-content placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-canvas rounded-2xl shadow-2xl border border-line">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-sm font-semibold text-content">템플릿 사용하기</h2>
          <button onClick={onClose} className="p-1 rounded text-content-muted hover:text-content hover:bg-surface-hover">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">문서 제목</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">프로젝트 <span className="text-danger">*</span></label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputCls}>
              <option value="">프로젝트 선택</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-line text-content-muted hover:bg-surface-hover">취소</button>
          <button
            onClick={handleUse}
            disabled={!projectId || !title.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            문서 생성
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 템플릿 편집 모달 ──────────────────────────────────────────────────────────

interface EditModalProps {
  template?: Template
  onClose: () => void
  onSave: (payload: TemplatePayload) => Promise<void>
}

function EditTemplateModal({ template, onClose, onSave }: EditModalProps) {
  const [name, setName]         = useState(template?.name || '')
  const [description, setDesc]  = useState(template?.description || '')
  const [category, setCat]      = useState(template?.category || '기타')
  const [content, setContent]   = useState(template?.content_text || '')
  const [saving, setSaving]     = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim() || null, category, content_text: content || null })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-content placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[480px] h-full bg-canvas border-l border-line flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h2 className="text-sm font-semibold text-content">{template ? '템플릿 수정' : '새 템플릿'}</h2>
          <button onClick={onClose} className="p-1 rounded text-content-muted hover:text-content hover:bg-surface-hover"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">이름 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="템플릿 이름" className={inputCls} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1.5">카테고리</label>
              <select value={category} onChange={e => setCat(e.target.value)} className={inputCls}>
                {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">설명</label>
            <input value={description} onChange={e => setDesc(e.target.value)} placeholder="템플릿 설명" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1.5">내용 (Markdown)</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={16}
              placeholder="# 제목&#10;## 섹션&#10;내용을 입력하세요..."
              className={`${inputCls} resize-none font-mono text-xs`} />
          </div>
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-line">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-line text-content-muted hover:bg-surface-hover">취소</button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {template ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 템플릿 카드 ───────────────────────────────────────────────────────────────

interface CardProps {
  template: Template | typeof BUILTIN_TEMPLATES[0]
  isBuiltin?: boolean
  onUse: () => void
  onEdit?: () => void
  onDelete?: () => void
}

function TemplateCard({ template, isBuiltin, onUse, onEdit, onDelete }: CardProps) {
  const catCls = CAT_COLOR[template.category] || CAT_COLOR['기타']
  return (
    <div className="group bg-canvas border border-line rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary-soft rounded-lg text-primary shrink-0">
            <FileText size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-content leading-tight">{template.name}</p>
            <span className={cn('inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium', catCls)}>
              {template.category}
            </span>
          </div>
        </div>
        {!isBuiltin && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1 rounded text-content-muted hover:text-primary hover:bg-primary-soft">
              <Pencil size={11} />
            </button>
            <button onClick={onDelete} className="p-1 rounded text-content-muted hover:text-danger hover:bg-danger-soft">
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-content-subtle flex-1 leading-relaxed">
        {template.description || '설명 없음'}
      </p>

      <button
        onClick={onUse}
        className="w-full py-1.5 text-xs font-medium rounded-lg bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors"
      >
        사용하기
      </button>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

export default function TemplateManager() {
  const { templates, loading, create, update, remove } = useTemplates()
  const [activeTab, setActiveTab]   = useState('전체')
  const [search, setSearch]         = useState('')
  const [editTarget, setEditTarget] = useState<Template | null | 'new'>()
  const [useTarget, setUseTarget]   = useState<Template | typeof BUILTIN_TEMPLATES[0] | null>(null)

  const allTemplates = useMemo(() => {
    const custom = templates.map(t => ({ ...t, _builtin: false }))
    const builtin = BUILTIN_TEMPLATES.map((t, i) => ({ ...t, id: `builtin-${i}`, created_by: '', created_at: '', is_public: true, _builtin: true }))
    return [...builtin, ...custom]
  }, [templates])

  const filtered = useMemo(() => {
    return allTemplates.filter(t => {
      if (activeTab !== '전체' && t.category !== activeTab) return false
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [allTemplates, activeTab, search])

  const handleSave = async (payload: TemplatePayload) => {
    if (editTarget && editTarget !== 'new' && !editTarget.id.startsWith('builtin')) {
      await update(editTarget.id, payload)
    } else {
      await create(payload)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('템플릿을 삭제하시겠습니까?')) return
    await remove(id)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 px-6 py-4 border-b border-line bg-canvas">
        <PageHeader
          title="템플릿 관리"
          description="산출물 템플릿을 선택해 문서를 빠르게 시작하세요."
          actions={
            <button
              onClick={() => setEditTarget('new')}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors"
            >
              <Plus size={14} /> 새 템플릿
            </button>
          }
        />
      </div>

      {/* 필터 */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-line bg-surface">
        {/* 카테고리 탭 */}
        <div className="flex gap-1 bg-canvas border border-line rounded-lg p-0.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                activeTab === cat
                  ? 'bg-primary text-white'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-subtle" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="템플릿 검색…"
            className="pl-7 pr-3 py-1.5 text-sm border border-line rounded-lg bg-canvas text-content placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 w-44"
          />
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-content-muted">
            <Loader2 size={16} className="animate-spin" /> 로딩 중…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-content-subtle">
            <BookOpen size={32} className="mb-3 opacity-30" />
            <p className="text-sm">
              {search ? '검색 결과 없음' : '템플릿이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                isBuiltin={(t as { _builtin?: boolean })._builtin}
                onUse={() => setUseTarget(t)}
                onEdit={() => !((t as { _builtin?: boolean })._builtin) && setEditTarget(t as Template)}
                onDelete={() => !((t as { _builtin?: boolean })._builtin) && handleDelete(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 사용하기 모달 */}
      {useTarget && (
        <UseTemplateModal template={useTarget} onClose={() => setUseTarget(null)} />
      )}

      {/* 편집 패널 */}
      {editTarget && (
        <EditTemplateModal
          template={editTarget === 'new' ? undefined : editTarget}
          onClose={() => setEditTarget(undefined)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
