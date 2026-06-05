import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useUploadContext } from '../contexts/UploadContext'
import type { StorageItem } from './useFiles'

/* ── 업로드 제외 패턴 ───────────────────────────────────────────────── */
// ~$ : Office 임시 잠금 파일 (원본 열려있을 때 생성)
// .  : macOS 숨김 파일 (.DS_Store 등)
function shouldSkipFile(name: string): boolean {
  return name.startsWith('~$') || name.startsWith('.')
}

/* ── 폴더 드래그앤드롭 헬퍼 ────────────────────────────────────────── */

// FileSystemDirectoryReader 는 한 번에 최대 100개만 반환 → 전부 읽기
async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (batch.length === 0) break
    all.push(...batch)
  }
  return all
}

type CollectedFile   = { file: File; folderPath: string }
type CollectedFolder = { name: string; parentPath: string }

// 재귀 수집: 파일 + 폴더 목록 반환
async function collectFromEntry(
  entry: FileSystemEntry,
  parentPath: string,
): Promise<{ files: CollectedFile[]; folders: CollectedFolder[] }> {
  const files: CollectedFile[]     = []
  const folders: CollectedFolder[] = []

  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    )
    files.push({ file, folderPath: parentPath })
  } else if (entry.isDirectory) {
    const myPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
    folders.push({ name: entry.name, parentPath })
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader())
    for (const child of children) {
      const sub = await collectFromEntry(child, myPath)
      files.push(...sub.files)
      folders.push(...sub.folders)
    }
  }

  return { files, folders }
}

