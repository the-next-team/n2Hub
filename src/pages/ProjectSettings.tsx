import { useRef, useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Building2, Upload, X, Save, ChevronRight,
  Palette, LayoutTemplate, FileText, CheckCircle2, RotateCcw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProject, useProjects } from '../hooks/useProject'
import { useSettings, DEFAULT_COVER_CONFIG } from '../hooks/useSettings'
import type { CoverConfig, Align } from '../hooks/useSettings'
import CoverPage from '../components/CoverPage'
import type { CoverMeta } from '../components/CoverPage'

/* ── 재사용 UI ── */
const LAYOUTS: { value: CoverConfig['layout']; label: string; desc: string }[] = [
  { value: 'centered', label: '중앙 정렬', desc: '고객사(상단) · 문서정보(중앙) · 수행사(하단)' },
  { value: 'sidebar',  label: '사이드바',  desc: '왼쪽 컬러 세로줄 + 우측 콘텐츠' },
  { value: 'header',   label: '헤더형',    desc: '상단 컬러 헤더 블록 + 흰 본문' },
]

const ACCENT_PRESETS = [
  { label: '다크',   hex: '#111827' },
  { label: '네이비', hex: '#1e3a5f' },
  { label: '인디고', hex: '#4f46e5' },
  { label: '블루',   hex: '#2563eb' },
  { label: '그린',   hex: '#15803d' },
  { label: '레드',   hex: '#dc2626' },
]

const TOGGLE_FIELDS: { key: keyof CoverConfig; label: string; group: string }[] = [
  { key: 'showClientLogo',    label: '고객사 로고 표시',  group: '고객사' },
  { key: 'showClientName',    label: '고객사 명 표시',    group: '고객사' },
  { key: 'showPerformerLogo', label: '수행사 로고 표시',  group: '수행사' },
  { key: 'showPerformerName', label: '수행사 명 표시',    group: '수행사' },
  { key: 'showCode',          label: '문서 코드 표시',    group: '문서 정보' },
  { key: 'showVersion',       label: '버전 배지 표시',    group: '문서 정보' },
  { key: 'showDivider',       label: '구분선 표시',       group: '문서 정보' },
  { key: 'showDate',          label: '날짜 표시',         group: '문서 정보' },
]

const ALIGN_SECTIONS: { key: 'alignTop' | 'alignTitle' | 'alignBottom'; label: string }[] = [
  { key: 'alignTop',    label: '고객사 (상단)' },
  { key: 'alignTitle',  label: '문서 제목 (중앙)' },
  { key: 'alignBottom', label: '수행사 (하단)' },
]

