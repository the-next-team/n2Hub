import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'
import { Download, Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react'
import { Button } from '../ui'

interface Props {
  fileName: string
  storagePath: string
  buffer: ArrayBuffer
  onDownload: () => void
  onSave?: (buffer: ArrayBuffer) => Promise<void>
  /** Supabase signed URL — MS Office Online 뷰어 사용 시 전달 */
  signedUrl?: string
}

// ── Microsoft Office Online 뷰어 (원본 동일 충실도) ──────────────────────────
function MsOfficeViewer({
  fileName,
  signedUrl,
  onDownload,
  onFallback,
}: {
  fileName: string
  signedUrl: string
  onDownload: () => void
  onFallback: () => void
}) {
  const [iframeKey] = useState(() => Date.now())
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`

  return (
    <div className="flex flex-col h-full bg-[#f3f3f3]">
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0 gap-3 print:hidden">
        <span className="text-sm text-gray-700 truncate max-w-sm hidden md:block font-medium">
          {fileName}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <a
            href={viewerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            title="새 탭에서 열기"
          >
            <ExternalLink size={12} />
            새 탭
          </a>
          <button
            onClick={onFallback}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
            title="docx-preview 렌더러로 전환"
          >
            대체 뷰어
          </button>
          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download size={14} />
            원본 다운로드
          </Button>
        </div>
      </div>

      {/* MS Office Online iframe */}
      <iframe
        key={iframeKey}
        src={viewerUrl}
        className="flex-1 border-0 w-full"
        title={fileName}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  )
}

// ── docx-preview 뷰어 (폴백) ─────────────────────────────────────────────────
function DocxPreviewViewer({
  fileName,
  buffer,
  onDownload,
  onSwitchMs,
}: {
  fileName: string
  buffer: ArrayBuffer
  onDownload: () => void
  onSwitchMs?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [zoom, setZoom]           = useState(100)

  useEffect(() => {
    if (!containerRef.current || !buffer) return

    setRendering(true)
    setError(null)
    containerRef.current.innerHTML = ''

    renderAsync(
      buffer,
      containerRef.current,
      undefined,
      {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        useBase64URL: true,
        renderChanges: false,
        renderComments: false,
        experimental: true,
      },
    )
      .then(() => setRendering(false))
      .catch(err => {
        console.error('[DocEditor] 렌더링 실패:', err)
        setError((err as Error).message ?? '문서를 렌더링할 수 없습니다.')
        setRendering(false)
      })
  }, [buffer])

  return (
    <div className="flex flex-col h-full" style={{ background: '#525659' }}>
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-600 bg-[#404040] shrink-0 gap-3 print:hidden">
        <span className="text-sm text-gray-300 truncate max-w-xs hidden md:block">
          {fileName}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {onSwitchMs && (
            <button
              onClick={onSwitchMs}
              className="text-xs text-gray-400 hover:text-gray-200 underline transition-colors"
              title="MS Office Online 뷰어로 전환"
            >
              MS 뷰어로 전환
            </button>
          )}

          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-1 border border-gray-500 rounded bg-[#555] px-1">
            <button
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="p-1 hover:bg-gray-600 rounded transition-colors text-gray-300"
              title="축소"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-xs text-gray-300 w-10 text-center select-none">{zoom}%</span>
            <button
              onClick={() => setZoom(z => Math.min(200, z + 10))}
              className="p-1 hover:bg-gray-600 rounded transition-colors text-gray-300"
              title="확대"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="p-1 hover:bg-gray-600 rounded transition-colors text-gray-400"
              title="100%로 초기화"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download size={14} />
            원본 다운로드
          </Button>
        </div>
      </div>

      {/* 렌더링 영역 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {rendering && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">문서를 불러오는 중...</p>
          </div>
        )}

        {!rendering && error && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm text-red-300 text-center max-w-sm px-4">{error}</p>
            <p className="text-xs text-gray-400">원본 파일을 다운로드해 로컬에서 열어보세요.</p>
            <Button variant="secondary" onClick={onDownload}>
              <Download size={14} /> 원본 다운로드
            </Button>
          </div>
        )}

        <div
          style={{
            display: rendering || error ? 'none' : 'block',
            zoom: `${zoom}%`,
          }}
          ref={containerRef}
        />
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function DocEditor({ fileName, storagePath: _storagePath, buffer, onDownload, onSave: _onSave, signedUrl }: Props) {
  // signed URL이 있으면 MS Office Online 뷰어를 기본으로 사용
  const [useMsViewer, setUseMsViewer] = useState(!!signedUrl)

  // signedUrl prop이 나중에 도착해도 반영
  useEffect(() => {
    if (signedUrl) setUseMsViewer(true)
  }, [signedUrl])

  if (useMsViewer && signedUrl) {
    return (
      <MsOfficeViewer
        fileName={fileName}
        signedUrl={signedUrl}
        onDownload={onDownload}
        onFallback={() => setUseMsViewer(false)}
      />
    )
  }

  return (
    <DocxPreviewViewer
      fileName={fileName}
      buffer={buffer}
      onDownload={onDownload}
      onSwitchMs={signedUrl ? () => setUseMsViewer(true) : undefined}
    />
  )
}
