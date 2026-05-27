import { useRef, useState, useCallback } from 'react'
import { DocxEditor } from '@eigenpal/docx-editor-react'
import type { DocxEditorRef } from '@eigenpal/docx-editor-react'
import { Download, Save, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  fileName: string
  storagePath: string
  buffer: ArrayBuffer
  onDownload: () => void
  onSave?: (buffer: ArrayBuffer) => Promise<void>
}

export default function DocEditor({ fileName, buffer, onDownload, onSave }: Props) {
  const editorRef = useRef<DocxEditorRef>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async (buf: ArrayBuffer) => {
    if (!onSave) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await onSave(buf)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }, [onSave])

  return (
    <div className="flex flex-col h-full">
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0 gap-3">
        <span className="text-sm font-medium text-gray-600 truncate max-w-xs hidden md:block">
          {fileName}
        </span>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {error && <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>}

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            원본 다운로드
          </button>

          {onSave && (
            <button
              onClick={() => editorRef.current?.save()}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving
                ? <Loader2 size={14} className="animate-spin" />
                : saved
                  ? <CheckCircle2 size={14} />
                  : <Save size={14} />}
              {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
            </button>
          )}
        </div>
      </div>

      {/* DOCX 에디터 */}
      <div className="flex-1 min-h-0">
        <DocxEditor
          ref={editorRef}
          documentBuffer={buffer}
          onSave={onSave ? handleSave : undefined}
          author="n2Hub 사용자"
          showToolbar
          showZoomControl
        />
      </div>
    </div>
  )
}
