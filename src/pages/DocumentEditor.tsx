import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  Save, Sparkles, ChevronRight, Clock, History,
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Quote, Minus, Printer, X, Wand2, Loader2,
  AlignLeft, AlignCenter, AlignRight,
  Table as TableIcon, Link as LinkIcon, Link2Off,
  Undo2, Redo2, Code, FileUp, FileDown,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link2 from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Placeholder } from '@tiptap/extension-placeholder'
import { CharacterCount } from '@tiptap/extension-character-count'
import mammoth from 'mammoth'
import { useDocument } from '../hooks/useDocument'
import { useAI } from '../hooks/useAI'
import { printDocument } from '../lib/pdf'
import { summarizeChanges } from '../lib/groq'
import { Button, SectionTitle } from '../components/ui'

// ── Markdown → HTML 간이 변환 ─────────────────────────────────────────────────
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
    .trim()
}

// TipTap JSON → 평문 변환
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonToText(json: object): string {
  const extract = (node: any): string => {
    if (node.text) return node.text
    if (node.content) return (node.content as any[]).map(extract).join('\n')
    return ''
  }
  return extract(json)
}

// 버전 번호 다음 값 계산
function nextVersion(current: string): string {
  const parts = current.replace('v', '').split('.')
  return `v${parseInt(parts[0])}.${parseInt(parts[1]) + 1}`
}

