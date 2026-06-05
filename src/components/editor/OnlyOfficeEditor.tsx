import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../lib/auth'

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (
        containerId: string,
        config: Record<string, unknown>,
      ) => { destroyEditor: () => void }
    }
  }
}

interface Props {
  fileId: string
  fileName: string
  signedUrl: string
  storagePath: string
  onClose: () => void
}

const OO_SERVER   = import.meta.env.VITE_ONLYOFFICE_SERVER ?? 'http://211.191.65.29:8090'
const CALLBACK_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onlyoffice-callback`
const CONTAINER_ID = 'onlyoffice-editor-root'

export default function OnlyOfficeEditor({
  fileId,
  fileName,
  signedUrl,
  storagePath,
  onClose,
}: Props) {
  const { user } = useAuth()
  const instanceRef = useRef<{ destroyEditor: () => void } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    let active = true
    setStatus('loading')
    setErrMsg('')

    const init = () => {
      if (!active || !window.DocsAPI) return

      const ext         = fileName.split('.').pop()?.toLowerCase() ?? 'docx'
      const callbackUrl = `${CALLBACK_FN}?path=${encodeURIComponent(storagePath)}`

      try {
        instanceRef.current = new window.DocsAPI.DocEditor(CONTAINER_ID, {
          document: {
            fileType: ext,
            key: `${fileId}-${Date.now()}`,
            title: fileName,
            url: signedUrl,
            permissions: { edit: true, download: true, print: true },
          },
          editorConfig: {
            mode: 'edit',
            callbackUrl,
            lang: 'ko',
            user: {
              id: user?.id ?? 'guest',
              name: user?.email?.split('@')[0] ?? 'User',
            },
            customization: {
              autosave: true,
              forcesave: true,
              logo: { visible: false },
            },
          },
          type: 'desktop',
          height: '100%',
          width: '100%',
          events: {
            onAppReady: () => { if (active) setStatus('ready') },
            onRequestClose: onClose,
            onError: (event: { data: { errorCode: number; errorDescription: string } }) => {
              console.error('[OnlyOffice] error:', event.data)
              if (active) {
                setErrMsg(event.data?.errorDescription ?? '알 수 없는 오류')
                setStatus('error')
              }
            },
          },
        })
      } catch (e) {
        console.error('[OnlyOffice] init failed:', e)
        if (active) {
          setErrMsg((e as Error).message ?? '에디터 초기화 실패')
          setStatus('error')
        }
      }
    }

    const loadScript = () => {
      const scriptId = 'onlyoffice-api-js'
      const existing  = document.getElementById(scriptId) as HTMLScriptElement | null

      if (existing && window.DocsAPI) {
        init()
        return
      }

      if (existing) {
        // 스크립트 태그는 있지만 DocsAPI 미준비 (이전 로드 실패 가능성)
        existing.remove()
      }

      const script  = document.createElement('script')
      script.id     = scriptId
      script.src    = `${OO_SERVER}/web-apps/apps/api/documents/api.js`
      script.onload = init
      script.onerror = () => {
        if (active) {
          setErrMsg(`OnlyOffice 서버(${OO_SERVER})에 접근할 수 없습니다.\n회사 내부망 연결을 확인해주세요.`)
          setStatus('error')
        }
      }
      document.body.appendChild(script)
    }

    loadScript()

    return () => {
      active = false
      instanceRef.current?.destroyEditor()
      instanceRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, signedUrl])

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* 로딩 오버레이 */}
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-gray-500">OnlyOffice 에디터 로딩 중…</p>
        </div>
      )}

      {/* 에러 */}
      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white gap-4 px-6">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-sm text-red-600 text-center whitespace-pre-line max-w-sm">{errMsg}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            뒤로 가기
          </button>
        </div>
      )}

      {/* OnlyOffice 마운트 포인트 — 항상 DOM에 존재해야 함 */}
      <div
        id={CONTAINER_ID}
        style={{ width: '100%', flex: 1 }}
      />
    </div>
  )
}
