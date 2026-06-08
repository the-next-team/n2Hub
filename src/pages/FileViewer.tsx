import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Loader2, ArrowLeft, FileDown, Sparkles, X, MessageSquare, Send, GitBranch, MessageCircle, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import OnlyOfficeEditor from '../components/editor/OnlyOfficeEditor'
import { Button } from '../components/ui'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/auth'
import CoverPage, { type CoverMeta } from '../components/CoverPage'
import { summarizeDocument, askQuestion, convertToMarkdown } from '../lib/groq'
import { saveMdToProject } from '../lib/saveMdToProject'
import { useRegisterFileSession } from '../hooks/useFileSession'
import WorkflowPanel from '../components/WorkflowPanel'
import CommentPanel from '../components/CommentPanel'
import { useDocumentComments } from '../hooks/useDocumentComments'

/* ── 마크다운 / 텍스트 뷰어 컴포넌트 ── */
function MarkdownViewer({ buffer, fileName, onDownload }: {
  buffer: ArrayBuffer; fileName: string; onDownload: () => void
}) {
  const [tab, setTab] = useState<'preview' | 'raw'>('preview')
  const [html, setHtml] = useState('')
  const [raw, setRaw]   = useState('')
  const isMarkdown = /\.(md|markdown)$/i.test(fileName)

  useEffect(() => {
    const text = new TextDecoder('utf-8').decode(buffer)
    setRaw(text)
    if (isMarkdown) {
      import('marked').then(({ marked }) => {
        setHtml(marked.parse(text) as string)
      })
    } else {
      setHtml(`<pre style="white-space:pre-wrap;word-break:break-word">${text.replace(/</g,'&lt;')}</pre>`)
    }
  }, [buffer, isMarkdown])

  const tabCls = (active: boolean) => `px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
    active ? 'bg-surface border-line text-content' : 'border-transparent text-content-muted hover:text-content'
  }`

  return (
    <div className="flex flex-col h-full">
      {/* 툴바 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-surface shrink-0">
        {isMarkdown && (
          <>
            <button className={tabCls(tab === 'preview')} onClick={() => setTab('preview')}>미리보기</button>
            <button className={tabCls(tab === 'raw')} onClick={() => setTab('raw')}>원문</button>
          </>
        )}
        <span className="ml-auto text-xs text-content-subtle truncate max-w-xs">{fileName}</span>
        <Button variant="secondary" size="sm" onClick={onDownload}>
          <Download size={14} /> 다운로드
        </Button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'preview' ? (
          <div
            className="px-8 py-6 prose prose-sm w-full"
            style={{ fontFamily: 'var(--font-sans)' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="px-8 py-6 text-xs text-content-muted font-mono whitespace-pre-wrap break-words leading-relaxed">
            {raw}
          </pre>
        )}
      </div>

      {/* 마크다운 스타일 */}
      <style>{`
        .prose h1 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-line); }
        .prose h2 { font-size: 1.2rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
        .prose h3 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.4rem; }
        .prose p  { font-size: 0.875rem; line-height: 1.8; color: var(--color-content-muted); margin-bottom: 0.75rem; }
        .prose ul, .prose ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .prose li { font-size: 0.875rem; line-height: 1.8; color: var(--color-content-muted); }
        .prose code { font-family: monospace; font-size: 0.8rem; background: var(--color-surface-hover); padding: 1px 5px; border-radius: 4px; }
        .prose pre  { background: var(--color-surface-hover); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; overflow-x: auto; border: 1px solid var(--color-line); }
        .prose pre code { background: none; padding: 0; }
        .prose blockquote { border-left: 3px solid var(--color-primary); padding-left: 1rem; color: var(--color-content-subtle); font-style: italic; margin-bottom: 0.75rem; }
        .prose strong { font-weight: 600; color: var(--color-content); }
        .prose a { color: var(--color-primary); text-decoration: none; }
        .prose a:hover { text-decoration: underline; }
        .prose table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; font-size: 0.875rem; }
        .prose th, .prose td { border: 1px solid var(--color-line); padding: 0.5rem 0.75rem; }
        .prose th { background: var(--color-canvas); font-weight: 600; }
        .prose hr { border: none; border-top: 1px solid var(--color-line); margin: 1.5rem 0; }
      `}</style>
    </div>
  )
}

interface FileMeta {
  id: string
  original_name: string
  storage_path: string
  mime_type: string
  size: number
  project_id: string
}