function AlignButtons({ value, onChange }: { value: Align; onChange: (v: Align) => void }) {
  const opts: { v: Align; icon: string }[] = [
    { v: 'left',   icon: '▐ —' },
    { v: 'center', icon: '— —' },
    { v: 'right',  icon: '— ▌' },
  ]
  return (
    <div className="flex gap-1">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          title={o.v === 'left' ? '왼쪽' : o.v === 'center' ? '가운데' : '오른쪽'}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
            value === o.v ? 'bg-primary text-white border-primary' : 'border-line text-content-muted hover:border-content-muted'
          }`}>
          {o.icon}
        </button>
      ))}
    </div>
  )
}

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>()
  const { project, loading } = useProject(id!)
  const { updateProject } = useProjects()
  const { settings } = useSettings()

  /* 고객사 정보 */
  const [clientName,    setClientName]    = useState('')
  const [clientLogoUrl, setClientLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  /* 표지 설정 */
  const [useProjectCover, setUseProjectCover] = useState(false)
  const [cfg, setCfg] = useState<CoverConfig>(DEFAULT_COVER_CONFIG)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!project || initialized) return
    setClientName(project.clientName ?? '')
    setClientLogoUrl(project.logoUrl ?? '')
    if (project.coverConfig) {
      setUseProjectCover(true)
      setCfg({ ...DEFAULT_COVER_CONFIG, ...(project.coverConfig as Partial<CoverConfig>) })
    }
    setInitialized(true)
  }, [project, initialized])

  const patch = (partial: Partial<CoverConfig>) => setCfg(prev => ({ ...prev, ...partial }))

  /* 고객사 로고 업로드 */
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingLogo(true)
    try {
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `client-logos/${id}.${ext}`
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}`
      setClientLogoUrl(url)
      await updateProject(id, { logoUrl: url })
    } catch (err) { alert((err as Error).message) }
    finally { setUploadingLogo(false); if (logoRef.current) logoRef.current.value = '' }
  }

  async function handleRemoveLogo() {
    if (!id) return
    setClientLogoUrl('')
    await updateProject(id, { logoUrl: null })
  }

  /* 저장 */
  async function handleSave() {
    if (!id) return
    setSaving(true)
    try {
      await updateProject(id, {
        clientName,
        logoUrl:     clientLogoUrl || null,
        coverConfig: useProjectCover ? (cfg as unknown as Record<string, unknown>) : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) { alert((err as Error).message) }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-surface-hover rounded-xl animate-pulse" />)}
      </div>
    )
  }
  if (!project) return <div className="p-8 text-center text-content-subtle">프로젝트를 찾을 수 없습니다.</div>

  /* 미리보기 메타 — 실제 프로젝트 데이터 사용 */
  const previewMeta: CoverMeta = {
    title:       '사업수행계획서',
    code:        'PROJ-01-PP-010',
    version:     'v0.1',
    projectName: project.name,
    clientName:  clientName || '(주)고객사',
    clientLogoUrl: clientLogoUrl || undefined,
  }

  /* 미리보기용 settings: 글로벌 settings + 프로젝트 coverConfig */
  const previewSettings = {
    ...settings,
    coverConfig: useProjectCover ? cfg : settings.coverConfig,
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-line bg-surface px-8 py-5">
        <div className="flex items-center gap-1.5 text-xs text-content-subtle mb-2">
          <Link to="/projects" className="hover:text-content">프로젝트</Link>
          <ChevronRight size={12} />
          <Link to={`/projects/${id}`} className="hover:text-content">{project.name}</Link>
          <ChevronRight size={12} />
          <span className="text-content">프로젝트 설정</span>
        </div>
        <h1 className="text-xl font-bold text-content">프로젝트 설정</h1>
        <p className="text-sm text-content-muted mt-0.5">{project.name}</p>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── 고객사 정보 ── */}
          <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-content">
              <Building2 size={16} className="text-content-muted" />고객사 정보
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 고객사명 */}
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">고객사명</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="(주)고객사"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-content text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                <p className="text-xs text-content-subtle mt-1">표지에 표시될 고객사 이름</p>
              </div>

              {/* 고객사 로고 */}
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1.5">고객사 로고</label>
                {clientLogoUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={clientLogoUrl} alt="고객사 로고" className="h-12 max-w-[120px] object-contain border border-line rounded-lg p-1 bg-white" />
                    <div className="flex gap-2">
                      <button onClick={() => logoRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-content-muted hover:border-primary hover:text-primary transition-colors">
                        <Upload size={11} />교체
                      </button>
                      <button onClick={handleRemoveLogo}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger/30 text-xs text-danger hover:bg-danger-soft transition-colors">
                        <X size={11} />삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-line hover:border-primary hover:bg-primary-soft/30 text-sm text-content-muted hover:text-primary transition-colors w-full justify-center">
                    <Upload size={14} />
                    {uploadingLogo ? '업로드 중...' : '로고 업로드 (PNG, SVG 권장)'}
                  </button>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>
          </section>

          {/* ── 표지 설정 ── */}
          <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-content">
                <FileText size={16} className="text-content-muted" />표지 설정
              </h2>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-content-muted">프로젝트별 설정 사용</span>
                <div
                  onClick={() => setUseProjectCover(p => !p)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${useProjectCover ? 'bg-primary' : 'bg-line'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${useProjectCover ? 'translate-x-4' : ''}`} />
                </div>
              </label>
            </div>

            {!useProjectCover && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-canvas border border-line text-sm text-content-muted">
                <RotateCcw size={13} />
                글로벌 설정({'/설정 → 표지 설정'})을 사용 중입니다. 위 토글로 프로젝트별 설정을 활성화하세요.
              </div>
            )}

            {useProjectCover && (
              <div className="space-y-5">
                {/* 레이아웃 */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-content">
                    <LayoutTemplate size={14} className="text-content-muted" />레이아웃
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {LAYOUTS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => patch({ layout: opt.value })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          cfg.layout === opt.value ? 'border-primary bg-primary-soft' : 'border-line hover:border-content-muted'
                        }`}>
                        <p className={`text-sm font-semibold mb-0.5 ${cfg.layout === opt.value ? 'text-primary' : 'text-content'}`}>{opt.label}</p>
                        <p className="text-xs text-content-subtle leading-relaxed">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 강조 색상 */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-content">
                    <Palette size={14} className="text-content-muted" />강조 색상
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    {ACCENT_PRESETS.map(c => (
                      <button key={c.hex} type="button" title={c.label} onClick={() => patch({ accentColor: c.hex })}
                        className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 relative"
                        style={{
                          backgroundColor: c.hex,
                          borderColor: cfg.accentColor === c.hex ? '#000' : 'transparent',
                          transform: cfg.accentColor === c.hex ? 'scale(1.15)' : undefined,
                        }}>
                        {cfg.accentColor === c.hex && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>
                        )}
                      </button>
                    ))}
                    <label className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-lg cursor-pointer hover:bg-surface-hover text-sm text-content-muted">
                      <input type="color" value={cfg.accentColor} onChange={e => patch({ accentColor: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent" />
                      직접 선택
                    </label>
                  </div>
                </div>

                {/* 표시 항목 */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-content">표시 항목</h3>
                  <div className="space-y-4">
                    {(['고객사', '수행사', '문서 정보'] as const).map(grp => (
                      <div key={grp}>
                        <p className="text-xs font-semibold text-content-subtle uppercase tracking-wider mb-2">{grp}</p>
                        <div className="space-y-2 pl-1">
                          {TOGGLE_FIELDS.filter(f => f.group === grp).map(f => (
                            <label key={f.key} className="flex items-center gap-3 cursor-pointer group">
                              <div
                                onClick={() => patch({ [f.key]: !cfg[f.key] })}
                                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${cfg[f.key] ? 'bg-primary' : 'bg-line'}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${cfg[f.key] ? 'translate-x-4' : ''}`} />
                              </div>
                              <span className="text-sm text-content">{f.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 정렬 */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-content">섹션 정렬</h3>
                  <div className="space-y-3">
                    {ALIGN_SECTIONS.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-content-muted">{label}</span>
                        <AlignButtons value={cfg[key]} onChange={v => patch({ [key]: v })} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 저장 버튼 */}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
              <Save size={14} />{saving ? '저장 중…' : '저장'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 size={14} />저장되었습니다
              </span>
            )}
          </div>

          {/* ── 실시간 표지 미리보기 ── */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-content">표지 미리보기</h2>
            <p className="text-xs text-content-subtle">실제 프로젝트 이름과 고객사 정보로 표지가 렌더됩니다.</p>
            <div className="border border-line rounded-xl overflow-hidden shadow-sm bg-white"
                 style={{ height: 520 }}>
              <CoverPage meta={previewMeta} settings={previewSettings} preview />
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
