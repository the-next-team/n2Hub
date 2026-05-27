import { useState, useCallback, useRef, useEffect } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const POLL_MS = 30_000 // 30초마다 변경 감지

// GIS 스크립트 싱글톤 로더
let gisLoaded = false
let gisLoadPromise: Promise<void> | null = null

function ensureGIS(): Promise<void> {
  if (gisLoaded) return Promise.resolve()
  if (gisLoadPromise) return gisLoadPromise
  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      if (window.google?.accounts?.oauth2) { gisLoaded = true; resolve(); return }
      existing.addEventListener('load', () => { gisLoaded = true; resolve() })
      existing.addEventListener('error', () => reject(new Error('Google API 로딩 실패')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => { gisLoaded = true; resolve() }
    script.onerror = () => reject(new Error('Google API 로딩 실패'))
    document.head.appendChild(script)
  })
  return gisLoadPromise
}

function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error_description ?? resp.error))
        else resolve(resp.access_token)
      },
      error_callback: (err) => reject(new Error(String(err))),
    })
    client.requestAccessToken()
  })
}

const MIME = {
  docx: {
    source: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    googleApp: 'application/vnd.google-apps.document',
    export: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  xlsx: {
    source: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    googleApp: 'application/vnd.google-apps.spreadsheet',
    export: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
} as const

export type DriveFileType = keyof typeof MIME

export function useGoogleDrive() {
  const [working, setWorking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [driveFileId, setDriveFileId] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  // 폴링 클로저 안에서 최신 값을 참조하기 위한 refs
  const tokenRef = useRef<string | null>(null)
  const fileIdRef = useRef<string | null>(null)
  const typeRef = useRef<DriveFileType | null>(null)
  const onSaveRef = useRef<((buf: ArrayBuffer) => Promise<void>) | null>(null)
  const lastModifiedRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopSync = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setAutoSync(false)
  }, [])

  // 컴포넌트 언마운트 시 폴링 정지
  useEffect(() => () => stopSync(), [stopSync])

  const getToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) return tokenRef.current
    await ensureGIS()
    const t = await requestAccessToken()
    tokenRef.current = t
    // 55분 후 자동 만료
    setTimeout(() => { tokenRef.current = null }, 55 * 60 * 1000)
    return t
  }, [])

  // 1회 폴링: modifiedTime 비교 → 변경 감지 시 내보내기 + Supabase 저장
  const pollOnce = useCallback(async () => {
    const fileId = fileIdRef.current
    const token = tokenRef.current
    const onSave = onSaveRef.current
    const type = typeRef.current
    if (!fileId || !token || !onSave || !type) return

    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (metaRes.status === 401) {
        tokenRef.current = null
        stopSync()
        setError('Google 인증이 만료됐습니다. 다시 "편집" 버튼을 눌러주세요.')
        return
      }
      if (!metaRes.ok) return

      const { modifiedTime } = await metaRes.json() as { modifiedTime: string }
      if (modifiedTime === lastModifiedRef.current) return // 변경 없음

      // 변경 감지!
      lastModifiedRef.current = modifiedTime
      setSyncing(true)

      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(MIME[type].export)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!exportRes.ok) { setSyncing(false); return }

      const buf = await exportRes.arrayBuffer()
      await onSave(buf)
      setLastSynced(new Date())
    } catch (err) {
      console.error('Auto sync error:', err)
    } finally {
      setSyncing(false)
    }
  }, [stopSync])

  /** Google Drive에 업로드 → Google Docs/Sheets 열기 → 자동 동기화 시작 */
  const openInGoogle = useCallback(async (
    buffer: ArrayBuffer,
    fileName: string,
    type: DriveFileType,
    onSave: (buf: ArrayBuffer) => Promise<void>,
  ) => {
    setWorking(true)
    setError(null)
    try {
      const token = await getToken()
      const mime = MIME[type]

      const metadata = { name: fileName, mimeType: mime.googleApp }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file', new Blob([buffer], { type: mime.source }))

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,modifiedTime',
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Drive 업로드 실패 (${res.status}): ${body}`)
      }

      const file = await res.json() as { id: string; webViewLink: string; modifiedTime: string }

      // refs 초기화
      fileIdRef.current = file.id
      tokenRef.current = token
      typeRef.current = type
      onSaveRef.current = onSave
      lastModifiedRef.current = file.modifiedTime

      setDriveFileId(file.id)
      setLastSynced(null)

      // 자동 동기화 시작 (30초 간격)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(pollOnce, POLL_MS)
      setAutoSync(true)

      window.open(file.webViewLink, '_blank', 'noopener')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setWorking(false)
    }
  }, [getToken, pollOnce])

  /** 즉시 수동 동기화 */
  const syncNow = useCallback(() => pollOnce(), [pollOnce])

  return {
    working, syncing, error,
    driveFileId, autoSync, lastSynced,
    openInGoogle, syncNow, stopSync,
  }
}