function parseCoverMeta(filename: string): Pick<CoverMeta, 'code' | 'title' | 'version'> {
  const noExt = filename.replace(/\.[a-zA-Z0-9]{2,6}$/, '')
  // 코드 패턴: FNDB-02-PI-010. 또는 FNDB-BM-AN-040. 등
  const m1 = /^([A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)\.\s*(.+?)$/.exec(noExt)
  const body = m1 ? m1[2].trim() : noExt
  const code = m1 ? m1[1] : undefined
  // 버전: _v0.1 / _v0_2 / _0.7 형태
  const vMatch = /^(.+?)_v?(\d+[._]\w+)$/i.exec(body)
  if (vMatch) {
    return { code, title: vMatch[1].trim(), version: `v${vMatch[2].replace(/_/g, '.')}` }
  }
  return { code, title: body }
}

// OnlyOffice 지원 확장자 목록 (txt/md 제외 → 별도 마크다운 뷰어로 처리)
const OO_DOCX_EXTS  = new Set(['docx','doc','docm','odt','fodt','ott','rtf','html','htm','mht','mhtml','xml','epub','fb2','mobi'])
const OO_XLSX_EXTS  = new Set(['xlsx','xls','xlsm','xlsb','ods','fods','ots','csv'])
const OO_PPTX_EXTS  = new Set(['pptx','ppt','pptm','odp','fodp','otp','ppsx','pps'])
const OO_PDF_VIEWER = new Set(['pdf','djvu','xps','oxps'])
const MD_EXTS       = new Set(['md','markdown','txt'])

function getFileType(name: string, mimeType: string): 'xlsx' | 'docx' | 'pptx' | 'pdf' | 'md' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (MD_EXTS.has(ext) || mimeType === 'text/plain' || mimeType === 'text/markdown') return 'md'
  if (OO_XLSX_EXTS.has(ext)  || mimeType.includes('spreadsheet') || mimeType === 'text/csv') return 'xlsx'
  if (OO_DOCX_EXTS.has(ext)  || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'docx'
  if (OO_PPTX_EXTS.has(ext)  || mimeType.includes('presentationml') || mimeType.includes('powerpoint')) return 'pptx'
  if (OO_PDF_VIEWER.has(ext)  || mimeType === 'application/pdf') return 'pdf'
  return 'other'
}

export default function FileViewer() {
  const { id: projectId, fileId } = useParams<{ id: string; fileId: string }>()
  const navigate = useNavigate()

  const [meta, setMeta]               = useState<FileMeta | null>(null)
  const [buffer, setBuffer]           = useState<ArrayBuffer | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [projectName,    setProjectName]    = useState<string>('')
  const [clientName,     setClientName]     = useState<string>('')
  const [clientLogoUrl,  setClientLogoUrl]  = useState<string>('')
  const [withCover, setWithCover]     = useState(false)  // 레거시 (미사용)
  const [signedUrl, setSignedUrl]     = useState<string | null>(null)
  const { settings } = useSettings()
  const { user }     = useAuth()
  useRegisterFileSession(fileId)
  const [savingToProject, setSavingToProject] = useState(false)
  const [savedToProject,  setSavedToProject]  = useState(false)
  // 워크플로우·댓글 패널
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [userRole, setUserRole]           = useState<string>('')
  const { totalCount: commentCount }      = useDocumentComments(fileId ?? null, projectId ?? null)

  // AI 요약
  const [showSummary, setShowSummary]       = useState(false)
  const [summaryText, setSummaryText]       = useState('')
  const [isSummarizing, setIsSummarizing]   = useState(false)
  const [summaryError, setSummaryError]     = useState('')

  // MD 변환
  const [showMdModal, setShowMdModal]     = useState(false)
  const [mdResult, setMdResult]           = useState('')
  const [isConverting, setIsConverting]   = useState(false)

  const [convertProgress, setConvertProgress] = useState('')

  async function handleConvertToMd() {
    if (!buffer || !meta) return
    setIsConverting(true); setMdResult(''); setShowMdModal(true); setConvertProgress('')
    try {
      if (fileType === 'xlsx') {
        const XLSX = await import('xlsx')
        const wb   = XLSX.read(buffer, { type: 'buffer' })
        const results: string[] = []
        const sheets = wb.SheetNames.filter(n => {
          const ws = wb.Sheets[n]
          const txt = XLSX.utils.sheet_to_txt(ws)
          return txt.trim().length > 10
        })

        for (let i = 0; i < sheets.length; i++) {
          const sheetName = sheets[i]
          setConvertProgress(`시트 변환 중… (${i + 1}/${sheets.length}) : ${sheetName}`)
          const ws      = wb.Sheets[sheetName]
          const content = XLSX.utils.sheet_to_txt(ws).slice(0, 5000)
          try {
            const md = await convertToMarkdown(content, `${meta.original_name} - ${sheetName}`)
            results.push(`## ${sheetName}\n\n${md}`)
          } catch {
            results.push(`## ${sheetName}\n\n> 변환 실패 (내용 없음 또는 너무 큰 시트)`)
          }
        }

        const baseName = meta.original_name.replace(/\.[^.]+$/, '')
        setMdResult(`# ${baseName}\n\n${results.join('\n\n---\n\n')}`)
      } else {
        const text   = await extractText()
        const result = await convertToMarkdown(text, meta.original_name)
        setMdResult(result)
      }
    } catch (err) {
      setMdResult(`오류: ${(err as Error).message}`)
    } finally { setIsConverting(false); setConvertProgress('') }
  }

  async function handleSaveToProject(content: string, sourceFileName: string) {
    if (!projectId || !user || !content) return
    setSavingToProject(true)
    try {
      const mdName = sourceFileName.replace(/\.[^.]+$/, '') + '_AI요약.md'
      await saveMdToProject(content, mdName, projectId, user.id)
      setSavedToProject(true)
      setTimeout(() => setSavedToProject(false), 3000)
    } catch (err) {
      alert(`저장 실패: ${(err as Error).message}`)
    } finally { setSavingToProject(false) }
  }

  function downloadMd() {
    if (!mdResult || !meta) return
    const baseName = meta.original_name.replace(/\.[^.]+$/, '')
    const blob = new Blob([mdResult], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${baseName}.md`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // AI Q&A
  type QAMsg = { role: 'user' | 'assistant'; content: string }
  const [showQA, setShowQA]         = useState(false)
  const [qaMessages, setQAMessages] = useState<QAMsg[]>([])
  const [qaInput, setQAInput]       = useState('')
  const [qaLoading, setQALoading]   = useState(false)
  const [docText, setDocText]       = useState<string | null>(null)  // 추출된 텍스트 캐시
  const qaEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fileId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      const { data: row, error: dbErr } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single()

      if (dbErr || !row) {
        if (!cancelled) { setError('파일 정보를 불러올 수 없습니다.'); setLoading(false) }
        return
      }

      if (cancelled) return
      setMeta(row as FileMeta)

      const ft = getFileType(row.original_name, row.mime_type)
      const needsSignedUrl = ft === 'docx' || ft === 'xlsx' || ft === 'pptx'

      const [blobResult, signedResult] = await Promise.all([
        supabase.storage.from('documents').download(row.storage_path),
        needsSignedUrl
          ? supabase.storage.from('documents').createSignedUrl(row.storage_path, 7200)
          : Promise.resolve({ data: null, error: null }),
      ])

      const { data: blob, error: dlErr } = blobResult
      if (dlErr || !blob) {
        if (!cancelled) { setError('파일을 다운로드할 수 없습니다.'); setLoading(false) }
        return
      }

      if (!cancelled) {
        setBuffer(await blob.arrayBuffer())
        const su = (signedResult as { data?: { signedUrl?: string } | null }).data?.signedUrl
        if (su) setSignedUrl(su)
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [fileId])

  useEffect(() => {
    if (!projectId) return
    supabase.from('projects').select('name, client_name, logo_url').eq('id', projectId).single()
      .then(({ data }) => {
        if (data) {
          setProjectName(data.name ?? '')
          setClientName(data.client_name ?? '')
          setClientLogoUrl(data.logo_url ?? '')
        }
      })
    // 현재 사용자의 역할 가져오기
    if (user?.id) {
      supabase.from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setUserRole(data.role ?? '') })
    }
  }, [projectId, user?.id])

  // AI 버전 변경 요약
  // OnlyOffice 닫기 → 산출물 목록으로 이동
  const handleOOClose = useCallback(() => {
    navigate(`/projects/${projectId}/documents`)
  }, [navigate, projectId])

  // 표지 + 본문 팝업 인쇄
  const handlePrintWithCover = async () => {
    if (!buffer || !meta) return

    // 파일 형식별 HTML 변환
    let docHtml = ''
    try {
      if (fileType === 'docx') {
        const mammoth = await import('mammoth')
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer })
        docHtml = value
      } else if (fileType === 'xlsx') {
        const XLSX = await import('xlsx')
        const wb   = XLSX.read(buffer, { type: 'buffer' })
        // 각 시트를 HTML 테이블로 변환
        docHtml = wb.SheetNames.map(name => {
          const ws  = wb.Sheets[name]
          const tbl = XLSX.utils.sheet_to_html(ws, { id: `sheet-${name}` })
          return `<h2 style="font-size:13pt;font-weight:700;margin:16pt 0 6pt">${name}</h2>${tbl}`
        }).join('<hr style="margin:24pt 0" />')
      }
    } catch { /* 변환 실패 시 빈 본문 */ }

    // 표지 HTML 생성 (CoverPage 구조를 직접 조립)
    const cfg  = settings.coverConfig
    const ac   = cfg?.accentColor ?? '#111827'
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

    const coverHtml = `
      <div style="display:flex;flex-direction:column;justify-content:space-between;
                  height:100vh;padding:56px 64px;box-sizing:border-box;background:#fff;
                  page-break-after:always;border-top:8px solid ${ac}">
        <div style="text-align:${cfg?.alignTop ?? 'center'}">
          ${cfg?.showClientLogo && clientLogoUrl ? `<img src="${clientLogoUrl}" style="height:48px;max-width:180px;object-fit:contain" />` : ''}
          ${cfg?.showClientName && clientName ? `<p style="font-size:13px;color:#6b7280;letter-spacing:0.1em">${clientName}</p>` : ''}
        </div>
        <div style="text-align:${cfg?.alignTitle ?? 'center'}">
          ${cfg?.showCode && coverMeta.code ? `<p style="font-size:11px;font-family:monospace;color:${ac};letter-spacing:0.15em">${coverMeta.code}</p>` : ''}
          <h1 style="font-size:32px;font-weight:700;color:#111827;margin:12px 0">${coverMeta.title}</h1>
          ${cfg?.showVersion && coverMeta.version ? `<span style="border:1px solid #d1d5db;border-radius:999px;padding:4px 16px;font-size:13px;color:#6b7280">${coverMeta.version}</span>` : ''}
          ${cfg?.showDivider ? `<div style="width:56px;height:2px;background:${ac};margin:16px auto"></div>` : ''}
          ${projectName ? `<p style="font-size:15px;color:#374151;margin-top:8px">${projectName}</p>` : ''}
        </div>
        <div style="text-align:${cfg?.alignBottom ?? 'center'}">
          ${cfg?.showPerformerLogo && settings.logoUrl ? `<img src="${settings.logoUrl}" style="height:36px;max-width:140px;object-fit:contain" />` : ''}
          ${cfg?.showPerformerName && settings.companyName ? `<p style="font-size:13px;color:#4b5563;font-weight:500;margin-top:6px">${settings.companyName}</p>` : ''}
          ${cfg?.showDate ? `<p style="font-size:12px;color:#9ca3af;margin-top:4px">${today}</p>` : ''}
          ${settings.footerText ? `<p style="font-size:11px;color:#9ca3af">${settings.footerText}</p>` : ''}
        </div>
      </div>`

    // 팝업 창에서 인쇄
    const pw = window.open('', '_blank', 'width=900,height=700')
    if (!pw) { alert('팝업이 차단되어 있습니다. 팝업 허용 후 다시 시도하세요.'); return }
    pw.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8" />
      <title>${meta.original_name}</title>
      <style>
        body { margin:0; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; }
        @page { margin: 2cm; size: A4; }
        @page :first { margin: 0; }
        .doc-content { line-height:1.8; font-size:10.5pt; }
        .doc-content h1 { font-size:16pt; font-weight:700; margin:14pt 0 6pt; }
        .doc-content h2 { font-size:13pt; font-weight:700; margin:12pt 0 5pt; }
        .doc-content h3 { font-size:11pt; font-weight:600; margin:10pt 0 4pt; }
        .doc-content p  { margin:4pt 0; }
        .doc-content table { border-collapse:collapse; width:100%; font-size:9pt; }
        .doc-content td,.doc-content th { border:0.5pt solid #aaa; padding:3pt 5pt; }
        .doc-content th { background:#f0f0f0; }
        /* xlsx 시트 테이블 */
        table[id^="sheet-"] { border-collapse:collapse; width:100%; font-size:8.5pt; margin-bottom:8pt; }
        table[id^="sheet-"] td { border:0.4pt solid #ccc; padding:2pt 4pt; white-space:nowrap; }
      </style>
    </head><body>
      ${coverHtml}
      <div class="doc-content">${docHtml}</div>
    </body></html>`)
    pw.document.close()
    pw.addEventListener('load', () => { pw.print(); pw.close() })
  }

  // 파일 타입별 텍스트 추출
  async function extractText(): Promise<string> {
    if (!buffer) throw new Error('파일 데이터를 불러올 수 없습니다.')

    if (fileType === 'docx') {
      const mammoth = await import('mammoth')
      const result  = await mammoth.extractRawText({ arrayBuffer: buffer })
      return result.value
    }

    if (fileType === 'xlsx') {
      const XLSX = await import('xlsx')
      const wb   = XLSX.read(buffer, { type: 'buffer' })
      return wb.SheetNames.map(name => {
        const ws = wb.Sheets[name]
        return `[시트: ${name}]\n${XLSX.utils.sheet_to_txt(ws)}`
      }).join('\n\n')
    }

    // CSV / TXT
    return new TextDecoder('utf-8').decode(buffer)
  }

  async function handleAISummary() {
    if (!meta) return
    setIsSummarizing(true)
    setSummaryText('')
    setSummaryError('')
    setShowSummary(true)
    try {
      const text    = await extractText()
      const summary = await summarizeDocument(text, meta.original_name)
      setSummaryText(summary)
    } catch (err) {
      setSummaryError((err as Error).message)
    } finally {
      setIsSummarizing(false)
    }
  }

  // Q&A 패널 열기 — 문서 텍스트 추출 후 캐시
  async function handleOpenQA() {
    setShowQA(true)
    if (!docText && buffer && meta) {
      try {
        const text = await extractText()
        setDocText(text)
      } catch { /* 추출 실패 시 빈 컨텍스트로 진행 */ }
    }
  }

  // 질문 전송
  async function handleQASend() {
    if (!qaInput.trim() || qaLoading || !meta) return
    const question = qaInput.trim()
    setQAInput('')
    const newHistory: { role: 'user' | 'assistant'; content: string }[] = [
      ...qaMessages,
      { role: 'user', content: question },
    ]
    setQAMessages(newHistory)
    setQALoading(true)
    setTimeout(() => qaEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const answer = await askQuestion(docText ?? '', meta.original_name, qaMessages, question)
      setQAMessages([...newHistory, { role: 'assistant', content: answer }])
    } catch (err) {
      setQAMessages([...newHistory, { role: 'assistant', content: `오류: ${(err as Error).message}` }])
    } finally {
      setQALoading(false)
      setTimeout(() => qaEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  // 캔버스로 표지 이미지 렌더링 → Excel 첫 시트에 A4 크기로 삽입
  const handleAddCoverSheet = async () => {
    if (!buffer || !meta) return

    const cfg   = settings.coverConfig
    const ac    = cfg?.accentColor ?? '#111827'
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

    // A4 @ 150dpi (1240 × 1754 px)
    const W = 1240, H = 1754
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!

    // ── 헬퍼 ──────────────────────────────────────────────────────────────
    const loadImg = (url: string): Promise<HTMLImageElement | null> =>
      new Promise(resolve => {
        const img = new Image(); img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = url
      })

    const xFor = (align: string, w: number, pad = 80) =>
      align === 'right' ? W - pad - w : align === 'left' ? pad : (W - w) / 2

    const textX = (align: string, pad = 80) =>
      align === 'right' ? W - pad : align === 'left' ? pad : W / 2

    const textAlign = (align: string): CanvasTextAlign =>
      align === 'right' ? 'right' : align === 'left' ? 'left' : 'center'

    // ── 배경 ───────────────────────────────────────────────────────────────
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)

    // 상단 강조선
    ctx.fillStyle = ac
    ctx.fillRect(0, 0, W, 12)

    // ── 상단 로고 영역 ─────────────────────────────────────────────────────
    const LOGO_H = 90, LOGO_Y = 80, PAD = 80
    const topAlign = cfg?.alignTop ?? 'center'

    // 고객사 로고 (왼쪽) / 수행사 로고 (오른쪽)
    if (cfg?.showClientLogo && clientLogoUrl) {
      const img = await loadImg(clientLogoUrl)
      if (img) {
        const scale = Math.min(240 / img.width, LOGO_H / img.height)
        const iw = img.width * scale, ih = img.height * scale
        const ix = topAlign === 'center' ? (W / 2 - iw) / 2 : PAD
        ctx.drawImage(img, ix, LOGO_Y, iw, ih)
      }
    }
    if (cfg?.showPerformerLogo && settings.logoUrl) {
      const img = await loadImg(settings.logoUrl)
      if (img) {
        const scale = Math.min(240 / img.width, LOGO_H / img.height)
        const iw = img.width * scale, ih = img.height * scale
        const ix = topAlign === 'center' ? W / 2 + (W / 2 - iw) / 2 : W - PAD - iw
        ctx.drawImage(img, ix, LOGO_Y, iw, ih)
      }
    }

    // 고객사명 / 수행사명
    let nameY = LOGO_Y + LOGO_H + 20
    ctx.font = '26px "Malgun Gothic", Arial, sans-serif'
    ctx.fillStyle = '#6B7280'
    if (cfg?.showClientName && clientName) {
      ctx.textAlign = 'left'; ctx.fillText(clientName, PAD, nameY)
    }
    if (cfg?.showPerformerName && settings.companyName) {
      ctx.textAlign = 'right'; ctx.fillText(settings.companyName, W - PAD, nameY)
    }

    // 구분선
    nameY += 30
    ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(PAD, nameY); ctx.lineTo(W - PAD, nameY); ctx.stroke()

    // ── 중앙: 문서 정보 ────────────────────────────────────────────────────
    const titleAlign = cfg?.alignTitle ?? 'center'
    let midY = H * 0.4

    if (cfg?.showCode && coverMeta?.code) {
      ctx.font = 'italic 28px "Malgun Gothic", Arial'
      ctx.fillStyle = ac
      ctx.textAlign = textAlign(titleAlign)
      ctx.fillText(coverMeta.code, textX(titleAlign), midY)
      midY += 50
    }

    if (coverMeta?.title) {
      ctx.font = 'bold 56px "Malgun Gothic", Arial'
      ctx.fillStyle = '#111827'
      ctx.textAlign = textAlign(titleAlign)
      // 긴 제목은 줄바꿈
      const words = coverMeta.title
      const maxW  = W - PAD * 2
      if (ctx.measureText(words).width > maxW) {
        const mid = Math.ceil(words.length / 2)
        const line1 = words.slice(0, mid), line2 = words.slice(mid)
        ctx.fillText(line1, textX(titleAlign), midY); midY += 68
        ctx.fillText(line2, textX(titleAlign), midY); midY += 68
      } else {
        ctx.fillText(words, textX(titleAlign), midY); midY += 68
      }
    }

    if (cfg?.showVersion && coverMeta?.version) {
      ctx.font = '28px "Malgun Gothic", Arial'
      ctx.fillStyle = '#6B7280'
      ctx.textAlign = textAlign(titleAlign)
      ctx.fillText(coverMeta.version, textX(titleAlign), midY)
      midY += 48
    }

    if (cfg?.showDivider) {
      const dw = 120
      const dx = xFor(titleAlign, dw)
      ctx.fillStyle = ac; ctx.fillRect(dx, midY, dw, 4); midY += 30
    }

    if (projectName) {
      ctx.font = '32px "Malgun Gothic", Arial'
      ctx.fillStyle = '#374151'
      ctx.textAlign = textAlign(titleAlign)
      ctx.fillText(projectName, textX(titleAlign), midY)
    }

    // ── 하단: 날짜·바닥글 ──────────────────────────────────────────────────
    const bottomAlign = cfg?.alignBottom ?? 'center'
    if (cfg?.showDate) {
      ctx.font = '24px "Malgun Gothic", Arial'
      ctx.fillStyle = '#9CA3AF'
      ctx.textAlign = textAlign(bottomAlign)
      ctx.fillText(today, textX(bottomAlign), H - 100)
    }
    if (settings.footerText) {
      ctx.font = '22px "Malgun Gothic", Arial'
      ctx.fillStyle = '#9CA3AF'
      ctx.textAlign = textAlign(bottomAlign)
      ctx.fillText(settings.footerText, textX(bottomAlign), H - 60)
    }

    // ── PNG → ArrayBuffer ──────────────────────────────────────────────────
    const dataUrl = canvas.toDataURL('image/png')
    const b64     = dataUrl.split(',')[1]
    const bin     = atob(b64)
    const u8      = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)

    // ── Excel 생성 ─────────────────────────────────────────────────────────
    const ExcelJS = (await import('exceljs')).default
    const origWb  = new ExcelJS.Workbook()
    await origWb.xlsx.load(buffer)

    const wb    = new ExcelJS.Workbook()
    const cover = wb.addWorksheet('표지', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
      views: [{ showGridLines: false, showRowColHeaders: false }],
    })

    // 열 10개 × 너비 9 ≈ A4 너비 / 행 55개 × 높이 20 ≈ A4 높이
    cover.columns = Array.from({ length: 10 }, () => ({ width: 9 }))
    for (let r = 1; r <= 55; r++) cover.getRow(r).height = 20

    // 표지 이미지 전체 시트 가득 삽입
    const imgId = wb.addImage({ buffer: u8.buffer, extension: 'png' })
    cover.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 10, row: 55 }, editAs: 'absolute' })

    // 원본 시트 복사
    origWb.eachSheet(os => {
      const ns = wb.addWorksheet(os.name, { state: os.state as ExcelJS.WorksheetState })
      os.eachRow((row, rn) => {
        const nr = ns.getRow(rn)
        row.eachCell({ includeEmpty: true }, (cell, cn) => { nr.getCell(cn).value = cell.value })
        nr.height = row.height; nr.commit()
      })
      os.columns.forEach((col, ci) => { if (col.width) ns.getColumn(ci + 1).width = col.width })
    })

    // 다운로드
    const xlsBuf = await wb.xlsx.writeBuffer()
    const blob   = new Blob([xlsBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href = url; a.download = meta.original_name
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const handleDownload = async () => {
    if (!meta) return
    const { data, error } = await supabase.storage.from('documents').download(meta.storage_path)
    if (error || !data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = meta.original_name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 파일 삭제
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!meta) return
    setDeleting(true)
    try {
      await supabase.storage.from('documents').remove([meta.storage_path])
      await supabase.from('files').delete().eq('id', meta.id)
      navigate(`/projects/${projectId}/documents`)
    } catch {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 text-content-subtle">
        <Loader2 size={36} className="animate-spin" />
        <p className="text-sm">파일 불러오는 중...</p>
      </div>
    )
  }

  if (error || !meta || !buffer) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4">
        <p className="text-danger text-sm">{error ?? '알 수 없는 오류'}</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          돌아가기
        </Button>
      </div>
    )
  }

  const fileType = getFileType(meta.original_name, meta.mime_type)
  const coverMeta: CoverMeta = {
    ...parseCoverMeta(meta.original_name),
    projectName,
    clientName:    clientName    || undefined,
    clientLogoUrl: clientLogoUrl || undefined,
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {withCover && <CoverPage meta={coverMeta} settings={settings} />}

      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-xs text-content-muted px-4 py-2 border-b border-line bg-canvas shrink-0 print:hidden">
        <Link to="/projects" className="hover:text-content">프로젝트</Link>
        <ChevronRight size={12} />
        <Link to={`/projects/${projectId}`} className="hover:text-content">프로젝트 상세</Link>
        <ChevronRight size={12} />
        <Link to={`/projects/${projectId}/documents`} className="hover:text-content">산출물 목록</Link>
        <ChevronRight size={12} />
        <span className="text-content font-medium truncate max-w-xs">{meta.original_name}</span>
        <div className="ml-auto flex items-center gap-2">
          {(fileType === 'docx' || fileType === 'xlsx') && (
            <button
              onClick={handlePrintWithCover}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line hover:border-primary/40 hover:bg-primary-soft text-content-muted hover:text-primary transition-colors"
            >
              <FileDown size={12} />
              <span>표지 포함 PDF</span>
            </button>
          )}
          {fileType === 'xlsx' && (
            <button
              onClick={handleAddCoverSheet}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line hover:border-green-400/60 hover:bg-green-50 text-content-muted hover:text-green-700 transition-colors"
            >
              <FileDown size={12} />
              <span>표지 시트 추가</span>
            </button>
          )}
          {/* MD 변환: xlsx / docx 지원 */}
          {(fileType === 'xlsx' || fileType === 'docx') && (
            <button
              onClick={handleConvertToMd}
              disabled={isConverting}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-40"
            >
              {isConverting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
              <span>MD 변환</span>
            </button>
          )}

          {/* AI 요약 / AI Q&A: docx / xlsx / md 지원 */}
          {(fileType === 'docx' || fileType === 'xlsx' || fileType === 'md') && (
            <>
              <button
                onClick={handleAISummary}
                disabled={isSummarizing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-purple-200 hover:border-purple-400 hover:bg-purple-50 text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-40"
              >
                {isSummarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>AI 요약</span>
              </button>
              <button
                onClick={handleOpenQA}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
                  showQA
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-line hover:border-primary/40 hover:bg-primary-soft text-content-muted hover:text-primary'
                }`}
              >
                <MessageSquare size={12} />
                <span>AI Q&A</span>
              </button>
            </>
          )}
          {/* 워크플로우 & 댓글 패널 */}
          <button
            onClick={() => setShowInfoPanel(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
              showInfoPanel
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-line hover:border-primary/40 hover:bg-primary-soft text-content-muted hover:text-primary'
            }`}
          >
            <GitBranch size={12} />
            <span>워크플로우</span>
            {commentCount > 0 && (
              <span className="bg-primary text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">{commentCount}</span>
            )}
          </button>
          {/* 삭제 버튼 */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line hover:border-danger/40 hover:bg-danger-soft text-content-muted hover:text-danger transition-colors"
          >
            <Trash2 size={12} />
            <span>삭제</span>
          </button>
        </div>
      </div>

      {/* ── 삭제 확인 모달 ── */}
      {showDeleteConfirm && meta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-2xl shadow-modal border border-line p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-danger" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-content">파일 삭제</h3>
                <p className="text-xs text-content-muted mt-0.5">삭제하면 복구할 수 없습니다</p>
              </div>
            </div>
            <p className="text-sm text-content-muted mb-5 bg-surface-hover rounded-lg px-3 py-2 truncate">
              {meta.original_name}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm border border-line rounded-xl text-content-muted hover:text-content"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-danger text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MD 변환 모달 */}
      {showMdModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-modal w-full max-w-2xl flex flex-col animate-fade-in-scale" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <FileDown size={16} className="text-emerald-500" />
                <h2 className="text-base font-semibold text-content">AI 마크다운 변환</h2>
              </div>
              <button onClick={() => setShowMdModal(false)} className="text-content-subtle hover:text-content">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
              <p className="text-xs text-content-subtle mb-3 truncate">{meta?.original_name}</p>
              {isConverting ? (
                <div className="flex items-center gap-2 text-sm text-content-muted">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  {convertProgress || '문서를 마크다운으로 변환 중입니다…'}
                </div>
              ) : (
                <pre className="text-xs text-content font-mono whitespace-pre-wrap leading-relaxed bg-canvas rounded-xl p-4 border border-line overflow-auto max-h-96">
                  {mdResult}
                </pre>
              )}
            </div>
            {!isConverting && mdResult && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-line shrink-0">
                <div>
                  {savedToProject && (
                    <span className="text-xs text-success flex items-center gap-1">
                      ✅ "AI 요약" 폴더에 저장됐습니다
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(mdResult)}>
                    복사
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadMd}>
                    <FileDown size={14} /> 다운로드
                  </Button>
                  <Button size="sm" onClick={() => handleSaveToProject(mdResult, meta?.original_name ?? 'document')} disabled={savingToProject}>
                    {savingToProject ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                    프로젝트에 저장
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 요약 모달 */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-modal w-full max-w-lg animate-fade-in-scale">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-500" />
                <h2 className="text-base font-semibold text-content">AI 문서 요약</h2>
              </div>
              <button onClick={() => setShowSummary(false)} className="text-content-subtle hover:text-content">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 min-h-[120px]">
              <p className="text-xs text-content-subtle mb-3 truncate">{meta?.original_name}</p>
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-sm text-content-muted">
                  <Loader2 size={16} className="animate-spin text-purple-500" />
                  문서를 분석하는 중입니다…
                </div>
              ) : summaryError ? (
                <p className="text-sm text-danger">{summaryError}</p>
              ) : (
                <p className="text-sm text-content leading-relaxed whitespace-pre-wrap">{summaryText}</p>
              )}
            </div>
            <div className="px-6 py-3 border-t border-line flex justify-end">
              {summaryText && !isSummarizing && (
                <Button size="sm" onClick={() => handleSaveToProject(summaryText, meta?.original_name ?? 'document')} disabled={savingToProject}>
                  {savingToProject ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                  프로젝트에 저장
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setShowSummary(false)}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">

        {/* DOCX / XLSX / PPTX: OnlyOffice */}
        {(fileType === 'docx' || fileType === 'xlsx' || fileType === 'pptx') && signedUrl && (
          <OnlyOfficeEditor
            fileId={meta.id}
            fileName={meta.original_name}
            signedUrl={signedUrl}
            storagePath={meta.storage_path}
            onClose={handleOOClose}
          />
        )}
        {(fileType === 'docx' || fileType === 'xlsx' || fileType === 'pptx') && !signedUrl && (
          <div className="flex flex-col flex-1 items-center justify-center gap-3 text-content-muted">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">에디터 준비 중...</p>
          </div>
        )}

        {/* PDF */}
        {fileType === 'pdf' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface shrink-0">
              <span className="text-sm font-medium text-content truncate">{meta.original_name}</span>
              <Button variant="secondary" size="sm" onClick={handleDownload}>
                <Download size={14} />
                다운로드
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }))}
                className="w-full h-full border-0"
                title={meta.original_name}
              />
            </div>
          </div>
        )}

        {/* 마크다운 / 텍스트 뷰어 */}
        {fileType === 'md' && (
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <MarkdownViewer buffer={buffer} fileName={meta.original_name} onDownload={handleDownload} />
          </div>
        )}

        {/* 기타 */}
        {fileType === 'other' && (
          <div className="flex flex-col h-full items-center justify-center gap-4 text-content-muted">
            <p className="text-sm">이 파일 형식은 브라우저에서 미리볼 수 없습니다.</p>
            <Button onClick={handleDownload}>
              <Download size={14} />
              파일 다운로드
            </Button>
          </div>
        )}

        {/* ── 워크플로우 & 댓글 패널 ── */}
        {showInfoPanel && meta && projectId && (
          <div className="w-80 shrink-0 border-l border-line bg-surface flex flex-col overflow-y-auto animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <GitBranch size={14} className="text-primary" />
                <span className="text-sm font-semibold text-content">워크플로우 & 댓글</span>
              </div>
              <button onClick={() => setShowInfoPanel(false)} className="text-content-subtle hover:text-content">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* 워크플로우 */}
              <WorkflowPanel
                fileId={meta.id}
                projectId={projectId}
                userRole={userRole}
                onTransitioned={async () => {
                  // 파일명 변경 반영: DB에서 최신 original_name 다시 로드
                  const { data } = await supabase
                    .from('files')
                    .select('original_name, storage_path')
                    .eq('id', meta.id)
                    .single()
                  if (data) setMeta(prev => prev ? { ...prev, original_name: data.original_name, storage_path: data.storage_path } : prev)
                }}
              />
              {/* 댓글 */}
              <CommentPanel
                fileId={meta.id}
                projectId={projectId}
              />
            </div>
          </div>
        )}

        {/* ── AI Q&A 패널 ── */}
        {showQA && (
          <div className="w-72 shrink-0 border-l border-line bg-surface flex flex-col animate-slide-in-right">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-primary" />
                <span className="text-sm font-semibold text-content">AI Q&A</span>
              </div>
              <button onClick={() => setShowQA(false)} className="text-content-subtle hover:text-content">
                <X size={16} />
              </button>
            </div>

            {/* 안내 메시지 */}
            {qaMessages.length === 0 && (
              <div className="p-4 text-xs text-content-subtle text-center border-b border-line">
                문서 내용에 대해 자유롭게 질문하세요
              </div>
            )}

            {/* 대화 내역 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {qaMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-surface-hover text-content rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {qaLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-xl rounded-bl-sm bg-surface-hover text-content-subtle text-xs flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" />
                    답변 생성 중…
                  </div>
                </div>
              )}
              <div ref={qaEndRef} />
            </div>

            {/* 입력창 */}
            <div className="p-3 border-t border-line shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={qaInput}
                  onChange={e => setQAInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQASend() }
                  }}
                  placeholder="질문을 입력하세요 (Enter 전송)"
                  rows={2}
                  className="flex-1 text-xs border border-line rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas"
                />
                <button
                  onClick={handleQASend}
                  disabled={!qaInput.trim() || qaLoading}
                  className="p-2 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
