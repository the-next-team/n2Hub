import { useRef, useState } from 'react'
import {
  User, Building2, Upload, X, Save, AlertCircle, CheckCircle2, Camera,
} from 'lucide-react'
import { PageHeader } from '../components/ui'
import { useSettings } from '../hooks/useSettings'
import type { CoverStyle } from '../hooks/useSettings'
import { useAuth } from '../lib/auth'
import { UserAvatar } from '../components/UserAvatar'

/* ── 이모지 / 배경색 목록 ── */
const EMOJI_LIST = [
  '😀','😄','😎','🤩','🥳','🤓','😇','🥸','🤠','🧐',
  '🤖','👻','🦸','🧙','👑','🎃','🧛','🧜','🦄','🧞',
  '🐱','🐶','🦊','🐻','🐼','🐯','🦁','🐸','🐺','🐨',
  '🔥','⚡','💎','🌊','🌸','🚀','🎯','🏆','🎸','🌈',
]

const BG_COLORS = [
  '#4f46e5','#2563eb','#0891b2','#0d9488','#16a34a',
  '#65a30d','#ca8a04','#ea580c','#dc2626','#db2777',
  '#9333ea','#7c3aed','#475569','#1e293b',
]

/* ─── 계정 정보 ───────────────────────────────────────────── */
function AccountSection() {
  const { user } = useAuth()
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [pickerTab,  setPickerTab]    = useState<'emoji' | 'photo'>('emoji')
  const [uploading,  setUploading]    = useState(false)
  const [saving,     setSaving]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const meta = user?.user_metadata ?? {}
  const avatarUrl   = meta.avatar_url   as string | undefined
  const avatarEmoji = meta.avatar_emoji as string | undefined
  const avatarBg    = meta.avatar_bg    as string | undefined
  const initial     = (meta.display_name as string | undefined)?.[0]
                   ?? user?.email?.[0]
                   ?? '?'

  const [selEmoji, setSelEmoji] = useState(avatarEmoji ?? '')
  const [selBg,    setSelBg]    = useState(avatarBg    ?? '#4f46e5')

  async function applyEmoji() {
    setSaving(true)
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.auth.updateUser({ data: { avatar_emoji: selEmoji, avatar_bg: selBg, avatar_url: null } })
      window.location.reload()
    } catch (err) { alert((err as Error).message) }
    finally { setSaving(false) }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${user.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.auth.updateUser({
        data: { avatar_url: `${data.publicUrl}?t=${Date.now()}`, avatar_emoji: null },
      })
      window.location.reload()
    } catch (err) { alert((err as Error).message) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleRemove() {
    const { supabase } = await import('../lib/supabase')
    await supabase.auth.updateUser({ data: { avatar_url: null, avatar_emoji: null, avatar_bg: null } })
    window.location.reload()
  }

  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-content">
        <User size={16} className="text-content-muted" />계정 정보
      </h2>

      {/* 프로필 아바타 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPickerOpen(true)}
          className="relative shrink-0 group"
          title="아바타 변경"
        >
          <UserAvatar
            avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} avatarBg={avatarBg}
            initial={initial} size={64}
            className="ring-2 ring-line group-hover:ring-primary transition-all"
          />
          <span className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={18} className="text-white" />
          </span>
        </button>

        <div className="space-y-1.5">
          <button onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-lg text-sm text-content-muted hover:border-primary/40 hover:bg-primary-soft hover:text-primary transition-colors">
            <Camera size={13} />아바타 변경
          </button>
          {(avatarUrl || avatarEmoji) && (
            <button onClick={handleRemove}
              className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-lg text-sm text-content-muted hover:border-danger/40 hover:bg-danger-soft hover:text-danger transition-colors">
              <X size={13} />기본으로 초기화
            </button>
          )}
        </div>
      </div>

      {/* 아바타 피커 모달 */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPickerOpen(false)}>
          <div className="bg-surface rounded-2xl shadow-modal border border-line w-[420px] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-content">아바타 설정</h3>
              <button onClick={() => setPickerOpen(false)} className="p-1 rounded-lg hover:bg-surface-hover">
                <X size={15} className="text-content-muted" />
              </button>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 border-b border-line">
              {(['emoji', 'photo'] as const).map(t => (
                <button key={t} onClick={() => setPickerTab(t)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                    pickerTab === t ? 'border-primary text-primary' : 'border-transparent text-content-muted hover:text-content'
                  }`}>
                  {t === 'emoji' ? '🎨 이모지' : '📷 사진 업로드'}
                </button>
              ))}
            </div>

            {pickerTab === 'emoji' && (
              <div className="space-y-4">
                {/* 미리보기 */}
                <div className="flex items-center gap-3">
                  <UserAvatar avatarEmoji={selEmoji || undefined} avatarBg={selBg} initial={initial} size={56} />
                  <span className="text-xs text-content-subtle">미리보기</span>
                </div>

                {/* 이모지 그리드 */}
                <div>
                  <p className="text-xs font-medium text-content-muted mb-2">이모지 선택</p>
                  <div className="grid grid-cols-10 gap-1">
                    {EMOJI_LIST.map(e => (
                      <button key={e} onClick={() => setSelEmoji(e)}
                        className={`text-xl p-1 rounded-lg transition-all hover:scale-125 ${selEmoji === e ? 'bg-primary-soft ring-2 ring-primary scale-110' : 'hover:bg-surface-hover'}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 배경색 */}
                <div>
                  <p className="text-xs font-medium text-content-muted mb-2">배경색</p>
                  <div className="flex gap-2 flex-wrap">
                    {BG_COLORS.map(c => (
                      <button key={c} onClick={() => setSelBg(c)}
                        className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 relative"
                        style={{ backgroundColor: c, borderColor: selBg === c ? '#fff' : 'transparent', outline: selBg === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                      />
                    ))}
                  </div>
                </div>

                <button onClick={applyEmoji} disabled={!selEmoji || saving}
                  className="w-full py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
                  {saving ? '저장 중…' : '적용'}
                </button>
              </div>
            )}

            {pickerTab === 'photo' && (
              <div className="space-y-4">
                <p className="text-sm text-content-muted">PNG, JPG, WebP 이미지를 업로드하세요.</p>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-line hover:border-primary hover:bg-primary-soft/30 text-sm text-content-muted hover:text-primary transition-colors">
                  <Upload size={16} />
                  {uploading ? '업로드 중…' : '사진 선택'}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoUpload} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 max-w-md">
        <div>
          <label className="block text-xs font-medium text-content-muted mb-1">이메일</label>
          <input type="text" value={user?.email ?? ''} disabled
            className="w-full px-3 py-2 rounded-lg border border-line bg-surface-hover text-content-muted text-sm cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-xs font-medium text-content-muted mb-1">사용자 ID</label>
          <input type="text" value={user?.id ?? ''} disabled
            className="w-full px-3 py-2 rounded-lg border border-line bg-surface-hover text-content-muted text-xs font-mono cursor-not-allowed" />
        </div>
      </div>
      <p className="text-xs text-content-subtle">이메일 변경은 현재 지원하지 않습니다.</p>
    </section>
  )
}

/* ─── 워크스페이스 설정 ────────────────────────────────────── */
function WorkspaceSection() {
  const { settings, loading, saving, error, saveSettings, uploadLogo, removeLogo } = useSettings()
  const [companyName, setCompanyName] = useState('')
  const [footerText,  setFooterText]  = useState('')
  const [saved,         setSaved]         = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [initialized, setInitialized] = useState(false)
  if (!loading && !initialized) {
    setCompanyName(settings.companyName)
    setFooterText(settings.footerText)
    setInitialized(true)
  }

  const handleSave = async () => {
    await saveSettings({ companyName, footerText, coverStyle: settings.coverStyle })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setLogoUploading(true)
    try { await uploadLogo(file) } finally {
      setLogoUploading(false); if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) return (
    <section className="bg-surface border border-line rounded-xl p-6">
      <div className="h-40 flex items-center justify-center text-content-muted text-sm">설정을 불러오는 중…</div>
    </section>
  )

  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-content">
        <Building2 size={16} className="text-content-muted" />수행사 정보
      </h2>
      {error && <div className="flex items-center gap-2 text-sm text-danger bg-danger-soft rounded-lg px-3 py-2"><AlertCircle size={14} />{error}</div>}
      {saved && <div className="flex items-center gap-2 text-sm text-success bg-success-soft rounded-lg px-3 py-2"><CheckCircle2 size={14} />저장되었습니다.</div>}

      {/* 로고 */}
      <div>
        <label className="block text-xs font-medium text-content-muted mb-2">수행사 로고 <span className="text-content-subtle">(표지 하단)</span></label>
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-xl border border-line bg-surface-hover flex items-center justify-center overflow-hidden shrink-0">
            {settings.logoUrl
              ? <img src={settings.logoUrl} alt="수행사 로고" className="max-w-full max-h-full object-contain p-1" />
              : <Building2 size={28} className="text-content-subtle" />}
          </div>
          <div className="space-y-2 pt-1">
            <button onClick={() => fileRef.current?.click()} disabled={logoUploading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line hover:border-primary/40 hover:bg-primary-soft text-sm text-content-muted hover:text-primary transition-colors disabled:opacity-50">
              <Upload size={13} />{logoUploading ? '업로드 중…' : '로고 변경'}
            </button>
            {settings.logoPath && (
              <button onClick={removeLogo}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line hover:border-danger/40 hover:bg-danger-soft text-sm text-content-muted hover:text-danger transition-colors">
                <X size={13} />로고 삭제
              </button>
            )}
            <p className="text-xs text-content-subtle">PNG, JPG, SVG · 최대 2 MB</p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoChange} />
      </div>

      {/* 회사명 */}
      <div className="max-w-md">
        <label className="block text-xs font-medium text-content-muted mb-1">수행사명</label>
        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
          placeholder="(주)엔투소프트"
          className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-content text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
      </div>

      {/* 바닥글 */}
      <div className="max-w-md">
        <label className="block text-xs font-medium text-content-muted mb-1">문서 바닥글</label>
        <textarea value={footerText} onChange={e => setFooterText(e.target.value)} rows={2}
          placeholder="대외비 · 무단 복제 및 배포를 금합니다."
          className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-content text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none" />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
        <Save size={14} />{saving ? '저장 중…' : '저장'}
      </button>
    </section>
  )
}

/* ─── 표지 설정 ────────────────────────────────────────────── */
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

/* 정렬 버튼 그룹 */
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

const ALIGN_SECTIONS: { key: 'alignTop' | 'alignTitle' | 'alignBottom'; label: string }[] = [
  { key: 'alignTop',    label: '고객사 (상단)' },
  { key: 'alignTitle',  label: '문서 제목 (중앙)' },
  { key: 'alignBottom', label: '수행사 (하단)' },
]

const TOGGLE_FIELDS: { key: keyof CoverConfig; label: string; group?: string }[] = [
  { key: 'showClientLogo',    label: '고객사 로고 표시',  group: '고객사' },
  { key: 'showClientName',    label: '고객사 명 표시',    group: '고객사' },
  { key: 'showPerformerLogo', label: '수행사 로고 표시',  group: '수행사' },
  { key: 'showPerformerName', label: '수행사 명 표시',    group: '수행사' },
  { key: 'showCode',          label: '문서 코드 표시 (예: FNDB-01-PP-010)', group: '문서 정보' },
  { key: 'showVersion',       label: '버전 배지 표시 (예: v0.1)',           group: '문서 정보' },
  { key: 'showDivider',       label: '구분선 표시',       group: '문서 정보' },
  { key: 'showDate',          label: '날짜 표시',         group: '문서 정보' },
]

const SAMPLE_META: CoverMeta = {
  title:       '사업수행계획서',
  code:        'PROJ-01-PP-010',
  version:     'v0.1',
  projectName: '프로젝트명',
  clientName:  '(주)고객사',
}

function CoverSection() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const [cfg,   setCfg]   = useState<CoverConfig>(DEFAULT_COVER_CONFIG)
  const [saved, setSaved] = useState(false)
  const [initialized, setInit] = useState(false)

  if (!loading && !initialized) {
    setCfg({ ...DEFAULT_COVER_CONFIG, ...settings.coverConfig })
    setInit(true)
  }

  const patch = (partial: Partial<CoverConfig>) => setCfg(prev => ({ ...prev, ...partial }))

  const handleSave = async () => {
    await saveSettings({
      companyName: settings.companyName,
      footerText:  settings.footerText,
      coverStyle:  settings.coverStyle,
      coverConfig: cfg,
    })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-5">

      {/* 레이아웃 */}
      <section className="bg-surface border border-line rounded-xl p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-content">
          <LayoutTemplate size={16} className="text-content-muted" />레이아웃
        </h2>
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
      </section>

      {/* 강조색 */}
      <section className="bg-surface border border-line rounded-xl p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-content">
          <Palette size={16} className="text-content-muted" />강조 색상
        </h2>
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
          {/* 직접 선택 */}
          <label className="flex items-center gap-2 px-3 py-1.5 border border-line rounded-lg cursor-pointer hover:bg-surface-hover text-sm text-content-muted">
            <input type="color" value={cfg.accentColor} onChange={e => patch({ accentColor: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent" />
            직접 선택
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ backgroundColor: cfg.accentColor }} />
          <span className="text-xs font-mono text-content-muted">{cfg.accentColor}</span>
        </div>
      </section>

      {/* 표시 항목 */}
      <section className="bg-surface border border-line rounded-xl p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-content">
          <FileText size={16} className="text-content-muted" />표시 항목
        </h2>
        <div className="space-y-4">
          {(['고객사', '수행사', '문서 정보'] as const).map(grp => (
            <div key={grp}>
              <p className="text-xs font-semibold text-content-subtle uppercase tracking-wider mb-2">{grp}</p>
              <div className="space-y-2 pl-1">
                {TOGGLE_FIELDS.filter(f => f.group === grp).map(f => (
                  <label key={f.key} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => patch({ [f.key]: !cfg[f.key] })}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${
                        cfg[f.key] ? 'bg-primary' : 'bg-line'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        cfg[f.key] ? 'translate-x-4' : ''
                      }`} />
                    </div>
                    <span className="text-sm text-content group-hover:text-content-muted transition-colors">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 정렬 */}
      <section className="bg-surface border border-line rounded-xl p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-content">
          <LayoutTemplate size={16} className="text-content-muted" />섹션별 정렬
        </h2>
        <div className="space-y-4">
          {ALIGN_SECTIONS.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-content">{s.label}</span>
              <AlignButtons value={cfg[s.key] as Align} onChange={v => patch({ [s.key]: v })} />
            </div>
          ))}
        </div>
      </section>

      {/* 저장 */}
      {saved && <div className="flex items-center gap-2 text-sm text-success bg-success-soft rounded-lg px-3 py-2"><CheckCircle2 size={14} />저장되었습니다.</div>}
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
        <Save size={14} />{saving ? '저장 중…' : '표지 설정 저장'}
      </button>

      {/* 실시간 미리보기 */}
      <section className="bg-surface border border-line rounded-xl p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-content">
          <FileText size={16} className="text-content-muted" />실시간 미리보기
        </h2>
        <p className="text-xs text-content-subtle">설정을 변경하면 즉시 반영됩니다.</p>
        <div className="border border-line rounded-xl overflow-hidden shadow-card" style={{ height: 520 }}>
          <CoverPage meta={SAMPLE_META} settings={{ ...settings, coverConfig: cfg }} preview />
        </div>
        <p className="text-xs text-content-subtle">
          * 고객사 로고는 각 프로젝트 수정 화면에서 설정합니다.<br />
          * 수행사 로고·회사명은 <strong>워크스페이스 탭</strong>에서 설정합니다.
        </p>
      </section>
    </div>
  )
}

/* ─── 페이지 ──────────────────────────────────────────────── */
export default function Settings() {
  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="설정" description="워크스페이스 정보를 설정하세요." />
      <div className="space-y-4">
        <WorkspaceSection />
        <AccountSection />
      </div>
    </div>
  )
}