const DOC_TYPES = ['요구사항 정의서', '시스템 설계서', 'UI/UX 설계서', '테스트 계획서', 'WBS', '인터페이스 정의서', '운영 매뉴얼']

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function DocumentEditor() {
  const { docId } = useParams<{ docId: string }>()
  const location  = useLocation()
  const { document, latestVersion, versions, loading, autoSave, saveNewVersion } = useDocument(docId!)
  const { isGenerating, generatedText, generate, reset } = useAI()

  // 패널 / 모달 표시 여부
  const [showVersions, setShowVersions]       = useState(false)
  const [showAIModal, setShowAIModal]         = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [showVersionDialog, setShowVersionDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog]   = useState(false)

  // 각 기능 상태
  const [summaryText, setSummaryText]     = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [documentType, setDocumentType]   = useState('')
  const [isSaving, setIsSaving]           = useState(false)
  const [versionNote, setVersionNote]     = useState('')
  const [linkUrl, setLinkUrl]             = useState('')
  const [autoSaved, setAutoSaved]         = useState<Date | null>(null)
  const [autoSaveErr, setAutoSaveErr]     = useState(false)

  const initialized     = useRef(false)
  const autoSaveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const versionNoteRef  = useRef<HTMLTextAreaElement>(null)
  const linkInputRef    = useRef<HTMLInputElement>(null)
  const docxInputRef    = useRef<HTMLInputElement>(null)

  // ── 자동저장 (3s debounce) ─────────────────────────────────────────────────
  const triggerAutoSave = useCallback((getJson: () => object) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await autoSave(getJson())
        setAutoSaved(new Date())
        setAutoSaveErr(false)
      } catch {
        setAutoSaveErr(true)
      }
    }, 2000)
  }, [autoSave])

  // ── 에디터 초기화 ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link2.configure({ openOnClick: false, autolink: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: '문서를 작성하세요. "/" 를 입력하면 블록을 삽입할 수 있습니다.' }),
      CharacterCount,
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

  // docId 변경 시 초기화 플래그 리셋
  useEffect(() => {
    initialized.current = false
  }, [docId])

  // 버전 데이터 로드 후 에디터에 내용 세팅
  useEffect(() => {
    if (!editor || loading || initialized.current) return
    initialized.current = true
    try {
      // AI 회의록 등 navigate state로 초기 내용이 전달된 경우 우선 적용
      const stateContent = (location.state as { initialContent?: string } | null)?.initialContent
      if (stateContent) {
        const html = markdownToHtml(stateContent)
        editor.commands.setContent(html)
        triggerAutoSave(() => editor.getJSON())
        return
      }

      const raw = latestVersion?.contentJson as Record<string, unknown> | null
      if (!raw) {
        editor.commands.setContent('<p></p>')
      } else if (typeof (raw as { html?: unknown }).html === 'string') {
        editor.commands.setContent((raw as { html: string }).html)
      } else {
        editor.commands.setContent(raw as Parameters<typeof editor.commands.setContent>[0])
      }
    } catch (err) {
      console.error('[DocumentEditor] setContent 실패:', err)
      setAutoSaveErr(true)
    }
  }, [editor, latestVersion, loading])

  // 언마운트 시 타이머 정리
  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }, [])

  // 버전 다이얼로그 열릴 때 textarea 포커스
  useEffect(() => {
    if (showVersionDialog) {
      setVersionNote('')
      setTimeout(() => versionNoteRef.current?.focus(), 50)
    }
  }, [showVersionDialog])

  // 링크 다이얼로그 열릴 때 input 포커스
  useEffect(() => {
    if (showLinkDialog) {
      const existing = editor?.getAttributes('link').href ?? ''
      setLinkUrl(existing)
      setTimeout(() => linkInputRef.current?.focus(), 50)
    }
  }, [showLinkDialog, editor])

  // ── 버전 저장 (메모 입력 후) ───────────────────────────────────────────────
  async function handleVersionSave() {
    if (!editor) return
    setIsSaving(true)
    try {
      await saveNewVersion(editor.getJSON(), versionNote.trim() || '버전 저장')
      setAutoSaved(new Date())
      setShowVersionDialog(false)
    } finally {
      setIsSaving(false)
    }
  }

  // ── DOCX 가져오기 ────────────────────────────────────────────────────────────
  async function handleDocxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    e.target.value = ''
    try {
      const arrayBuffer = await file.arrayBuffer()
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
      editor.commands.setContent(html)
      triggerAutoSave(() => editor.getJSON())
    } catch (err) {
      alert(`DOCX 가져오기 실패: ${(err as Error).message}`)
    }
  }

  // ── 링크 삽입/제거 ─────────────────────────────────────────────────────────
  function handleSetLink() {
    if (!editor) return
    const url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      const href = url.startsWith('http') ? url : `https://${url}`
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setShowLinkDialog(false)
    setLinkUrl('')
  }

  // ── 테이블 삽입 ───────────────────────────────────────────────────────────
  function handleInsertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  // ── AI 변경 요약 ──────────────────────────────────────────────────────────
  async function handleSummarize() {
    if (versions.length < 2 || !latestVersion?.contentJson) return
    setIsSummarizing(true)
    setSummaryText('')
    setShowSummaryModal(true)
    try {
      const prevVersion = versions[versions.length - 2]
      const prevText = prevVersion?.contentJson ? jsonToText(prevVersion.contentJson as object) : ''
      const newText  = jsonToText(latestVersion.contentJson as object)
      setSummaryText(await summarizeChanges(prevText, newText))
    } catch (err) {
      setSummaryText(`오류: ${(err as Error).message}`)
    } finally {
      setIsSummarizing(false)
    }
  }

  // ── AI 초안 생성 ──────────────────────────────────────────────────────────
  async function handleAIGenerate() {
    if (!documentType.trim()) return
    const ctx = [document?.title ? `문서명: ${document.title}` : ''].filter(Boolean).join('\n')
    await generate(documentType, ctx)
  }

  function insertAIContent() {
    if (!editor || !generatedText) return
    editor.commands.setContent(`<p>${markdownToHtml(generatedText)}</p>`)
    setShowAIModal(false)
    reset()
    setDocumentType('')
  }

  // ── 로딩 ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 size={20} className="animate-spin text-content-subtle" />
      </div>
    )
  }

  // DOCX 가져오기 숨김 input (JSX 외부 변수로 선언)
  const docxInput = (
    <input
      ref={docxInputRef}
      type="file"
      accept=".docx,.doc"
      className="hidden"
      onChange={handleDocxImport}
    />
  )

  const charCount  = editor?.storage?.characterCount?.characters?.() ?? 0
  const wordCount  = editor?.storage?.characterCount?.words?.() ?? 0
  const currentVer = document?.currentVersion || 'v1.0'
  const nextVer    = nextVersion(versions[0]?.version || currentVer)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {docxInput}

      {/* ── 헤더 ── */}
      <div className="h-14 border-b border-line bg-surface flex items-center justify-between px-6 shrink-0 gap-4">
        <div className="flex items-center gap-2 text-sm text-content-muted min-w-0">
          <Link to="/projects" className="hover:text-content shrink-0">프로젝트</Link>
          <ChevronRight size={14} className="shrink-0" />
          {document?.projectId && (
            <>
              <Link to={`/projects/${document.projectId}/documents`} className="hover:text-content shrink-0">산출물 목록</Link>
              <ChevronRight size={14} className="shrink-0" />
            </>
          )}
          <span className="text-content font-medium truncate">{document?.title || '문서'}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 자동저장 표시 */}
          {autoSaved && !autoSaveErr && (
            <span className="text-xs text-content-subtle flex items-center gap-1">
              <Clock size={11} />
              {autoSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 자동저장
            </span>
          )}
          {autoSaveErr && (
            <span className="text-xs text-danger">자동저장 실패</span>
          )}

          {/* 현재 버전 배지 */}
          <span className="text-xs font-mono text-content-subtle bg-surface-hover px-2 py-0.5 rounded">
            {currentVer}
          </span>

          {/* 버전 이력 */}
          <button
            onClick={() => setShowVersions(!showVersions)}
            className={`p-1.5 rounded-lg transition-colors ${showVersions ? 'bg-surface-hover text-content' : 'text-content-subtle hover:text-content hover:bg-surface-hover'}`}
            title="버전 이력"
          >
            <History size={16} />
          </button>

          {/* DOCX 가져오기 */}
          <button
            onClick={() => docxInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-muted border border-line rounded-lg hover:bg-surface-hover transition-colors"
            title="DOCX 파일을 에디터로 가져옵니다"
          >
            <FileUp size={14} />
            DOCX 가져오기
          </button>

          {/* 인쇄/PDF */}
          <button
            onClick={printDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-muted border border-line rounded-lg hover:bg-surface-hover transition-colors"
            title="인쇄 / PDF 내보내기"
          >
            <FileDown size={14} />
            PDF
          </button>

          {/* AI 변경 요약 (버전 2개 이상일 때) */}
          {versions.length >= 2 && (
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-40"
              title="이전 버전과 현재 버전을 AI로 비교 요약"
            >
              {isSummarizing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              변경 요약
            </button>
          )}

          {/* AI 초안 */}
          <button
            onClick={() => { reset(); setDocumentType(''); setShowAIModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 dark:text-purple-400 dark:border-purple-500/30 dark:hover:bg-purple-500/10 transition-colors"
          >
            <Sparkles size={14} />
            AI 초안
          </button>

          {/* 버전 저장 */}
          <Button size="sm" onClick={() => setShowVersionDialog(true)}>
            <Save size={14} />
            버전 저장
          </Button>
        </div>
      </div>

      {/* ── 툴바 ── */}
      <div className="border-b border-line bg-surface px-4 py-1.5 flex flex-wrap items-center gap-0.5 shrink-0">
        {/* Undo / Redo */}
        <ToolbarBtn onClick={() => editor?.chain().focus().undo().run()} title="실행 취소 (Ctrl+Z)">
          <Undo2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().redo().run()} title="다시 실행 (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </ToolbarBtn>

        <Divider />

        {/* Heading */}
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="제목 1">
          <Heading1 size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="제목 2">
          <Heading2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="제목 3">
          <Heading3 size={14} />
        </ToolbarBtn>

        <Divider />

        {/* 글자 스타일 */}
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="굵게 (Ctrl+B)">
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="기울임 (Ctrl+I)">
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="밑줄 (Ctrl+U)">
          <UnderlineIcon size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="인라인 코드">
          <Code size={14} />
        </ToolbarBtn>

        <Divider />

        {/* 정렬 */}
        <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} title="왼쪽 정렬">
          <AlignLeft size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} title="가운데 정렬">
          <AlignCenter size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} title="오른쪽 정렬">
          <AlignRight size={14} />
        </ToolbarBtn>

        <Divider />

        {/* 목록 */}
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

        <Divider />

        {/* 링크 */}
        <ToolbarBtn onClick={() => setShowLinkDialog(true)} active={editor?.isActive('link')} title="링크 삽입">
          <LinkIcon size={14} />
        </ToolbarBtn>
        {editor?.isActive('link') && (
          <ToolbarBtn onClick={() => editor.chain().focus().unsetLink().run()} title="링크 제거">
            <Link2Off size={14} />
          </ToolbarBtn>
        )}

        {/* 표 */}
        <ToolbarBtn onClick={handleInsertTable} title="표 삽입 (3×3)">
          <TableIcon size={14} />
        </ToolbarBtn>

        {/* 표 편집 메뉴 (표 선택 시) */}
        {editor?.isActive('table') && (
          <>
            <Divider />
            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="px-2 py-1 text-[11px] rounded text-content-muted hover:bg-surface-hover transition-colors"
              title="열 추가"
            >열+</button>
            <button
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="px-2 py-1 text-[11px] rounded text-content-muted hover:bg-surface-hover transition-colors"
              title="열 삭제"
            >열−</button>
            <button
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="px-2 py-1 text-[11px] rounded text-content-muted hover:bg-surface-hover transition-colors"
              title="행 추가"
            >행+</button>
            <button
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="px-2 py-1 text-[11px] rounded text-content-muted hover:bg-surface-hover transition-colors"
              title="행 삭제"
            >행−</button>
            <button
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-2 py-1 text-[11px] rounded text-danger hover:bg-danger-soft transition-colors"
              title="표 삭제"
            >표 삭제</button>
          </>
        )}
      </div>

      {/* ── 본문 (에디터 + 버전 사이드바) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* 에디터 영역 */}
        <div className="flex-1 overflow-auto bg-canvas flex flex-col">
          <div className="flex-1 max-w-4xl mx-auto w-full p-8">
            <h1 className="text-2xl font-bold text-content mb-6 print:text-3xl">
              {document?.title}
            </h1>
            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-card min-h-[600px]">
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* 상태바 */}
          <div className="shrink-0 flex items-center justify-between px-8 py-2 border-t border-line bg-surface text-[11px] text-content-subtle">
            <span>{charCount.toLocaleString()}자 · {wordCount.toLocaleString()}단어</span>
            {autoSaved && !autoSaveErr && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {autoSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 자동저장 완료
              </span>
            )}
            {autoSaveErr && <span className="text-danger">자동저장 실패 — 네트워크를 확인하세요</span>}
          </div>
        </div>

        {/* 버전 이력 사이드바 */}
        {showVersions && (
          <div className="w-64 border-l border-line bg-surface shrink-0 flex flex-col">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <SectionTitle>버전 이력</SectionTitle>
              <button onClick={() => setShowVersions(false)} className="text-content-subtle hover:text-content-muted">
                <X size={14} />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-3">
              {versions.length === 0 ? (
                <p className="text-xs text-content-subtle text-center mt-6">저장된 버전이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v, i) => (
                    <div
                      key={v.id}
                      className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        i === 0 ? 'border-primary/40 bg-primary-soft' : 'border-line hover:border-content-subtle hover:bg-surface-hover'
                      }`}
                      onClick={() => {
                        if (editor && v.contentJson) {
                          editor.commands.setContent(v.contentJson as Parameters<typeof editor.commands.setContent>[0])
                        }
                      }}
                      title="클릭하면 이 버전을 에디터에 불러옵니다"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold font-mono text-content">{v.version}</span>
                        {i === 0 && <span className="text-[10px] text-primary font-medium">최신</span>}
                      </div>
                      {v.changeNote && (
                        <p className="text-xs text-content-muted mt-0.5 break-all line-clamp-2">{v.changeNote}</p>
                      )}
                      <p className="text-xs text-content-subtle mt-0.5">
                        {new Date(v.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────── 모달들 ────────────────────── */}

      {/* 버전 저장 다이얼로그 */}
      {showVersionDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-content flex items-center gap-2">
                <Save size={16} className="text-primary" />
                새 버전 저장
              </h2>
              <button onClick={() => setShowVersionDialog(false)} className="text-content-subtle hover:text-content-muted">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono text-content-muted bg-surface-hover px-2 py-0.5 rounded">{currentVer}</span>
                <span className="text-content-subtle">→</span>
                <span className="font-mono text-primary bg-primary-soft px-2 py-0.5 rounded">{nextVer}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-content mb-1.5">
                  변경 메모 <span className="text-content-subtle font-normal">(선택)</span>
                </label>
                <textarea
                  ref={versionNoteRef}
                  value={versionNote}
                  onChange={e => setVersionNote(e.target.value)}
                  placeholder="이 버전의 주요 변경 사항을 간단히 기록하세요."
                  rows={3}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas text-content placeholder:text-content-subtle"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleVersionSave() }}
                />
                <p className="text-xs text-content-subtle mt-1">Ctrl+Enter로 바로 저장</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowVersionDialog(false)}>취소</Button>
              <Button onClick={handleVersionSave} disabled={isSaving}>
                {isSaving ? <><Loader2 size={14} className="animate-spin" /> 저장 중…</> : <><Save size={14} /> {nextVer} 저장</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 링크 삽입 다이얼로그 */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
              <h2 className="text-sm font-semibold text-content flex items-center gap-2">
                <LinkIcon size={14} className="text-primary" />
                링크 삽입
              </h2>
              <button onClick={() => setShowLinkDialog(false)} className="text-content-subtle hover:text-content-muted">
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <input
                ref={linkInputRef}
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas text-content"
                onKeyDown={e => e.key === 'Enter' && handleSetLink()}
              />
            </div>
            <div className="px-5 py-3 border-t border-line flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowLinkDialog(false)}>취소</Button>
              <Button onClick={handleSetLink}>
                {linkUrl.trim() ? '링크 적용' : '링크 제거'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI 변경 요약 모달 */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-lg flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
              <h2 className="text-base font-semibold text-content flex items-center gap-2">
                <Wand2 size={16} className="text-teal-600" />
                버전 변경 요약
              </h2>
              <button onClick={() => setShowSummaryModal(false)} className="text-content-subtle hover:text-content-muted">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-auto">
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-content-muted text-sm">
                  <Loader2 size={15} className="animate-spin" /> AI가 변경 사항을 분석 중입니다…
                </div>
              ) : (
                <div className="text-sm text-content leading-relaxed whitespace-pre-wrap bg-teal-50 border border-teal-200 rounded-lg p-4 dark:bg-teal-900/20 dark:border-teal-700/30">
                  {summaryText || '요약 내용이 없습니다.'}
                </div>
              )}
              <p className="text-xs text-content-subtle mt-3">
                {versions[versions.length - 2]?.version} → {latestVersion?.version} 비교
              </p>
            </div>
            <div className="px-6 py-3 border-t border-line flex justify-end">
              <Button variant="secondary" onClick={() => setShowSummaryModal(false)}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {/* AI 초안 모달 */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
              <h2 className="text-lg font-semibold text-content flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
                AI 초안 생성
              </h2>
              <button onClick={() => { setShowAIModal(false); reset() }} className="text-content-subtle hover:text-content-muted">
                <X size={18} />
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
                      className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 bg-canvas"
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
                <div className="bg-canvas rounded-lg p-4 border border-line">
                  <div className="font-mono text-sm text-content whitespace-pre-wrap leading-relaxed">
                    {generatedText}
                    {isGenerating && <span className="animate-pulse text-purple-500">▋</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line flex justify-end gap-2 shrink-0">
              <Button variant="secondary" onClick={() => { setShowAIModal(false); reset() }}>닫기</Button>
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
                <Button onClick={insertAIContent} disabled={isGenerating}>에디터에 삽입</Button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── 툴바 버튼 컴포넌트 ────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean | null
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={title}
      aria-pressed={active ?? false}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-surface-hover text-content' : 'text-content-muted hover:bg-surface-hover hover:text-content'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-line mx-1 shrink-0" />
}
