import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

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
  const [status, setStatus]   = useState<'loading' | 'ready' | 'error'>('loading')
  const [errMsg, setErrMsg]   = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  // ── 브라우저 쪽 저장 처리 ──────────────────────────────────────────────────
  // Supabase 클라우드 Edge Function은 사내 OnlyOffice IP에 접근 불가
  // → 큐(file_save_queue)에 저장된 URL을 브라우저(사내망)가 처리
  const processSaveQueue = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('file_save_queue')
      .select('*')
      .eq('storage_path', storagePath)
      .order('created_at', { ascending: true })

    if (error || !rows || rows.length === 0) return

    setSaveState('saving')
    for (const row of rows) {
      try {
        // OO 임시 URL은 편집 세션 종료 후 만료됨 → 10분 초과시 처리 불가
        const ageMs = row.created_at
          ? Date.now() - new Date(row.created_at).getTime()
          : Infinity
        if (ageMs > 10 * 60 * 1000) {
          await supabase.from('file_save_queue').delete().eq('id', row.id)
          console.warn('[OO Save] expired queue item deleted:', row.id)
          continue
        }

        const fileResp = await fetch(row.oo_url)
        if (!fileResp.ok) throw new Error(`OO fetch failed: ${fileResp.status}`)

        // 만료된 URL이 HTML 오류 페이지를 반환하는 경우 방지
        const respCt = fileResp.headers.get('content-type') ?? ''
        if (respCt.includes('text/html')) {
          throw new Error('OO returned HTML (session expired)')
        }

        const fileBuffer = await fileResp.arrayBuffer()
        if (fileBuffer.byteLength === 0) throw new Error('OO returned empty file')

        const ext = fileName.split('.').pop()?.toLowerCase() ?? 'docx'
        const mimeMap: Record<string, string> = {
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          hwp:  'application/haansofthwp',
          hwpx: 'application/haansofthwp',
        }
        const contentType = mimeMap[ext] ?? 'application/octet-stream'

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, fileBuffer, { contentType, upsert: true })

        if (uploadErr) throw uploadErr

        await supabase.from('file_save_queue').delete().eq('id', row.id)
        console.log('[OO Save] saved via browser:', storagePath)
      } catch (err) {
        console.error('[OO Save] failed for queue row', row.id, err)
        // OO URL은 세션 종료시 만료 → 재시도 불가, 큐에서 제거
        try { await supabase.from('file_save_queue').delete().eq('id', row.id) } catch { /* ignore */ }
      }
    }
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 3000)
  }, [storagePath, fileName])

  // 파일 열릴 때 미처리 큐 체크 + Realtime 구독
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null

    // 1. 열릴 때 이미 대기 중인 항목 즉시 처리
    processSaveQueue()

    // 2. Realtime INSERT 구독 → 즉각 처리
    const channel = supabase
      .channel(`oo-save-${storagePath}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'file_save_queue',
          filter: `storage_path=eq.${storagePath}` },
        () => { processSaveQueue() },
      )
      .subscribe()

    // 3. 폴백 폴링 (Realtime 미작동 대비, 30초마다)
    pollTimer = setInterval(processSaveQueue, 30000)

    return () => {
      supabase.removeChannel(channel)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [storagePath, processSaveQueue])

  // ── OnlyOffice 에디터 초기화 ────────────────────────────────────────────────
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
      if (instanceRef.current) {
        instanceRef.current.destroyEditor()
        instanceRef.current = null
      }
      // OO 스크립트와 전역 상태 제거 → 재오픈 시 충돌 방지
      // SPA 내비게이션으로 컴포넌트가 언마운트/리마운트될 때
      // window.DocsAPI가 남아있으면 새 인스턴스 생성 시 상태 충돌 가능
      const ooScript = document.getElementById('onlyoffice-api-js')
      if (ooScript) ooScript.remove()
      if (window.DocsAPI) delete window.DocsAPI
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, signedUrl])

  // React의 조건부 렌더링({cond && <div>})은 DOM에 노드를 insertBefore로 삽입/제거함.
  // OO가 동일 부모 DOM을 이미 조작한 상태에서 이 작업이 발생하면
  // "insertBefore: not a child of this node" 에러로 React 트리 전체가 크래시됨.
  // → style.display로 show/hide 처리하여 DOM 구조를 고정.
  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* 로딩 오버레이 — 항상 존재, display로 토글 */}
      <div
        style={{ display: status === 'loading' ? 'flex' : 'none' }}
        className="absolute inset-0 z-10 flex-col items-center justify-center bg-white gap-3"
      >
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm text-gray-500">OnlyOffice 에디터 로딩 중…</p>
      </div>

      {/* 에러 오버레이 — 항상 존재, display로 토글 */}
      <div
        style={{ display: status === 'error' ? 'flex' : 'none' }}
        className="absolute inset-0 z-10 flex-col items-center justify-center bg-white gap-4 px-6"
      >
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-sm text-red-600 text-center whitespace-pre-line max-w-sm">{errMsg}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          뒤로 가기
        </button>
      </div>

      {/* 저장 상태 표시 — 항상 존재, display로 토글 */}
      <div
        style={{ display: saveState !== 'idle' ? 'flex' : 'none' }}
        className="absolute top-3 right-3 z-20 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-md bg-white border border-gray-200"
      >
        {saveState === 'saving' ? (
          <>
            <Loader2 size={12} className="animate-spin text-blue-500" />
            <span className="text-gray-600">저장 중...</span>
          </>
        ) : (
          <>
            <CheckCircle2 size={12} className="text-green-500" />
            <span className="text-gray-600">저장 완료</span>
          </>
        )}
      </div>

      {/* OnlyOffice 마운트 포인트 — 항상 DOM에 존재, React가 자식 관리 안 함 */}
      <div
        id={CONTAINER_ID}
        style={{ width: '100%', flex: 1 }}
      />
    </div>
  )
}