function parseFileName(name: string): { title: string; version: string } {
  const noExt = name.replace(/\.[^.]+$/, '')

  // 1순위: _v0.1 / _v0_2 / _v1.0 / _v2.1d 형식 (v 접두어 있음)
  const m1 = /^(.+)_v(\d+[._]\w+)$/i.exec(noExt)
  if (m1) return { title: m1[1].trim(), version: `v${m1[2].replace(/_/g, '.')}` }

  // 2순위: _0.7 / _1.4 형식 (v 없이 숫자.숫자 로 끝나는 경우)
  const m2 = /^(.+)_(\d+\.\d+)$/.exec(noExt)
  if (m2) return { title: m2[1].trim(), version: `v${m2[2]}` }

  // 버전 없는 파일 — 그대로 표시
  return { title: noExt, version: '' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): StorageItem {
  if (row.mime_type === 'folder') {
    return { id: row.id, name: row.original_name, isFolder: true }
  }
  const { title, version } = parseFileName(row.original_name)
  return {
    id: row.id,
    name: row.original_name,
    isFolder: false,
    size: row.size,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    title,
    version: row.version || version,
    taskId: row.task_id ?? null,
  }
}

export interface FlatNode {
  item: StorageItem
  depth: number
  parentPath: string
}

export function getItemPath(item: StorageItem, parentPath: string): string {
  return parentPath ? `${parentPath}/${item.name}` : item.name
}

export function useFileTree(projectId: string) {
  const { user } = useAuth()

  // path → children items (캐시)
  const [pathItems, setPathItems] = useState<Map<string, StorageItem[]>>(new Map())
  // 펼쳐진 폴더 경로 set
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set())
  // 로딩 중인 경로 set
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 업로드 상태는 앱 전역 Context로 관리 (페이지 이동해도 유지)
  const { uploading, setUploading, uploadProgress, setUploadProgress } = useUploadContext()

  const fetchPath = useCallback(async (path: string) => {
    setLoadingPaths(prev => new Set([...prev, path]))
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .eq('folder_path', path)
        .order('mime_type', { ascending: false })  // folder 먼저
        .order('original_name', { ascending: true })
      if (error) throw error
      setPathItems(prev => new Map([...prev, [path, (data || []).map(mapRow)]]))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingPaths(prev => { const n = new Set(prev); n.delete(path); return n })
      if (path === '') setInitialLoading(false)
    }
  }, [projectId])

  // 루트 초기 로드
  useEffect(() => { if (projectId) fetchPath('') }, [projectId, fetchPath])

  // 폴더 펼침/접힘
  const toggleFolder = useCallback(async (item: StorageItem, parentPath: string) => {
    const itemPath = getItemPath(item, parentPath)
    if (openPaths.has(itemPath)) {
      // 접기: 자신과 하위 모두 닫기
      setOpenPaths(prev => {
        const next = new Set(prev)
        for (const p of [...next]) {
          if (p === itemPath || p.startsWith(itemPath + '/')) next.delete(p)
        }
        return next
      })
    } else {
      // 펼치기: 먼저 open 표시, 캐시 없으면 fetch
      setOpenPaths(prev => new Set([...prev, itemPath]))
      if (!pathItems.has(itemPath)) await fetchPath(itemPath)
    }
  }, [openPaths, pathItems, fetchPath])

  // 렌더용 평탄 리스트 (depth 포함)
  const getFlatList = useCallback((): FlatNode[] => {
    const result: FlatNode[] = []
    function build(parentPath: string, depth: number) {
      const items = pathItems.get(parentPath) || []
      for (const item of items) {
        result.push({ item, depth, parentPath })
        if (item.isFolder) {
          const itemPath = getItemPath(item, parentPath)
          if (openPaths.has(itemPath)) build(itemPath, depth + 1)
        }
      }
    }
    build('', 0)
    return result
  }, [pathItems, openPaths])

  const rootStats = useMemo(() => {
    const root = pathItems.get('') || []
    return { folders: root.filter(i => i.isFolder).length, files: root.filter(i => !i.isFolder).length }
  }, [pathItems])

  // 파일 업로드 (targetPath: 어느 폴더에 올릴지)
  const uploadFiles = useCallback(async (fileList: FileList | File[], targetPath: string) => {
    if (!user) { setError('로그인이 필요합니다.'); return }
    setUploading(true)
    setError(null)
    const files = Array.from(fileList).filter(f => !shouldSkipFile(f.name))
    if (files.length === 0) { setUploading(false); return }
    const fileCount = files.length
    const uploaded: StorageItem[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress({ fileIndex: i + 1, fileCount, fileName: file.name, percent: 0 })
        const ext = file.name.split('.').pop() ?? 'bin'
        const storagePath = `${projectId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('documents').upload(storagePath, file, {
            upsert: false,
            onUploadProgress: ({ loaded, total }) => {
              setUploadProgress({ fileIndex: i + 1, fileCount, fileName: file.name, percent: Math.round((loaded / total) * 100) })
            },
          })
        if (upErr) throw new Error(`${file.name}: ${upErr.message}`)
        const { title, version } = parseFileName(file.name)
        const { data, error: dbErr } = await supabase.from('files').insert([{
          project_id: projectId,
          original_name: file.name,
          folder_path: targetPath,
          storage_path: storagePath,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
          version,
          uploaded_by: user.id,
        }]).select().single()
        if (dbErr) throw new Error(`DB 저장 실패 (${file.name}): ${dbErr.message}`)
        uploaded.push({ ...mapRow(data), title })
      }
      setPathItems(prev => {
        const existing = prev.get(targetPath) || []
        const merged = [...uploaded, ...existing].sort((a, b) => {
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
          return a.name.localeCompare(b.name, 'ko')
        })
        return new Map([...prev, [targetPath, merged]])
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }, [projectId, user])

  // 폴더 생성
  const createFolder = useCallback(async (name: string, targetPath: string): Promise<boolean> => {
    const trimmed = name.trim()
    if (!trimmed || !user) return false
    setError(null)
    try {
      const { data: dup } = await supabase.from('files').select('id')
        .eq('project_id', projectId).eq('folder_path', targetPath)
        .eq('original_name', trimmed).eq('mime_type', 'folder').maybeSingle()
      if (dup) { setError('같은 이름의 폴더가 이미 있습니다.'); return false }
      const { data, error } = await supabase.from('files').insert([{
        project_id: projectId,
        original_name: trimmed,
        folder_path: targetPath,
        storage_path: '',
        size: 0,
        mime_type: 'folder',
        version: '',
        uploaded_by: user.id,
      }]).select().single()
      if (error) throw error
      setPathItems(prev => {
        const existing = prev.get(targetPath) || []
        const merged = [mapRow(data), ...existing].sort((a, b) => {
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
          return a.name.localeCompare(b.name, 'ko')
        })
        return new Map([...prev, [targetPath, merged]])
      })
      return true
    } catch (err) {
      setError(`폴더 생성 실패: ${(err as Error).message}`)
      return false
    }
  }, [projectId, user])

  // 다운로드
  const downloadFile = useCallback(async (item: StorageItem) => {
    if (!item.storagePath) return
    try {
      const { data, error } = await supabase.storage.from('documents').download(item.storagePath)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = item.name
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (err) {
      setError(`다운로드 실패: ${(err as Error).message}`)
    }
  }, [])

  // 삭제 (폴더면 하위 포함 재귀)
  const deleteItem = useCallback(async (item: StorageItem, parentPath: string) => {
    // 낙관적 업데이트: 즉시 UI에서 제거
    setPathItems(prev => {
      const existing = prev.get(parentPath) || []
      return new Map([...prev, [parentPath, existing.filter(i => i.id !== item.id)]])
    })
    setError(null)
    try {
      if (item.isFolder) {
        const itemPath = getItemPath(item, parentPath)
        // 하위 파일/폴더 조회 (folder_path = itemPath 또는 시작이 itemPath/)
        const { data: sub } = await supabase.from('files')
          .select('id, storage_path, mime_type')
          .eq('project_id', projectId)
          .or(`folder_path.eq.${itemPath},folder_path.like.${itemPath}/%`)
        if (sub?.length) {
          const paths = sub.filter(f => f.mime_type !== 'folder' && f.storage_path).map(f => f.storage_path)
          if (paths.length) await supabase.storage.from('documents').remove(paths)
          await supabase.from('files').delete().in('id', sub.map(f => f.id))
        }
        // 폴더 레코드 자체 삭제
        await supabase.from('files').delete().eq('id', item.id)
        // 상태 정리
        setOpenPaths(prev => {
          const n = new Set(prev)
          for (const p of [...n]) if (p === itemPath || p.startsWith(itemPath + '/')) n.delete(p)
          return n
        })
        setPathItems(prev => {
          const n = new Map(prev)
          for (const p of n.keys()) if (p === itemPath || p.startsWith(itemPath + '/')) n.delete(p)
          return n
        })
      } else {
        if (item.storagePath) await supabase.storage.from('documents').remove([item.storagePath])
        await supabase.from('files').delete().eq('id', item.id)
      }
    } catch (err) {
      // 실패 시 해당 경로 새로고침
      await fetchPath(parentPath)
      setError(`삭제 실패: ${(err as Error).message}`)
    }
  }, [projectId, fetchPath])

  // DataTransfer 드롭 — 폴더 구조 포함 재귀 업로드
  const uploadFromDataTransfer = useCallback(async (dataTransfer: DataTransfer, targetPath: string) => {
    if (!user) { setError('로그인이 필요합니다.'); return }
    setUploading(true)
    setError(null)

    try {
      const allFiles: CollectedFile[]     = []
      const allFolders: CollectedFolder[] = []

      for (const item of Array.from(dataTransfer.items)) {
        const entry = item.webkitGetAsEntry?.()
        if (!entry) {
          // webkitGetAsEntry 미지원 브라우저 폴백
          const file = item.getAsFile()
          if (file) allFiles.push({ file, folderPath: targetPath })
          continue
        }
        const sub = await collectFromEntry(entry, targetPath)
        allFiles.push(...sub.files)
        allFolders.push(...sub.folders)
      }

      // 부모 먼저 생성되도록 깊이 순 정렬
      allFolders.sort((a, b) => {
        const aFull = a.parentPath ? `${a.parentPath}/${a.name}` : a.name
        const bFull = b.parentPath ? `${b.parentPath}/${b.name}` : b.name
        return aFull.split('/').length - bFull.split('/').length
      })

      // 임시 파일 제거 (Office 잠금 파일, macOS 숨김 파일 등)
      const filteredFiles = allFiles.filter(({ file }) => !shouldSkipFile(file.name))

      // 배치 상태 업데이트용 맵
      const newItemsByPath = new Map<string, StorageItem[]>()

      // 폴더 생성
      for (const { name, parentPath } of allFolders) {
        const { data: dup } = await supabase.from('files').select('id')
          .eq('project_id', projectId).eq('folder_path', parentPath)
          .eq('original_name', name).eq('mime_type', 'folder').maybeSingle()
        if (dup) continue

        const { data, error } = await supabase.from('files').insert([{
          project_id: projectId,
          original_name: name,
          folder_path: parentPath,
          storage_path: '',
          size: 0,
          mime_type: 'folder',
          version: '',
          uploaded_by: user.id,
        }]).select().single()
        if (error) throw error

        const existing = newItemsByPath.get(parentPath) ?? []
        newItemsByPath.set(parentPath, [...existing, mapRow(data)])
      }

      // 파일 업로드
      const fileCount = filteredFiles.length
      for (let i = 0; i < filteredFiles.length; i++) {
        const { file, folderPath } = filteredFiles[i]
        setUploadProgress({ fileIndex: i + 1, fileCount, fileName: file.name, percent: 0 })
        const ext = file.name.split('.').pop() ?? 'bin'
        const storagePath = `${projectId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('documents').upload(storagePath, file, {
            upsert: false,
            onUploadProgress: ({ loaded, total }) => {
              setUploadProgress({ fileIndex: i + 1, fileCount, fileName: file.name, percent: Math.round((loaded / total) * 100) })
            },
          })
        if (upErr) throw new Error(`${file.name}: ${upErr.message}`)
        const { title, version } = parseFileName(file.name)
        const { data, error: dbErr } = await supabase.from('files').insert([{
          project_id: projectId,
          original_name: file.name,
          folder_path: folderPath,
          storage_path: storagePath,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
          version,
          uploaded_by: user.id,
        }]).select().single()
        if (dbErr) throw new Error(`DB 저장 실패 (${file.name}): ${dbErr.message}`)

        const existing = newItemsByPath.get(folderPath) ?? []
        newItemsByPath.set(folderPath, [...existing, { ...mapRow(data), title }])
      }

      // 전체 상태 한 번에 반영
      setPathItems(prev => {
        const next = new Map(prev)
        for (const [path, newItems] of newItemsByPath) {
          const existing = next.get(path) || []
          const merged = [...existing, ...newItems].sort((a, b) => {
            if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
            return a.name.localeCompare(b.name, 'ko')
          })
          next.set(path, merged)
        }
        return next
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }, [projectId, user])

  // 파일 ↔ 태스크 연결
  const linkToTask = useCallback(async (
    fileId: string,
    taskId: string | null,
    parentPath: string,
  ) => {
    setError(null)
    const { error } = await supabase
      .from('files')
      .update({ task_id: taskId })
      .eq('id', fileId)
    if (error) { setError('연결 실패: ' + error.message); return }
    setPathItems(prev => {
      const next = new Map(prev)
      const items = next.get(parentPath) || []
      next.set(parentPath, items.map(i => i.id === fileId ? { ...i, taskId } : i))
      return next
    })
  }, [])

  return {
    getFlatList,
    openPaths,
    loadingPaths,
    initialLoading,
    uploading,
    uploadProgress,
    error,
    setError,
    rootStats,
    toggleFolder,
    uploadFiles,
    uploadFromDataTransfer,
    createFolder,
    downloadFile,
    deleteItem,
    linkToTask,
  }
}
