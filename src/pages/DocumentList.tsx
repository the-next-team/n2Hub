import { useRef, useState, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronDown,
  Upload, Download, Trash2,
  FileText, FileSpreadsheet, Presentation, File,
  Folder, FolderOpen, FolderPlus,
  Loader2, ExternalLink,
} from 'lucide-react'
import { useFileTree, getItemPath } from '../hooks/useFileTree'
import type { FlatNode } from '../hooks/useFileTree'
import type { StorageItem } from '../hooks/useFiles'
import { Button, PageHeader } from '../components/ui'

const ACCEPT_TYPES = '.docx,.xlsx,.pptx,.pdf,.hwp,.doc,.xls,.ppt,.zip,.png,.jpg,.jpeg'

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function FileIcon({ name, mimeType }: { name: string; mimeType?: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'docx' || ext === 'doc') return <FileText size={16} className="text-primary" />
  if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet size={16} className="text-green-500" />
  if (ext === 'pptx' || ext === 'ppt') return <Presentation size={16} className="text-orange-500" />
  if (ext === 'pdf' || mimeType === 'application/pdf') return <FileText size={16} className="text-red-500" />
  return <File size={16} className="text-content-subtle" />
}

export default function DocumentList() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    getFlatList, openPaths, loadingPaths, initialLoading, uploading, error, setError,
    rootStats, toggleFolder, uploadFiles, createFolder, downloadFile, deleteItem,
  } = useFileTree(id!)

  const inputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string>('')

  const [dragOver, setDragOver] = useState(false)
  const [newFolderState, setNewFolderState] = useState<{ targetPath: string; value: string } | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)

  const nodes = useMemo(() => getFlatList(), [getFlatList])

  const triggerUpload = useCallback((targetPath: string) => {
    uploadTargetRef.current = targetPath
    inputRef.current?.click()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files, '')
  }, [uploadFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if ((e.currentTarget as Node).contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      uploadFiles(e.target.files, uploadTargetRef.current)
      e.target.value = ''
    }
  }, [uploadFiles])

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderState?.value.trim()) return
    setCreatingFolder(true)
    const ok = await createFolder(newFolderState.value, newFolderState.targetPath)
    setCreatingFolder(false)
    if (ok) setNewFolderState(null)
  }

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
            : `폴더 ${rootStats.folders}개 · 파일 ${rootStats.files}개`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setNewFolderState({ targetPath: '', value: '' })}>
              <FolderPlus size={16} />
              새 폴더
            </Button>
            <Button onClick={() => triggerUpload('')} disabled={uploading}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? '업로드 중...' : '파일 올리기'}
            </Button>
          </>
        }
      />

      {/* 숨김 파일 input */}
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
          <button onClick={() => setError(null)} className="text-danger hover:opacity-70 ml-4">✕</button>
        </div>
      )}

      {/* 새 폴더 입력 폼 */}
      {newFolderState && (
        <form onSubmit={handleCreateFolder}
          className="mb-4 flex items-center gap-2 px-4 py-3 bg-surface rounded-xl border border-line"
        >
          <Folder size={15} className="text-yellow-400 shrink-0" />
          <span className="text-sm text-content-muted shrink-0">
            {newFolderState.targetPath
              ? `"${newFolderState.targetPath.split('/').pop()}" 안에`
              : '루트에'}
          </span>
          <ChevronRight size={13} className="text-content-subtle shrink-0" />
          <input
            autoFocus
            type="text"
            value={newFolderState.value}
            onChange={e => setNewFolderState(s => s ? { ...s, value: e.target.value } : s)}
            placeholder="폴더명 입력..."
            className="px-3 py-1.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-52"
          />
          <Button type="submit" size="sm" disabled={creatingFolder || !newFolderState.value.trim()}>
            {creatingFolder ? <Loader2 size={14} className="animate-spin" /> : '생성'}
          </Button>
          <Button type="button" variant="ghost" size="sm"
            onClick={() => setNewFolderState(null)}>취소</Button>
        </form>
      )}

      {/* 트리 뷰 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-xl border-2 transition-colors overflow-hidden ${
          dragOver ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
        }`}
      >
        {initialLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 size={24} className="animate-spin text-content-subtle" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-center">
            <Upload size={40} className={dragOver ? 'text-primary' : 'text-content-subtle'} />
            <p className="text-content-subtle font-medium">
              {dragOver ? '놓아서 업로드' : '비어있습니다'}
            </p>
            <p className="text-sm text-content-subtle">
              파일을 드래그하거나 위의 버튼으로 올리세요
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-content-muted">이름</th>
                <th className="text-left px-4 py-2.5 font-medium text-content-muted w-20">버전</th>
                <th className="text-left px-4 py-2.5 font-medium text-content-muted w-24">크기</th>
                <th className="text-left px-4 py-2.5 font-medium text-content-muted w-32">날짜</th>
                <th className="px-4 py-2.5 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {nodes.map(node =>
                node.item.isFolder ? (
                  <FolderRow
                    key={node.item.id}
                    node={node}
                    isOpen={openPaths.has(getItemPath(node.item, node.parentPath))}
                    isLoading={loadingPaths.has(getItemPath(node.item, node.parentPath))}
                    onToggle={() => toggleFolder(node.item, node.parentPath)}
                    onDelete={() => deleteItem(node.item, node.parentPath)}
                    onUploadHere={() => triggerUpload(getItemPath(node.item, node.parentPath))}
                    onNewFolderHere={() =>
                      setNewFolderState({ targetPath: getItemPath(node.item, node.parentPath), value: '' })
                    }
                  />
                ) : (
                  <FileRow
                    key={node.item.id}
                    node={node}
                    onDownload={() => downloadFile(node.item)}
                    onDelete={() => deleteItem(node.item, node.parentPath)}
                    onOpen={() => navigate(`/projects/${id}/view/${node.item.id}`)}
                  />
                )
              )}
            </tbody>
          </table>
        )}

        {dragOver && nodes.length > 0 && (
          <div className="px-4 py-3 text-center text-sm text-primary font-medium border-t border-primary/20 bg-primary-soft">
            루트 폴더에 파일을 업로드합니다
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 폴더 행 ── */
function FolderRow({ node, isOpen, isLoading, onToggle, onDelete, onUploadHere, onNewFolderHere }: {
  node: FlatNode
  isOpen: boolean
  isLoading: boolean
  onToggle: () => void
  onDelete: () => void
  onUploadHere: () => void
  onNewFolderHere: () => void
}) {
  const indent = node.depth * 20

  return (
    <tr
      className="hover:bg-surface-hover cursor-pointer transition-colors group"
      onClick={onToggle}
    >
      <td className="px-4 py-2.5" style={{ paddingLeft: `${16 + indent}px` }}>
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-content-subtle w-4 flex items-center justify-center">
            {isLoading
              ? <Loader2 size={13} className="animate-spin" />
              : isOpen
                ? <ChevronDown size={13} />
                : <ChevronRight size={13} />
            }
          </span>
          {isOpen
            ? <FolderOpen size={16} className="shrink-0 text-yellow-400" />
            : <Folder size={16} className="shrink-0 text-yellow-400" />
          }
          <span className="font-medium text-content">{node.item.name}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-content-subtle text-xs">—</td>
      <td className="px-4 py-2.5 text-content-subtle text-xs">—</td>
      <td className="px-4 py-2.5 text-content-subtle text-xs">—</td>
      <td className="px-4 py-2.5">
        <div
          className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onNewFolderHere}
            title="하위 폴더 생성"
            className="p-1.5 rounded-md text-content-subtle hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={onUploadHere}
            title="이 폴더에 업로드"
            className="p-1.5 rounded-md text-content-subtle hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <Upload size={14} />
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
function FileRow({ node, onDownload, onDelete, onOpen }: {
  node: FlatNode
  onDownload: () => void
  onDelete: () => void
  onOpen: () => void
}) {
  const item: StorageItem = node.item
  const indent = node.depth * 20

  return (
    <tr
      className="hover:bg-surface-hover transition-colors group cursor-pointer"
      onClick={onOpen}
    >
      <td className="px-4 py-2.5" style={{ paddingLeft: `${16 + indent}px` }}>
        <div className="flex items-center gap-2">
          {/* 파일은 chevron 너비만큼 공간 확보 */}
          <span className="w-4 shrink-0" />
          <FileIcon name={item.name} mimeType={item.mimeType} />
          <div className="min-w-0">
            <div className="font-medium text-content truncate">{item.title ?? item.name}</div>
            {item.title && item.title !== item.name && (
              <div className="text-xs text-content-subtle truncate max-w-xs">{item.name}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        {item.version && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-mono bg-surface-hover text-content-muted">
            {item.version}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-content-muted text-xs">{formatFileSize(item.size)}</td>
      <td className="px-4 py-2.5 text-content-muted text-xs">{formatDate(item.createdAt)}</td>
      <td className="px-4 py-2.5">
        <div
          className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onOpen}
            title="열기"
            className="p-1.5 rounded-md text-content-subtle hover:text-success hover:bg-success-soft transition-colors"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onDownload}
            title="다운로드"
            className="p-1.5 rounded-md text-content-subtle hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <Download size={14} />
          </button>
          <button
            onClick={onDelete}
            title="삭제"
            className="p-1.5 rounded-md text-content-subtle hover:text-danger hover:bg-danger-soft transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
