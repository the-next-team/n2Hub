import type { WorkspaceSettings, CoverConfig, Align } from '../hooks/useSettings'
import { DEFAULT_COVER_CONFIG } from '../hooks/useSettings'

function alignClass(a: Align) {
  return a === 'left' ? 'items-start text-left' : a === 'right' ? 'items-end text-right' : 'items-center text-center'
}

export interface CoverMeta {
  title: string
  code?: string
  version?: string
  projectName?: string
  clientName?: string
  clientLogoUrl?: string
  date?: string
}

interface Props {
  meta: CoverMeta
  settings: WorkspaceSettings
  preview?: boolean
}

/* ── 레이아웃별 렌더 ── */

function CenteredLayout({ meta, settings, cfg, today }: {
  meta: CoverMeta; settings: WorkspaceSettings; cfg: CoverConfig; today: string
}) {
  const accent = cfg.accentColor
  const topCls    = `flex flex-col gap-2 min-h-[60px] justify-center ${alignClass(cfg.alignTop)}`
  const titleCls  = `flex flex-col gap-4 ${alignClass(cfg.alignTitle)}`
  const bottomCls = `flex flex-col gap-2 ${alignClass(cfg.alignBottom)}`

  return (
    <div className="flex flex-col justify-between w-full h-full px-16 py-14 bg-white">
      {/* 상단: 고객사 */}
      <div className={topCls}>
        {cfg.showClientLogo && meta.clientLogoUrl && (
          <img src={meta.clientLogoUrl} alt={meta.clientName} className="h-12 max-w-[180px] object-contain" />
        )}
        {cfg.showClientName && meta.clientName && (
          <p className="text-sm text-gray-500 tracking-widest font-medium">{meta.clientName}</p>
        )}
      </div>

      {/* 중앙 */}
      <div className={titleCls}>
        {cfg.showCode && meta.code && (
          <p className="text-xs font-mono tracking-widest" style={{ color: accent }}>{meta.code}</p>
        )}
        <h1 className="text-4xl font-bold text-gray-900 leading-tight">{meta.title}</h1>
        {cfg.showVersion && meta.version && (
          <span className="px-4 py-1 rounded-full border text-sm text-gray-500 self-auto" style={{ borderColor: accent + '66' }}>
            {meta.version}
          </span>
        )}
        {cfg.showDivider && <div className="w-14 h-0.5 mt-1" style={{ backgroundColor: accent }} />}
        {meta.projectName && <p className="text-base text-gray-700">{meta.projectName}</p>}
      </div>

      {/* 하단: 수행사 */}
      <div className={bottomCls}>
        {cfg.showPerformerLogo && settings.logoUrl && (
          <img src={settings.logoUrl} alt={settings.companyName} className="h-10 max-w-[140px] object-contain" />
        )}
        {cfg.showPerformerName && settings.companyName && (
          <p className="text-sm text-gray-600 font-medium">{settings.companyName}</p>
        )}
        {cfg.showDate && <p className="text-xs text-gray-400 mt-1">{today}</p>}
        {settings.footerText && <p className="text-xs text-gray-400">{settings.footerText}</p>}
      </div>
    </div>
  )
}

function SidebarLayout({ meta, settings, cfg, today }: {
  meta: CoverMeta; settings: WorkspaceSettings; cfg: CoverConfig; today: string
}) {
  const accent = cfg.accentColor
  return (
    <div className="flex w-full h-full bg-white">
      {/* 왼쪽 사이드바 */}
      <div className="w-20 shrink-0 flex flex-col items-center justify-between py-10" style={{ backgroundColor: accent }}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {settings.companyName && (
            <span className="text-white text-xs font-medium tracking-widest opacity-90">{settings.companyName}</span>
          )}
        </div>
        <div className="w-6 h-px bg-white opacity-30" />
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {cfg.showDate && <span className="text-white text-xs opacity-50">{today}</span>}
        </div>
      </div>

      {/* 우측 본문 */}
      <div className="flex-1 flex flex-col justify-between px-12 py-12">
        {/* 고객사 */}
        <div className={`flex flex-col gap-1 min-h-[48px] justify-center ${alignClass(cfg.alignTop)}`}>
          {cfg.showClientLogo && meta.clientLogoUrl && (
            <img src={meta.clientLogoUrl} alt={meta.clientName} className="h-10 max-w-[160px] object-contain" />
          )}
          {cfg.showClientName && meta.clientName && (
            <p className="text-sm text-gray-500 font-medium tracking-widest">{meta.clientName}</p>
          )}
        </div>

        {/* 문서 정보 */}
        <div className={`flex flex-col gap-3 ${alignClass(cfg.alignTitle)}`}>
          <div className="w-8 h-1" style={{ backgroundColor: accent }} />
          {cfg.showCode && meta.code && <p className="text-xs text-gray-400 font-mono">{meta.code}</p>}
          <h1 className="text-4xl font-bold text-gray-900 leading-tight">{meta.title}</h1>
          {cfg.showVersion && meta.version && <p className="text-sm font-medium" style={{ color: accent }}>{meta.version}</p>}
          {cfg.showDivider && <div className="w-full h-px bg-gray-100 my-1" />}
          {meta.projectName && <p className="text-base text-gray-600 leading-relaxed">{meta.projectName}</p>}
        </div>

        {/* 수행사 로고 */}
        <div className={`flex items-center gap-3 ${cfg.alignBottom === 'right' ? 'justify-end' : cfg.alignBottom === 'center' ? 'justify-center' : 'justify-start'}`}>
          {cfg.showPerformerLogo && settings.logoUrl && (
            <img src={settings.logoUrl} alt="" className="h-7 max-w-[100px] object-contain" />
          )}
          {cfg.showPerformerName && settings.companyName && (
            <p className="text-xs text-gray-500 font-medium">{settings.companyName}</p>
          )}
          {settings.footerText && <p className="text-xs text-gray-400">{settings.footerText}</p>}
        </div>
      </div>
    </div>
  )
}

