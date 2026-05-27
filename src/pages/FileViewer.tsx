import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Loader2, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SpreadsheetEditor from '../components/editor/SpreadsheetEditor'
import DocEditor from '../components/editor/DocEditor'

interface FileMeta {
  id: string
  original_name: string
  storage_path: string
  mime_type: string
  size: number
  project_id: string
}

function getFileType(name: string, mimeType: string): 'xlsx' | 'docx' | 'pdf' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet')) return 'xlsx'
  if (ext === 'docx' || ext === 'doc' || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'docx'
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf'
  return 'other'
}

export default function FileViewer() {
  const { id: projectId, fileId } = useParams<{ id: string; fileId: string }>()
  const navigate = useNavigate()

  const [meta, setMeta] = useState<FileMeta | null>(null)
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fileId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      // 1. DB에서 파일 메타 조회
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

      // 2. Storage에서 파일 다운로드
      const { data: blob, error: dlErr } = await supabase.storage
        .from('documents')
        .download(row.storage_path)

      if (dlErr || !blob) {
        if (!cancelled) { setError('파일을 다운로드할 수 없습니다.'); setLoading(false) }
        return
      }

      const buf = await blob.arrayBuffer()
      if (!cancelled) {
        setBuffer(buf)
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [fileId])

  // 원본 파일 다운로드
  const handleDownload = async () => {
    if (!meta) return
    const { data, error } = await supabase.storage
      .from('documents')
      .download(meta.storage_path)
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

  // xlsx 저장: 편집된 buffer를 Storage에 업로드
  const handleSaveXlsx = async (buf: ArrayBuffer) => {
    if (!meta) return
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(meta.storage_path, blob, { upsert: true })
    if (upErr) throw upErr
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-3 text-content-subtle">
        <Loader2 size={36} className="animate-spin" />
        <p className="text-sm">파일 불러오는 중...</p>
      </div>
    )
  }

  if (error || !meta || !buffer) {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-4">
        <p className="text-red-500 text-sm">{error ?? '알 수 없는 오류'}</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-line rounded-lg hover:bg-surface-hover"
        >
          <ArrowLeft size={14} />
          돌아가기
        </button>
      </div>
    )
  }

  const fileType = getFileType(meta.original_name, meta.mime_type)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 상단 브레드크럼 바 */}
      <div className="flex items-center gap-2 text-xs text-content-muted px-4 py-2 border-b border-line bg-canvas shrink-0">
        <Link to="/projects" className="hover:text-content">프로젝트</Link>
        <ChevronRight size={12} />
        <Link to={`/projects/${projectId}`} className="hover:text-content">프로젝트 상세</Link>
        <ChevronRight size={12} />
        <Link to={`/projects/${projectId}/documents`} className="hover:text-content">산출물 목록</Link>
        <ChevronRight size={12} />
        <span className="text-content font-medium truncate max-w-xs">{meta.original_name}</span>
      </div>

      {/* 에디터 / 뷰어 영역 */}
      <div className="flex-1 min-h-0">
        {fileType === 'xlsx' && (
          <SpreadsheetEditor
            fileName={meta.original_name}
            buffer={buffer}
            onSave={handleSaveXlsx}
            onDownload={handleDownload}
          />
        )}
        {fileType === 'docx' && (
          <DocEditor
            fileName={meta.original_name}
            storagePath={meta.storage_path}
            buffer={buffer}
            onDownload={handleDownload}
            onSave={async (buf) => {
              const blob = new Blob([buf], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              })
              const { error } = await supabase.storage
                .from('documents')
                .upload(meta.storage_path, blob, { upsert: true })
              if (error) throw error
            }}
          />
        )}
        {fileType === 'pdf' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface shrink-0">
              <span className="text-sm font-medium text-content truncate">{meta.original_name}</span>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-muted border border-line rounded-lg hover:bg-surface-hover"
              >
                <Download size={14} />
                다운로드
              </button>
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
        {fileType === 'other' && (
          <div className="flex flex-col h-full items-center justify-center gap-4 text-content-muted">
            <p className="text-sm">이 파일 형식은 브라우저에서 미리볼 수 없습니다.</p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover"
            >
              <Download size={14} />
              파일 다운로드
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
