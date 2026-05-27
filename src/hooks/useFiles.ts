import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface StorageItem {
  id: string
  name: string
  isFolder: boolean
  // 파일 전용
  size?: number
  mimeType?: string
  storagePath?: string
  createdAt?: string
  // 파일명 파싱
  title?: string
  version?: string
}

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
  }
}

export function useFiles(projectId: string) {
  const { user } = useAuth()
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [items, setItems] = useState<StorageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 현재 폴더 경로 문자열 (e.g. "10.관리산출물/01.계획")
  const folderPath = currentPath.join('/')

  const fetchItems = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .eq('folder_path', path)
        .order('mime_type', { ascending: false })   // folder 먼저
        .order('original_name', { ascending: true })

      if (error) throw error
      setItems((data || []).map(mapRow))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    fetchItems(folderPath)
  }, [projectId, folderPath, fetchItems])

  const navigateTo = useCallback((folderName: string) => {
    setCurrentPath(prev => [...prev, folderName])
  }, [])

  const navigateUp = useCallback(() => {
    setCurrentPath(prev => prev.slice(0, -1))
  }, [])

  const navigateToIndex = useCallback((index: number) => {
    setCurrentPath(prev => prev.slice(0, index + 1))
  }, [])

  const navigateToRoot = useCallback(() => {
    setCurrentPath([])
  }, [])

  // 폴더 생성: files 테이블에 mime_type='folder' 레코드 삽입
  const createFolder = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !user) return
    setError(null)
    try {
      // 중복 확인
      const { data: existing } = await supabase
        .from('files')
        .select('id')
        .eq('project_id', projectId)
        .eq('folder_path', folderPath)
        .eq('original_name', trimmed)
        .eq('mime_type', 'folder')
        .maybeSingle()

      if (existing) { setError('같은 이름의 폴더가 이미 있습니다.'); return }

      const { data, error } = await supabase.from('files').insert([{
        project_id: projectId,
        original_name: trimmed,
        folder_path: folderPath,
        storage_path: '',
        size: 0,
        mime_type: 'folder',
        version: '',
        uploaded_by: user.id,
      }]).select().single()

      if (error) throw error
      setItems(prev => [mapRow(data), ...prev].sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1
        if (!a.isFolder && b.isFolder) return 1
        return a.name.localeCompare(b.name, 'ko')
      }))
    } catch (err) {
      setError(`폴더 생성 실패: ${(err as Error).message}`)
    }
  }, [projectId, folderPath, user])

  // 파일 업로드: Storage는 UUID 경로, DB에 한글 메타데이터 저장
  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!user) { setError('로그인이 필요합니다.'); return }
    setUploading(true)
    setError(null)
    const uploaded: StorageItem[] = []
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop() ?? 'bin'
        const uuid = crypto.randomUUID()
        // Storage 경로: UUID만 사용 (한글 없음)
        const storagePath = `${projectId}/${uuid}.${ext}`

        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { upsert: false })
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
        uploaded.push({ ...mapRow(data), title })
      }
      setItems(prev => [...uploaded, ...prev])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }, [projectId, folderPath, user])

  // 다운로드
  const downloadFile = useCallback(async (item: StorageItem) => {
    if (!item.storagePath) return
    setError(null)
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(item.storagePath)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = item.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(`다운로드 실패: ${(err as Error).message}`)
    }
  }, [])

  // 삭제 (폴더면 하위 항목 포함 재귀 삭제)
  const deleteItem = useCallback(async (item: StorageItem) => {
    setItems(prev => prev.filter(i => i.id !== item.id))
    setError(null)
    try {
      if (item.isFolder) {
        // 하위 폴더 경로 패턴으로 DB 레코드 전체 조회
        const subPath = folderPath ? `${folderPath}/${item.name}` : item.name
        const { data: subFiles } = await supabase
          .from('files')
          .select('id, storage_path, mime_type')
          .eq('project_id', projectId)
          .like('folder_path', `${subPath}%`)

        if (subFiles && subFiles.length > 0) {
          // Storage 파일 삭제
          const storagePaths = subFiles
            .filter(f => f.mime_type !== 'folder' && f.storage_path)
            .map((f: { storage_path: string }) => f.storage_path)
          if (storagePaths.length > 0)
            await supabase.storage.from('documents').remove(storagePaths)
          // DB 레코드 삭제
          const ids = subFiles.map((f: { id: string }) => f.id)
          await supabase.from('files').delete().in('id', ids)
        }
        // 폴더 레코드 자체 삭제
        await supabase.from('files').delete().eq('id', item.id)
      } else {
        if (item.storagePath)
          await supabase.storage.from('documents').remove([item.storagePath])
        await supabase.from('files').delete().eq('id', item.id)
      }
    } catch (err) {
      await fetchItems(folderPath)
      setError(`삭제 실패: ${(err as Error).message}`)
    }
  }, [projectId, folderPath, fetchItems])

  return {
    items, loading, uploading, error,
    currentPath,
    navigateTo, navigateUp, navigateToIndex, navigateToRoot,
    createFolder, uploadFiles, downloadFile, deleteItem,
    refresh: () => fetchItems(folderPath),
  }
}