function HeaderLayout({ meta, settings, cfg, today }: {
  meta: CoverMeta; settings: WorkspaceSettings; cfg: CoverConfig; today: string
}) {
  const accent = cfg.accentColor
  return (
    <div className="flex flex-col w-full h-full bg-white">
      {/* 다크 헤더 */}
      <div className="px-14 py-10 flex items-center justify-between shrink-0" style={{ backgroundColor: accent }}>
        <div>
          {cfg.showClientLogo && meta.clientLogoUrl && (
            <img src={meta.clientLogoUrl} alt={meta.clientName} className="h-10 max-w-[160px] object-contain brightness-0 invert" />
          )}
          {cfg.showClientName && meta.clientName && (
            <p className={`text-white font-semibold tracking-wider ${cfg.showClientLogo && meta.clientLogoUrl ? 'text-xs mt-1' : 'text-base'}`}>{meta.clientName}</p>
          )}
        </div>
        {cfg.showPerformerLogo && settings.logoUrl && (
          <img src={settings.logoUrl} alt="" className="h-8 max-w-[120px] object-contain brightness-0 invert opacity-80" />
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 flex flex-col justify-center px-14 py-10 gap-4">
        {cfg.showCode && meta.code && (
          <p className="text-xs text-gray-400 font-mono tracking-widest">{meta.code}</p>
        )}
        <h1 className="text-4xl font-bold text-gray-900 leading-tight">{meta.title}</h1>
        {cfg.showVersion && meta.version && (
          <span className="inline-block px-3 py-1 bg-gray-100 rounded text-sm text-gray-600 w-fit">{meta.version}</span>
        )}
        {cfg.showDivider && meta.projectName && <div className="w-full h-px bg-gray-200" />}
        {meta.projectName && <p className="text-base text-gray-600 leading-relaxed">{meta.projectName}</p>}
      </div>

      {/* 푸터 */}
      <div className="border-t border-gray-100 px-14 py-5 flex items-center justify-between shrink-0">
        {cfg.showPerformerName && <p className="text-sm text-gray-500">{settings.companyName}</p>}
        {!cfg.showPerformerName && <span />}
        <div className="flex items-center gap-4">
          {settings.footerText && <p className="text-xs text-gray-400">{settings.footerText}</p>}
          {cfg.showDate && <p className="text-sm text-gray-500">{today}</p>}
        </div>
      </div>
    </div>
  )
}

/* ── 메인 컴포넌트 ── */
export default function CoverPage({ meta, settings, preview = false }: Props) {
  const today  = meta.date ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const cfg: CoverConfig = { ...DEFAULT_COVER_CONFIG, ...settings.coverConfig }

  const content = cfg.layout === 'sidebar' ? (
    <SidebarLayout  meta={meta} settings={settings} cfg={cfg} today={today} />
  ) : cfg.layout === 'header' ? (
    <HeaderLayout   meta={meta} settings={settings} cfg={cfg} today={today} />
  ) : (
    <CenteredLayout meta={meta} settings={settings} cfg={cfg} today={today} />
  )

  if (preview) return <div className="w-full h-full">{content}</div>

  return (
    <div className="cover-page hidden print:block print:break-after-page" style={{ height: '100vh' }}>
      {content}
    </div>
  )
}
