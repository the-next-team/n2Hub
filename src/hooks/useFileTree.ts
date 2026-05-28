import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { StorageItem } from './useFiles'

function parseFileName(name: string): { title: string; version: string } {
  const nameWithoutExt = name.replace(/\.[^.]+$/, '')
  const codeMatch = /^[A-Z0-9]+-\d+-[A-Z]+-\d+\.\s*(.+?)(?:_v([\d.]+))?$/.exec(nameWithoutExt)
  if (codeMatch) return { title: codeMatch[1].trim(), version: codeMatch[2] ? `v${codeMatch[2]}` : 'v1.0' }
  const simpleMatch = /^(.+?)_v([\d.]+)$/.exec(nameWithoutExt)
  if (simpleMatch) return { title: simpleMatch[1].trim(), version: `v${simpleMatch[2]}` }
  return { title: nameWithoutExt, version: 'v1.0' }
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
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const uploaded: StorageItem[] = []
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop() ?? 'bin'
        const storagePath = `${projectId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('documents').upload(storagePath, file, { upsert: false })
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
    error,
    setError,
    rootStats,
    toggleFolder,
    uploadFiles,
    createFolder,
    downloadFile,
    deleteItem,
    linkToTask,
  }
}
