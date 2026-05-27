import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Save, Sparkles, ChevronRight, Clock, History, Bold, Italic, List, ListOrdered, Heading2, Quote, Minus, Printer } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useDocument } from '../hooks/useDocument'
import { useAI } from '../hooks/useAI'
import { printDocument } from '../lib/pdf'
import { Button, SectionTitle } from '../components/ui'

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gm, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gm, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^[0-9]+\. (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hHlL])/gm, '')
    .trim()
}

const DOC_TYPES = ['요구사항 정의서', '시스템 설계서', 'UI/UX 설계서', '테스트 계획서', 'WBS', '인터페이스 정의서', '운영 매뉴얼']

export default function DocumentEditor() {
  const { docId } = useParams<{ docId: string }>()
  const { document, latestVersion, versions, loading, autoSave, saveNewVersion } = useDocument(docId!)
  const { isGenerating, generatedText, generate, reset } = useAI()

  const [showVersions, setShowVersions] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [documentType, setDocumentType] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [autoSaved, setAutoSaved] = useState<Date | null>(null)

  const initialized = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerAutoSave = useCallback((getJson: () => object) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      await autoSave(getJson())
      setAutoSaved(new Date())
    }, 3000)
  }, [autoSave])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    ],
    content: '',
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor }) => {
      if (!initialized.current) return
      triggerAutoSave(() => editor.getJSON())
    },
  })

  useEffect(() => {
    if (!editor || loading || initialized.current) return
    if (latestVersion?.contentJson) {
      editor.commands.setContent(latestVersion.contentJson as Parameters<typeof editor.commands.setContent>[0])
    }
    initialized.current = true
  }, [editor, latestVersion, loading])

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  async function handleSave() {
    if (!editor) return
    setIsSaving(true)
    try {
      await saveNewVersion(editor.getJSON(), '')
      setAutoSaved(new Date())
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAIGenerate() {
    if (!documentType.trim()) return
    const ctx = [
      document?.title ? `문서명: ${document.title}` : '',
    ].filter(Boolean).join('\n')
    await generate(documentType, ctx)
  }

  function insertAIContent() {
    if (!editor || !generatedText) return
    const html = `<p>${markdownToHtml(generatedText)}</p>`
    editor.commands.setContent(html)
    setShowAIModal(false)
    reset()
    setDocumentType('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-content-subtle">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-line bg-surface flex items-center justify-between px-6 shrink-0 gap-4">
        <div className="flex items-center gap-2 text-sm text-content-muted min-w-0">
          <Link to="/projects" className="hover:text-content shrink-0">프로젝트</Link>
          <ChevronRight size={14} className="shrink-0" />
          {document?.projectId && (
            <>
              <Link to={`/projects/${document.projectId}/documents`} className="hover:text-content shrink-0">
                산출물 목록
              </Link>
              <ChevronRight size={14} className="shrink-0" />
            </>
          )}
          <span className="text-content font-medium truncate">{document?.title || '문서'}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {autoSaved && (
            <span className="text-xs text-content-subtle flex items-center gap-1">
              <Clock size={11} />
              {autoSaved.toLocaleTimeString()} 자동저장
            </span>
          )}
          <span className="text-xs font-mono text-content-subtle bg-surface-hover px-2 py-0.5 rounded">
            {document?.currentVersion || 'v1.0'}
          </span>
          <button
            onClick={() => setShowVersions(!showVersions)}
            className={`p-1.5 rounded-lg transition-colors ${showVersions ? 'bg-surface-hover text-content' : 'text-content-subtle hover:text-content-muted hover:bg-surface-hover'}`}
            title="버전 이력"
          >
            <History size={16} />
          </button>
          <button
            onClick={printDocument}
            className="p-1.5 text-content-subtle hover:text-content-muted hover:bg-surface-hover rounded-lg transition-colors"
            title="인쇄/PDF"
          >
            <Printer size={16} />
          </button>
          <button
            onClick={() => { reset(); setDocumentType(''); setShowAIModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 dark:text-purple-400 dark:border-purple-500/30 dark:hover:bg-purple-500/10 transition-colors"
          >
            <Sparkles size={14} />
            AI 초안
          </button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save size={14} />
            {isSaving ? '저장 중...' : '버전 저장'}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-line bg-surface px-6 py-1.5 flex items-center gap-1 shrink-0">
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="굵게">
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="기울임">
          <Italic size={14} />
        </ToolbarBtn>
        <div className="w-px h-4 bg-surface-hover mx-1" />
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="제목 2">
          <Heading2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="글머리 기호">
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="번호 목록">
          <ListOrdered size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="인용구">
          <Quote size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="구분선">
          <Minus size={14} />
        </ToolbarBtn>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-auto bg-canvas">
          <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-2xl font-bold text-content mb-6 print:text-3xl">
              {document?.title}
            </h1>
            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-card">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Version Sidebar */}
        {showVersions && (
          <div className="w-64 border-l border-line bg-surface shrink-0 flex flex-col">
            <div className="px-4 py-3 border-b border-line">
              <SectionTitle>버전 이력</SectionTitle>
            </div>
            <div className="overflow-auto flex-1 p-3">
              {versions.length === 0 ? (
                <p className="text-xs text-content-subtle text-center mt-4">저장된 버전이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v, i) => (
                    <div
                      key={v.id}
                      className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        i === 0 ? 'border-primary/40 bg-primary-soft' : 'border-line hover:border-content-subtle'
                      }`}
                      onClick={() => {
                        if (editor && v.contentJson) {
                          editor.commands.setContent(v.contentJson as Parameters<typeof editor.commands.setContent>[0])
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold font-mono text-content">{v.version}</span>
                        {i === 0 && (
                          <span className="text-xs text-primary">최신</span>
                        )}
                      </div>
                      {v.changeNote && (
                        <p className="text-xs text-content-muted mt-0.5 truncate">{v.changeNote}</p>
                      )}
                      <p className="text-xs text-content-subtle mt-0.5">
                        {new Date(v.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
              <h2 className="text-lg font-semibold text-content flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600" />
                AI 초안 생성
              </h2>
              <button
                onClick={() => { setShowAIModal(false); reset() }}
                className="text-content-subtle hover:text-content-muted text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex-1 overflow-auto">
              {!generatedText ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-content mb-1">산출물 유형</label>
                    <input
                      type="text"
                      value={documentType}
                      onChange={e => setDocumentType(e.target.value)}
                      placeholder="예: 요구사항 정의서, 시스템 설계서..."
                      className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DOC_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setDocumentType(type)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          documentType === type
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-500/15 dark:text-purple-300 dark:hover:bg-purple-500/25'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-canvas rounded-lg p-4">
                  <div className="font-mono text-sm text-content whitespace-pre-wrap leading-relaxed">
                    {generatedText}
                    {isGenerating && <span className="animate-pulse text-purple-500">▋</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line flex justify-end gap-2 shrink-0">
              <Button variant="secondary" onClick={() => { setShowAIModal(false); reset() }}>
                닫기
              </Button>
              {!generatedText ? (
                <button
                  onClick={handleAIGenerate}
                  disabled={isGenerating || !documentType.trim()}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  <Sparkles size={14} />
                  {isGenerating ? '생성 중...' : '생성하기'}
                </button>
              ) : (
                <Button onClick={insertAIContent} disabled={isGenerating}>
                  에디터에 삽입
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-surface-hover text-content' : 'text-content-muted hover:bg-surface-hover hover:text-content'
      }`}
    >
      {children}
    </button>
  )
}
