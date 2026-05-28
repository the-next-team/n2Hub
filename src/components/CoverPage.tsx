/**
 * CoverPage — 산출물 표지 컴포넌트
 *
 * 사용법:
 *   <CoverPage meta={...} settings={...} />
 *
 * - 화면에서는 hidden (print:block)
 * - 인쇄(PDF 내보내기) 시에만 표시되며, 페이지 브레이크로 이후 내용과 분리됨
 */
import type { WorkspaceSettings } from '../hooks/useSettings'

export interface CoverMeta {
  /** 문서 제목 (예: 사업수행계획서) */
  title: string
  /** 문서 코드 (예: FNDB-01-PP-010) */
  code?: string
  /** 버전 (예: v0.1) */
  version?: string
  /** 프로젝트명 */
  projectName?: string
  /** 작성 기관 / 수신처 */
  recipient?: string
  /** 날짜 (YYYY-MM-DD 또는 YYYY년 MM월) */
  date?: string
}

interface Props {
  meta: CoverMeta
  settings: WorkspaceSettings
}

export default function CoverPage({ meta, settings }: Props) {
  const today = meta.date ?? new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    /*
     * cover-page 클래스 → @media print 에서:
     *   display: flex;  page-break-after: always;  height: 100vh;
     * 화면에서는 표시하지 않음 (print-only)
     */
    <div className="cover-page hidden print:flex print:flex-col print:items-center print:justify-between print:h-[100vh] print:px-16 print:py-20 print:bg-white print:break-after-page">

      {/* 상단: 로고 + 회사명 */}
      <div className="flex flex-col items-center gap-3">
        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt={settings.companyName || '회사 로고'}
            className="h-12 max-w-[160px] object-contain"
          />
        ) : null}
        {settings.companyName && (
          <p className="text-sm text-gray-500 tracking-widest font-medium">
            {settings.companyName}
          </p>
        )}
      </div>

      {/* 중앙: 문서 제목 */}
      <div className="flex flex-col items-center gap-6 text-center">
        {meta.code && (
          <p className="text-sm text-gray-400 tracking-widest font-mono">{meta.code}</p>
        )}

        <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight">
          {meta.title}
        </h1>

        {meta.version && (
          <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500 font-medium">{meta.version}</span>
          </div>
        )}

        {/* 구분선 */}
        <div className="w-16 h-0.5 bg-gray-900 mt-2" />

        {/* 프로젝트명 */}
        {meta.projectName && (
          <p className="text-base text-gray-700 font-medium">{meta.projectName}</p>
        )}

        {/* 수신처 */}
        {meta.recipient && (
          <p className="text-sm text-gray-500">{meta.recipient}</p>
        )}
      </div>

      {/* 하단: 날짜 + 바닥글 */}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-gray-600">{today}</p>
        {settings.footerText && (
          <p className="text-xs text-gray-400 mt-1">{settings.footerText}</p>
        )}
      </div>
    </div>
  )
}
