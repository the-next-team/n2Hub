import { useRef, useState } from 'react'
import { User, Building2, Upload, X, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/auth'

/* ─── 계정 정보 섹션 ──────────────────────────────────────── */
function AccountSection() {
  const { user } = useAuth()
  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-content">
        <User size={16} className="text-content-muted" />
        계정 정보
      </h2>
      <div className="grid grid-cols-1 gap-3 max-w-md">
        <div>
          <label className="block text-xs font-medium text-content-muted mb-1">이메일</label>
          <input
            type="text"
            value={user?.email ?? ''}
            disabled
            className="w-full px-3 py-2 rounded-lg border border-line bg-surface-hover text-content-muted text-sm cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-content-muted mb-1">사용자 ID</label>
          <input
            type="text"
            value={user?.id ?? ''}
            disabled
            className="w-full px-3 py-2 rounded-lg border border-line bg-surface-hover text-content-muted text-xs font-mono cursor-not-allowed"
          />
        </div>
      </div>
      <p className="text-xs text-content-subtle">이메일 변경은 현재 지원하지 않습니다.</p>
    </section>
  )
}

/* ─── 회사 정보 섹션 ──────────────────────────────────────── */
function WorkspaceSection() {
  const { settings, loading, saving, error, saveSettings, uploadLogo, removeLogo } = useSettings()
  const [companyName, setCompanyName] = useState('')
  const [footerText, setFooterText] = useState('')
  const [saved, setSaved] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // settings 로드 후 폼 초기화 (한 번만)
  const [initialized, setInitialized] = useState(false)
  if (!loading && !initialized) {
    setCompanyName(settings.companyName)
    setFooterText(settings.footerText)
    setInitialized(true)
  }

  const handleSave = async () => {
    await saveSettings({ companyName, footerText })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      await uploadLogo(file)
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <section className="bg-surface border border-line rounded-xl p-6">
        <div className="h-40 flex items-center justify-center text-content-muted text-sm">
          설정을 불러오는 중…
        </div>
      </section>
    )
  }

  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-content">
        <Building2 size={16} className="text-content-muted" />
        워크스페이스 정보
      </h2>

      {/* 오류 */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* 저장 완료 */}
      {saved && (
        <div className="flex items-center gap-2 text-sm text-success bg-success-soft rounded-lg px-3 py-2">
          <CheckCircle2 size={14} />
          저장되었습니다.
        </div>
      )}

      {/* 로고 */}
      <div>
        <label className="block text-xs font-medium text-content-muted mb-2">회사 로고</label>
        <div className="flex items-start gap-4">
          {/* 미리보기 */}
          <div className="w-24 h-24 rounded-xl border border-line bg-surface-hover flex items-center justify-center overflow-hidden shrink-0">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="회사 로고"
                className="max-w-full max-h-full object-contain p-1"
              />
            ) : (
              <Building2 size={28} className="text-content-subtle" />
            )}
          </div>
          {/* 업로드/삭제 */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line hover:border-primary/40 hover:bg-primary-soft text-sm text-content-muted hover:text-primary transition-colors disabled:opacity-50"
            >
              <Upload size={13} />
              {logoUploading ? '업로드 중…' : '로고 변경'}
            </button>
            {settings.logoPath && (
              <button
                onClick={removeLogo}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line hover:border-danger/40 hover:bg-danger-soft text-sm text-content-muted hover:text-danger transition-colors"
              >
                <X size={13} />
                로고 삭제
              </button>
            )}
            <p className="text-xs text-content-subtle">
              PNG, JPG, SVG · 최대 2 MB<br />
              표지 및 문서 헤더에 자동 반영됩니다.
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleLogoChange}
        />
      </div>

      {/* 회사명 */}
      <div className="max-w-md">
        <label className="block text-xs font-medium text-content-muted mb-1">회사명</label>
        <input
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="(주)n2soft"
          className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-content text-sm placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition"
        />
        <p className="text-xs text-content-subtle mt-1">표지, 문서 헤더, 바닥글에 표시됩니다.</p>
      </div>

      {/* 바닥글 */}
      <div className="max-w-md">
        <label className="block text-xs font-medium text-content-muted mb-1">문서 바닥글</label>
        <textarea
          value={footerText}
          onChange={e => setFooterText(e.target.value)}
          rows={2}
          placeholder="대외비 · 무단 복제 및 배포를 금합니다."
          className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-content text-sm placeholder-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition resize-none"
        />
        <p className="text-xs text-content-subtle mt-1">PDF 출력 시 모든 페이지 하단에 표시됩니다.</p>
      </div>

      {/* 저장 버튼 */}
      <div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? '저장 중…' : '변경 사항 저장'}
        </button>
      </div>
    </section>
  )
}

/* ─── 페이지 ──────────────────────────────────────────────── */
export default function Settings() {
  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="설정" description="워크스페이스와 계정을 설정하세요." />
      <div className="space-y-4">
        <WorkspaceSection />
        <AccountSection />
      </div>
    </div>
  )
}
