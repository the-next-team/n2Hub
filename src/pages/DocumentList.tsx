import { useRef, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Upload,
  Download,
  Trash2,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Folder,
  FolderPlus,
  Loader2,
  Home,
  ExternalLink,
} from 'lucide-react'
import { useFiles } from '../hooks/useFiles'
import type { StorageItem } from '../hooks/useFiles'

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
  if (ext === 'docx' || ext === 'doc') return <FileText size={18} className="text-blue-500" />
  if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet size={18} className="text-green-500" />
  if (ext === 'pptx' || ext === 'ppt') return <Presentation size={18} className="text-orange-500" />
  if (ext === 'pdf' || mimeType === 'application/pdf') return <FileText size={18} className="text-red-500" />
  return <File size={18} className="text-gray-400" />
}

export default function DocumentList() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    items, loading, uploading, error,
    currentPath,
    navigateTo, navigateUp, navigateToIndex, navigateToRoot,
    createFolder, uploadFiles, downloadFile, deleteItem,
  } = useFiles(id!)

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
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
      uploadFiles(e.target.files)
      e.target.value = ''
    }
  }, [uploadFiles])

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    await createFolder(newFolderName)
    setCreatingFolder(false)
    setNewFolderName('')
    setShowNewFolder(false)
  }

  const folders = items.filter(i => i.isFolder)
  const files   = items.filter(i => !i.isFolder)

  return (
    <div className="p-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/projects" className="hover:text-gray-700">프로젝트</Link>
        <ChevronRight size={14} />
        <Link to={`/projects/${id}`} className="hover:text-gray-700">프로젝트 상세</Link>
        <ChevronRight size={14} />
        <span className="text-gray-900">산출물 목록</span>
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">산출물 목록</h1>
          <p className="text-gray-500 mt-1">
            {loading ? '불러오는 중...' : `폴더 ${folders.length}개 · 파일 ${files.length}개`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <FolderPlus size={16} />
            새 폴더
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? '업로드 중...' : '파일 올리기'}
          </button>
        </div>
      </div>

      {/* 숨김 input */}
      <input ref={inputRef} type="file" multiple accept={ACCEPT_TYPES} className="hidden" onChange={handleInputChange} />

      {/* 에러 */}
      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>
      )}

      {/* 새 폴더 입력 */}
      {showNewFolder && (
        <form onSubmit={handleCreateFolder} className="mb-4 flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="폴더명 입력..."
            className="px-3 py-2 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          <button
            type="submit"
            disabled={creatingFolder || !newFolderName.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingFolder ? <Loader2 size={14} className="animate-spin" /> : '생성'}
          </button>
          <button
            type="button"
            onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            취소
          </button>
        </form>
      )}

      {/* 경로 네비게이션 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-xl border-2 transition-colors overflow-hidden ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
        }`}
      >
        {/* 경로 바 */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-sm flex-wrap">
          <button
            onClick={navigateToRoot}
            className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Home size={14} />
            <span>루트</span>
          </button>
          {currentPath.map((segment, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-gray-300" />
              <button
                onClick={() => navigateToIndex(idx)}
                className="text-gray-500 hover:text-blue-600 transition-colors truncate max-w-[140px]"
              >
                {segment}
              </button>
            </span>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-center">
            <Upload size={40} className={dragOver ? 'text-blue-400' : 'text-gray-200'} />
            <p className="text-gray-400 font-medium">
              {dragOver ? '놓아서 업로드' : '비어있습니다'}
            </p>
            <p className="text-sm text-gray-400">
              파일을 드래그하거나 위의 버튼으로 올리세요
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-8"></th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">이름</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">버전</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">크기</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">날짜</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* 상위 폴더로 이동 */}
              {currentPath.length > 0 && (
                <tr
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={navigateUp}
                >
                  <td className="px-4 py-3">
                    <Folder size={18} className="text-yellow-400" />
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-medium" colSpan={5}>..</td>
                </tr>
              )}
              {items.map(item =>
                item.isFolder ? (
                  <FolderRow key={item.name} item={item} onOpen={navigateTo} onDelete={deleteItem} />
                ) : (
                  <FileRow
                    key={item.name}
                    item={item}
                    onDownload={downloadFile}
                    onDelete={deleteItem}
                    onOpen={() => navigate(`/projects/${id}/view/${item.id}`)}
                  />
                )
              )}
            </tbody>
          </table>
        )}

        {/* 드래그 오버레이 안내 */}
        {dragOver && items.length > 0 && (
          <div className="px-4 py-3 text-center text-sm text-blue-500 font-medium border-t border-blue-100 bg-blue-50">
            현재 폴더에 파일을 업로드합니다
          </div>
        )}
      </div>
    </div>
  )
}

function FolderRow({ item, onOpen, onDelete }: {
  item: StorageItem
  onOpen: (name: string) => void
  onDelete: (item: StorageItem) => void
}) {
  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors group"
      onClick={() => onOpen(item.name)}
    >
      <td className="px-4 py-3">
        <Folder size={18} className="text-yellow-400" />
      </td>
      <td className="px-4 py-3 font-medium text-gray-800" colSpan={4}>
        {item.name}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onDelete(item) }}
            title="삭제"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function FileRow({ item, onDownload, onDelete, onOpen }: {
  item: StorageItem
  onDownload: (item: StorageItem) => void
  onDelete: (item: StorageItem) => void
  onOpen: () => void
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={onOpen}>
      <td className="px-4 py-3">
        <FileIcon name={item.name} mimeType={item.mimeType} />
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{item.title ?? item.name}</div>
        {item.title && item.title !== item.name && (
          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{item.name}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {item.version && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-mono bg-gray-100 text-gray-600">
            {item.version}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500">{formatFileSize(item.size)}</td>
      <td className="px-4 py-3 text-gray-500">{formatDate(item.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onOpen() }}
            title="열기"
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
          >
            <ExternalLink size={15} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDownload(item) }}
            title="다운로드"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          >
            <Download size={15} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(item) }}
            title="삭제"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  )
}
