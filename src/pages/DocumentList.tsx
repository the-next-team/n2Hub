import { useRef, useState, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronDown,
  Upload, Download, Trash2,
  FileText, FileSpreadsheet, Presentation, File,
  Folder, FolderOpen, FolderPlus,
  Loader2, ExternalLink,
  PlusCircle, BookOpen, X, Check, AlertTriangle, ClipboardList,
} from 'lucide-react'
import { useFileTree, getItemPath } from '../hooks/useFileTree'
import { useFileSessions } from '../hooks/useFileSession'
import { generateMeetingMinutes, extractActionItems } from '../lib/groq'
import { createActionItemsFromMeeting } from '../hooks/useActionItems'
import type { FlatNode } from '../hooks/useFileTree'
import type { StorageItem } from '../hooks/useFiles'
import { useTasks } from '../hooks/useTasks'
import type { Task } from '../hooks/useTasks'
import { useDocuments } from '../hooks/useDocument'
import type { DocumentCategory, DocumentStatus } from '../types'
import { Button, PageHeader } from '../components/ui'

const CATEGORY_OPTIONS: DocumentCategory[] = ['요구사항', '설계', '개발', '테스트', '배포', '기타']
const STATUS_BADGE: Record<DocumentStatus, { label: string; cls: string }> = {
  '작성중': { label: '작성중', cls: 'bg-warning-soft text-warning' },
  '검토중': { label: '검토중', cls: 'bg-primary-soft text-primary' },
  '승인':   { label: '승인',   cls: 'bg-success-soft text-success' },
  '완료':   { label: '완료',   cls: 'bg-surface-hover text-content-muted' },
}
const ACCEPT_TYPES = '*'  // 모든 파일 형식 허용

function formatFileSize(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
const ICON_DOCX = new Set(['docx','doc','docm','odt','fodt','ott','rtf','txt','html','htm','epub'])
const ICON_XLSX = new Set(['xlsx','xls','xlsm','ods','fods','csv'])
const ICON_PPTX = new Set(['pptx','ppt','pptm','odp','fodp','ppsx'])

function FileIcon({ name }: { name: string; mimeType?: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ICON_DOCX.has(ext)) return <FileText size={16} className="text-primary" />
  if (ICON_XLSX.has(ext)) return <FileSpreadsheet size={16} className="text-green-500" />
  if (ICON_PPTX.has(ext)) return <Presentation size={16} className="text-orange-500" />
  if (ext === 'pdf') return <FileText size={16} className="text-red-500" />
  if (ext === 'hwp' || ext === 'hwpx') return <FileText size={16} className="text-teal-500" />
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return <File size={16} className="text-yellow-600" />
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return <File size={16} className="text-pink-400" />
  return <File size={16} className="text-content-subtle" />
}
function folderDisplayName(path: string) {
  return path ? `"${path.split('/').pop()}"` : '루트'
}

export default function DocumentList() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    getFlatList, openPaths, loadingPaths, initialLoading, uploading, uploadProgress, error, setError,
    rootStats, toggleFolder, uploadFiles, uploadFromDataTransfer, createFolder, downloadFile, deleteItem, linkToTask,
  } = useFileTree(id!)
  const { documents, loading: docsLoading, createDocument, deleteDocument } = useDocuments(id!)
  const { tasks: allTasks } = useTasks(id!)
  const leafTasks    = allTasks.filter(t => t.wbs_level === 3)
  const fileSessions = useFileSessions(id!)

  const inputRef = useRef<HTMLInputElement>(null)

  // ── 업로드 대상 폴더 ──────────────────────────────────────────────────────
  const [uploadPath, setUploadPath] = useState<string>('') // 선택된 업로드 대상 경로

  // ── 인라인 폴더 생성 ──────────────────────────────────────────────────────
  const [inlineFolder, setInlineFolder] = useState<{ parentPath: string; value: string } | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)

  // ── 에디터 문서 삭제 확인 ─────────────────────────────────────────────────
  const [confirmDocDelete, setConfirmDocDelete] = useState<{ id: string; title: string } | null>(null)
  const [deletingDoc, setDeletingDoc] = useState(false)

  const handleConfirmDocDelete = useCallback(async () => {
    if (!confirmDocDelete) return
    setDeletingDoc(true)
    try { await deleteDocument(confirmDocDelete.id) }
    catch { /* ignore */ }
    finally { setDeletingDoc(false); setConfirmDocDelete(null) }
  }, [confirmDocDelete, deleteDocument])

  // ── 파일 삭제 확인 ─────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<{ item: StorageItem | null; parentPath: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteRequest = useCallback((item: StorageItem, parentPath: string) => {
    setConfirmDelete({ item, parentPath })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete?.item) return
    setDeleting(true)
    await deleteItem(confirmDelete.item, confirmDelete.parentPath)
    setDeleting(false)
    setConfirmDelete(null)
  }, [confirmDelete, deleteItem])

  // ── 폴더 드래그오버 ───────────────────────────────────────────────────────
  const [folderDragOver, setFolderDragOver] = useState<string | null>(null)
  const [rootDragOver, setRootDragOver] = useState(false)

  // ── 회의록 생성 모달 ──────────────────────────────────────────────────────
  const [showMinutes, setShowMinutes]     = useState(false)
  const [minutesForm, setMinutesForm]     = useState({ date: '', attendees: '', agenda: '', notes: '' })
  const [generatingMinutes, setGeneratingMinutes] = useState(false)

  async function handleGenerateMinutes(e: React.FormEvent) {
    e.preventDefault()
    if (!minutesForm.notes.trim()) return
    setGeneratingMinutes(true)
    try {
      const content = await generateMeetingMinutes(minutesForm.notes, {
        date: minutesForm.date,
        attendees: minutesForm.attendees,
        agenda: minutesForm.agenda,
      })
      const doc = await createDocument({
        title: `회의록_${minutesForm.date || new Date().toLocaleDateString('ko-KR')}`,
        category: '기타',
        status: '작성중',
        dueDate: '',
        description: '',
      })
      // 생성된 회의록 내용을 에디터로 이동 (state로 전달)
      // 액션 아이템 자동 추출 (백그라운드)
      extractActionItems(content).then(async aiItems => {
        if (aiItems.length) {
          await createActionItemsFromMeeting(id!, doc.id, aiItems, leafTasks as never[], undefined)
        }
      }).catch(() => {})

      setShowMinutes(false)
      setMinutesForm({ date: '', attendees: '', agenda: '', notes: '' })
      navigate(`/documents/${doc.id}`, { state: { initialContent: content } })
    } catch (err) {
      alert(`회의록 생성 실패: ${(err as Error).message}`)
    } finally {
      setGeneratingMinutes(false)
    }
  }

  // ── 에디터 문서 생성 모달 ─────────────────────────────────────────────────
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>('요구사항')
  const [creatingDoc, setCreatingDoc] = useState(false)

  const nodes = useMemo(() => getFlatList(), [getFlatList])

  // ── 업로드 트리거 ─────────────────────────────────────────────────────────
  const triggerUpload = useCallback((targetPath: string) => {
    setUploadPath(targetPath)
    setTimeout(() => inputRef.current?.click(), 0)
  }, [])

  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await uploadFiles(e.target.files, uploadPath)
      e.target.value = ''
      setUploadPath('')
    }
  }, [uploadFiles, uploadPath])

  // ── 폴더 클릭: 토글 + 업로드 대상 선택 ───────────────────────────────────
  const handleFolderClick = useCallback((node: FlatNode) => {
    const path = getItemPath(node.item, node.parentPath)
    toggleFolder(node.item, node.parentPath)
    setUploadPath(path)
  }, [toggleFolder])

  // ── 인라인 폴더 생성 ──────────────────────────────────────────────────────
  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!inlineFolder?.value.trim()) return
    setCreatingFolder(true)
    const ok = await createFolder(inlineFolder.value.trim(), inlineFolder.parentPath)
    setCreatingFolder(false)
    if (ok) setInlineFolder(null)
  }

  // ── 에디터 문서 생성 ──────────────────────────────────────────────────────
  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!newDocTitle.trim()) return
    setCreatingDoc(true)
    try {
      const doc = await createDocument({
        title: newDocTitle.trim(),
        category: newDocCategory,
        status: '작성중',
        dueDate: '',
        description: '',
      })
      setShowNewDoc(false)
      setNewDocTitle('')
      navigate(`/documents/${doc.id}`)
    } finally {
      setCreatingDoc(false)
    }
  }

  // ── 루트 드래그앤드롭 (파일 + 폴더 모두 지원) ────────────────────────────
  const handleRootDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setRootDragOver(false)
    if (e.dataTransfer.items.length > 0) {
      await uploadFromDataTransfer(e.dataTransfer, uploadPath)
      setUploadPath('')
    }
  }, [uploadFromDataTransfer, uploadPath])

  return (
    <div className="p-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-content-muted mb-6">
        <Link to="/projects" className="hover:text-content">프로젝트</Link>
        <ChevronRight size={14} />
        <Link to={`/projects/${id}`} className="hover:text-content">프로젝트 상세</Link>
        <ChevronRight size={14} />
        <span className="text-content">산출물 목록</span>
      </div>

      <PageHeader
        title="산출물 목록"
        description={
          initialLoading
            ? '불러오는 중...'
            : `문서 ${documents.length}개 · 폴더 ${rootStats.folders}개 · 파일 ${rootStats.files}개`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowMinutes(true)}>
              <ClipboardList size={16} />
              회의록 생성
            </Button>
            <Button variant="secondary" onClick={() => setShowNewDoc(true)}>
              <PlusCircle size={16} />
              새 에디터 문서
            </Button>
            <Button
              variant="secondary"
              onClick={() => setInlineFolder({ parentPath: '', value: '' })}
            >
              <FolderPlus size={16} />
              새 폴더
            </Button>
            {/* 업로드 버튼: 선택된 폴더 표시 */}
            <Button onClick={() => triggerUpload(uploadPath)} disabled={uploading}>
              {uploading
                ? <Loader2 size={16} className="animate-spin" />
                : <Upload size={16} />}
              <span>
                {uploading
                  ? '업로드 중...'
                  : uploadPath
                    ? `${folderDisplayName(uploadPath)}에 올리기`
                    : '파일 올리기'}
              </span>
            </Button>
          </>
        }
      />

      {/* 업로드 대상 안내 배너 */}
      {uploadPath && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-primary-soft border border-primary/20 rounded-xl text-sm text-primary">
          <FolderOpen size={15} className="shrink-0" />
          <span>
            업로드 위치: <strong>{uploadPath.split('/').join(' / ')}</strong>
          </span>
          <button
            onClick={() => setUploadPath('')}
            className="ml-auto text-primary/60 hover:text-primary transition-colors"
            title="루트로 변경"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 숨김 input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_TYPES}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* 에러 */}
      {error && (
        <div className="mb-4 p-3 text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-danger hover:opacity-70">✕</button>
        </div>
      )}

      {/* ── 에디터 문서 섹션 ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-content flex items-center gap-1.5">
            <BookOpen size={15} className="text-primary" />
            에디터 문서
            <span className="text-xs font-normal text-content-subtle ml-1">{documents.length}개</span>
          </h2>
        </div>
        {docsLoading ? (
          <div className="flex items-center gap-2 text-content-subtle text-sm py-4">
            <Loader2 size={14} className="animate-spin" /> 불러오는 중…
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-8 flex flex-col items-center gap-2 text-content-subtle">
            <BookOpen size={28} className="opacity-30" />
            <p className="text-sm">에디터 문서가 없습니다.</p>
            <button onClick={() => setShowNewDoc(true)} className="mt-1 text-sm text-primary hover:underline">
              + 새 문서 만들기
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-content-muted">제목</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-muted w-20">분류</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-muted w-24">상태</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-muted w-20">버전</th>
                  <th className="text-left px-4 py-2.5 font-medium text-content-muted w-28">수정일</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map(doc => {
                  const badge = STATUS_BADGE[doc.status] ?? STATUS_BADGE['작성중']
                  return (
                    <tr key={doc.id}
                      className="group hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => navigate(`/documents/${doc.id}`)}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <FileText size={15} className="text-primary shrink-0" />
                          <span className="font-medium text-content">{doc.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-content-muted text-xs">{doc.category}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-content-muted bg-surface-hover px-2 py-0.5 rounded">
                          {doc.currentVersion}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-content-muted text-xs">
                        {formatDate(doc.updatedAt || doc.createdAt)}
                      </td>
                      <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setConfirmDocDelete({ id: doc.id, title: doc.title })}
                          className="p-1.5 rounded-md text-content-subtle hover:text-danger hover:bg-danger-soft transition-colors opacity-0 group-hover:opacity-100"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 파일 트리 ── */}
      <div
        onDrop={handleRootDrop}
        onDragOver={e => { e.preventDefault(); setRootDragOver(true) }}
        onDragLeave={e => {
          if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) setRootDragOver(false)
        }}
        className={`rounded-xl border-2 transition-colors overflow-hidden ${
          rootDragOver ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface'
        }`}
      >
        {/* 파일 트리 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-canvas">
          <h2 className="text-sm font-semibold text-content flex items-center gap-2">
            <Folder size={15} className="text-yellow-500" />
            파일
            {rootStats.files > 0 && (
              <span className="text-xs font-medium text-content-subtle bg-surface-hover px-1.5 py-0.5 rounded-full">
                {rootStats.files}
              </span>
            )}
          </h2>
          <span className="text-xs text-content-subtle hidden sm:block">
            {rootDragOver
              ? '📂 여기에 놓으면 업로드됩니다'
              : '폴더나 파일을 드래그해서 올리세요'}
          </span>
        </div>

        {initialLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 size={24} className="animate-spin text-content-subtle" />
          </div>
        ) : (
          <table className="w-full text-sm">
            {nodes.length > 0 && (
              <thead className="border-b border-line bg-canvas/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-content-muted text-xs whitespace-nowrap">이름</th>
                  <th className="text-left px-4 py-2 font-medium text-content-muted text-xs whitespace-nowrap w-32">연결 태스크</th>
                  <th className="text-left px-4 py-2 font-medium text-content-muted text-xs whitespace-nowrap w-16">버전</th>
                  <th className="text-left px-4 py-2 font-medium text-content-muted text-xs whitespace-nowrap w-24">워크플로우</th>
                  <th className="text-left px-4 py-2 font-medium text-content-muted text-xs whitespace-nowrap w-20">크기</th>
                  <th className="text-left px-4 py-2 font-medium text-content-muted text-xs whitespace-nowrap w-24">날짜</th>
                  <th className="px-4 py-2 w-36" />
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-line">
              {/* 인라인 루트 폴더 생성 */}
              {inlineFolder?.parentPath === '' && (
                <InlineFolderInput
                  value={inlineFolder.value}
                  depth={0}
                  creating={creatingFolder}
                  onChange={v => setInlineFolder(s => s ? { ...s, value: v } : s)}
                  onConfirm={handleCreateFolder}
                  onCancel={() => setInlineFolder(null)}
                />
              )}

              {nodes.length === 0 && !inlineFolder && (
                <tr>
                  <td colSpan={6} className="py-20">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Upload size={40} className={rootDragOver ? 'text-primary' : 'text-content-subtle'} />
                      <p className="text-content-subtle font-medium">
                        {rootDragOver ? '여기에 놓으면 업로드됩니다' : '파일이 없습니다'}
                      </p>
                      <p className="text-sm text-content-subtle">파일을 드래그하거나 위의 버튼을 클릭하세요</p>
                    </div>
                  </td>
                </tr>
              )}

              {nodes.map(node => {
                const path = getItemPath(node.item, node.parentPath)
                if (node.item.isFolder) {
                  return (
                    <>
                      <FolderRow
                        key={node.item.id}
                        node={node}
                        isOpen={openPaths.has(path)}
                        isLoading={loadingPaths.has(path)}
                        isSelected={uploadPath === path}
                        isDragOver={folderDragOver === path}
                        onToggle={() => handleFolderClick(node)}
                        onDelete={() => handleDeleteRequest(node.item, node.parentPath)}
                        onUploadHere={() => triggerUpload(path)}
                        onNewFolderHere={() => setInlineFolder({ parentPath: path, value: '' })}
                        onFolderDragOver={() => setFolderDragOver(path)}
                        onFolderDragLeave={() => setFolderDragOver(null)}
                        onFolderDrop={async dt => {
                          setFolderDragOver(null)
                          await uploadFromDataTransfer(dt, path)
                          setUploadPath('')
                        }}
                      />
                      {/* 인라인 하위 폴더 생성 */}
                      {inlineFolder?.parentPath === path && openPaths.has(path) && (
                        <InlineFolderInput
                          key={`inline-${path}`}
                          value={inlineFolder.value}
                          depth={node.depth + 1}
                          creating={creatingFolder}
                          onChange={v => setInlineFolder(s => s ? { ...s, value: v } : s)}
                          onConfirm={handleCreateFolder}
                          onCancel={() => setInlineFolder(null)}
                        />
                      )}
                    </>
                  )
                }
                return (
                  <FileRow
                    key={node.item.id}
                    node={node}
                    tasks={leafTasks}
                    editors={fileSessions[node.item.id] ?? []}
                    onDownload={() => downloadFile(node.item)}
                    onDelete={() => handleDeleteRequest(node.item, node.parentPath)}
                    onOpen={() => navigate(`/projects/${id}/view/${node.item.id}`)}
                    onLinkTask={taskId => linkToTask(node.item.id, taskId, node.parentPath)}
                  />
                )
              })}
            </tbody>
          </table>
        )}

        {rootDragOver && nodes.length > 0 && (
          <div className="px-4 py-3 text-center text-sm text-primary font-medium border-t border-primary/20 bg-primary-soft">
            {uploadPath ? `"${uploadPath.split('/').pop()}"에 업로드됩니다` : '루트에 업로드됩니다'}
          </div>
        )}
      </div>

      {/* ── 에디터 문서 삭제 확인 ── */}
      {confirmDocDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-sm overflow-hidden animate-fade-in-scale">
            <div className="flex items-start gap-3 px-5 pt-5 pb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content">문서 삭제</h2>
                <p className="text-sm text-content-muted mt-1">
                  <span className="font-medium text-content">{confirmDocDelete.title}</span> 문서와 모든 버전 이력이 삭제됩니다.
                </p>
                <p className="text-xs text-danger mt-2 font-medium">⚠ 삭제 후에는 복구할 수 없습니다.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-line bg-canvas">
              <Button variant="secondary" onClick={() => setConfirmDocDelete(null)} disabled={deletingDoc}>취소</Button>
              <Button variant="danger-filled" onClick={handleConfirmDocDelete} disabled={deletingDoc}>
                {deletingDoc ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-sm overflow-hidden animate-fade-in-scale">
            <div className="flex items-start gap-3 px-5 pt-5 pb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content">
                  {confirmDelete.item?.isFolder ? '폴더 삭제' : '파일 삭제'}
                </h2>
                <p className="text-sm text-content-muted mt-1">
                  <span className="font-medium text-content">{confirmDelete.item?.name}</span>
                  {confirmDelete.item?.isFolder
                    ? '(을)를 삭제합니다. 폴더 안의 모든 파일도 함께 삭제됩니다.'
                    : '(을)를 삭제합니다.'}
                </p>
                <p className="text-xs text-danger mt-2 font-medium">
                  ⚠ 삭제 후에는 복구할 수 없습니다.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-line bg-canvas">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                취소
              </Button>
              <Button
                variant="danger-filled"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 회의록 생성 모달 ── */}
      {showMinutes && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-lg animate-fade-in-scale">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-content flex items-center gap-2">
                <ClipboardList size={16} className="text-primary" />
                AI 회의록 생성
              </h2>
              <button onClick={() => setShowMinutes(false)} className="text-content-subtle hover:text-content">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGenerateMinutes} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-content mb-1.5">회의 일시</label>
                  <input type="date" value={minutesForm.date}
                    onChange={e => setMinutesForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content mb-1.5">참석자</label>
                  <input type="text" value={minutesForm.attendees}
                    onChange={e => setMinutesForm(f => ({ ...f, attendees: e.target.value }))}
                    placeholder="홍길동, 김철수, ..."
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-content mb-1.5">안건</label>
                <input type="text" value={minutesForm.agenda}
                  onChange={e => setMinutesForm(f => ({ ...f, agenda: e.target.value }))}
                  placeholder="주간 진행 현황 보고, 이슈 논의 ..."
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-content mb-1.5">
                  회의 메모 / 녹취 내용 <span className="text-danger">*</span>
                </label>
                <textarea
                  value={minutesForm.notes}
                  onChange={e => setMinutesForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="회의 중 작성한 메모나 녹취 내용을 붙여넣으세요..."
                  rows={8}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setShowMinutes(false)}>취소</Button>
                <Button type="submit" disabled={generatingMinutes || !minutesForm.notes.trim()}>
                  {generatingMinutes ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
                  {generatingMinutes ? 'AI가 작성 중...' : '회의록 생성'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 새 에디터 문서 모달 ── */}
      {showNewDoc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-sm animate-fade-in-scale">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-content flex items-center gap-2">
                <PlusCircle size={16} className="text-primary" />
                새 문서 만들기
              </h2>
              <button onClick={() => setShowNewDoc(false)} className="text-content-subtle hover:text-content-muted">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDoc} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-content mb-1.5">문서 제목 *</label>
                <input
                  autoFocus
                  type="text"
                  value={newDocTitle}
                  onChange={e => setNewDocTitle(e.target.value)}
                  placeholder="예: 요구사항 정의서"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content mb-1.5">분류</label>
                <select
                  value={newDocCategory}
                  onChange={e => setNewDocCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas"
                >
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setShowNewDoc(false)}>취소</Button>
                <Button type="submit" disabled={creatingDoc || !newDocTitle.trim()}>
                  {creatingDoc ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                  문서 생성 후 편집
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 인라인 폴더 생성 입력 ── */
function InlineFolderInput({
  value, depth, creating,
  onChange, onConfirm, onCancel,
}: {
  value: string
  depth: number
  creating: boolean
  onChange: (v: string) => void
  onConfirm: (e: React.FormEvent) => void
  onCancel: () => void
}) {
  return (
    <tr className="bg-primary-soft/40">
      <td colSpan={6} className="px-4 py-2" style={{ paddingLeft: `${16 + depth * 20}px` }}>
        <form onSubmit={onConfirm} className="flex items-center gap-2">
          <Folder size={15} className="text-yellow-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="폴더 이름 입력 후 Enter"
            className="flex-1 px-2 py-1 border border-primary/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-surface max-w-xs"
            onKeyDown={e => e.key === 'Escape' && onCancel()}
          />
          <button
            type="submit"
            disabled={creating || !value.trim()}
            className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-md text-content-muted hover:bg-surface-hover transition-colors"
          >
            <X size={14} />
          </button>
        </form>
      </td>
    </tr>
  )
}

/* ── 폴더 행 ── */
function FolderRow({
  node, isOpen, isLoading, isSelected, isDragOver,
  onToggle, onDelete, onUploadHere, onNewFolderHere,
  onFolderDragOver, onFolderDragLeave, onFolderDrop,
}: {
  node: FlatNode
  isOpen: boolean
  isLoading: boolean
  isSelected: boolean
  isDragOver: boolean
  onToggle: () => void
  onDelete: () => void
  onUploadHere: () => void
  onNewFolderHere: () => void
  onFolderDragOver: () => void
  onFolderDragLeave: () => void
  onFolderDrop: (dataTransfer: DataTransfer) => void
}) {
  const indent = node.depth * 20

  return (
    <tr
      className={`cursor-pointer transition-colors ${
        isDragOver
          ? 'bg-primary-soft border-y border-primary/30'
          : isSelected
            ? 'bg-primary-soft/60'
            : 'hover:bg-surface-hover'
      }`}
      onClick={onToggle}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onFolderDragOver() }}
      onDragLeave={e => { e.stopPropagation(); onFolderDragLeave() }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items.length) onFolderDrop(e.dataTransfer) }}
    >
      <td className="px-4 py-2.5 max-w-0 w-full" style={{ paddingLeft: `${16 + indent}px` }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 text-content-subtle w-4 flex items-center justify-center">
            {isLoading
              ? <Loader2 size={13} className="animate-spin" />
              : isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          {isOpen
            ? <FolderOpen size={16} className="shrink-0 text-yellow-400" />
            : <Folder size={16} className="shrink-0 text-yellow-400" />}
          <span className={`font-medium truncate ${isSelected ? 'text-primary' : 'text-content'}`}>
            {node.item.name}
          </span>
          {isSelected && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-primary text-white rounded-full ml-1">
              업로드 위치
            </span>
          )}
          {isDragOver && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-primary text-white rounded-full ml-1 animate-pulse">
              여기에 놓으세요
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-content-subtle text-xs w-32">—</td>
      <td className="px-4 py-2.5 text-content-subtle text-xs w-16">—</td>
      <td className="px-4 py-2.5 text-content-subtle text-xs w-20">—</td>
      <td className="px-4 py-2.5 text-content-subtle text-xs w-24">—</td>
      <td className="px-4 py-2.5 w-36 shrink-0">
        <div
          className="flex flex-nowrap justify-end items-center gap-0.5"
          onClick={e => e.stopPropagation()}
        >
          {/* 항상 보이는 업로드 버튼 */}
          <button
            onClick={onUploadHere}
            title="이 폴더에 파일 올리기"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary bg-primary-soft hover:bg-primary/10 transition-colors whitespace-nowrap"
          >
            <Upload size={12} />
            올리기
          </button>
          <button
            onClick={onNewFolderHere}
            title="하위 폴더 생성"
            className="p-1.5 rounded-md text-content-subtle hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={onDelete}
            title="폴더 삭제"
            className="p-1.5 rounded-md text-content-subtle hover:text-danger hover:bg-danger-soft transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ── 파일 행 ── */
function FileRow({ node, tasks, editors, onDownload, onDelete, onOpen, onLinkTask }: {
  node: FlatNode
  tasks: Task[]
  editors: import('../hooks/useFileSession').FileSession[]
  onDownload: () => void
  onDelete: () => void
  onOpen: () => void
  onLinkTask: (taskId: string | null) => void
}) {
  const item: StorageItem = node.item
  const indent = node.depth * 20
  const linkedTask = tasks.find(t => t.id === item.taskId)

  return (
    <tr className="group hover:bg-surface-hover transition-colors cursor-pointer" onClick={onOpen}>
      <td className="px-4 py-2.5 max-w-0 w-full" style={{ paddingLeft: `${16 + indent}px` }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-4 shrink-0" />
          <FileIcon name={item.name} mimeType={item.mimeType} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-medium text-content truncate">{item.title ?? item.name}</div>
              {editors.length > 0 && (
                <span
                  className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-success-soft text-success font-medium animate-pulse"
                  title={`편집 중: ${editors.map(e => e.userName).join(', ')}`}
                >
                  편집 중
                </span>
              )}
            </div>
            {item.title && item.title !== item.name && (
              <div className="text-xs text-content-subtle truncate">{item.name}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 w-32" onClick={e => e.stopPropagation()}>
        {tasks.length === 0 ? (
          <span className="text-xs text-content-subtle">—</span>
        ) : (
          <select
            value={item.taskId ?? ''}
            onChange={e => onLinkTask(e.target.value || null)}
            className={`text-xs border rounded px-1.5 py-0.5 w-full truncate bg-surface transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
              linkedTask ? 'border-primary/30 text-primary bg-primary-soft' : 'border-line text-content-muted hover:border-content-muted'
            }`}
          >
            <option value="">연결 없음</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.wbs_code} {t.task_name}</option>)}
          </select>
        )}
      </td>
      <td className="px-4 py-2.5 w-16">
        {item.version && (
          <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono bg-surface-hover text-content-muted">
            {item.version}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 w-24">
        {!item.isFolder && item.workflowStatus && (
          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${
            item.workflowStatus === '최초생성' ? 'bg-surface-hover text-content-muted border-line' :
            item.workflowStatus === '작성중'   ? 'bg-warning-soft text-warning border-warning/30' :
            item.workflowStatus === '검토중'   ? 'bg-primary-soft text-primary border-primary/30' :
            item.workflowStatus === '승인완료' ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300' :
                                                 'bg-success-soft text-success border-success/30'
          }`}>
            {item.workflowStatus}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-content-muted text-xs w-20 whitespace-nowrap">{formatFileSize(item.size)}</td>
      <td className="px-4 py-2.5 text-content-muted text-xs w-24 whitespace-nowrap">{formatDate(item.createdAt)}</td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onOpen} title="열기"
            className="p-1.5 rounded-md text-content-subtle hover:text-success hover:bg-success-soft transition-colors">
            <ExternalLink size={14} />
          </button>
          <button onClick={onDownload} title="다운로드"
            className="p-1.5 rounded-md text-content-subtle hover:text-primary hover:bg-primary-soft transition-colors">
            <Download size={14} />
          </button>
          <button onClick={onDelete} title="삭제"
            className="p-1.5 rounded-md text-content-subtle hover:text-danger hover:bg-danger-soft transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
