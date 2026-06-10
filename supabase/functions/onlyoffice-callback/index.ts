/**
 * OnlyOffice Document Server Callback
 *
 * OnlyOffice가 문서 편집 완료(status=2/6) 후 이 엔드포인트를 호출합니다.
 * ⚠️ Supabase 클라우드에서 사내 OnlyOffice 서버(로컬 IP)로 직접 접근 불가
 *    → 편집 파일 URL을 file_save_queue 테이블에 저장만 하고,
 *      브라우저(사내망)가 OnlyOffice에서 직접 내려받아 Storage에 업로드합니다.
 *
 * 참고: https://api.onlyoffice.com/editors/callback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ok = () =>
    new Response(JSON.stringify({ error: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const fail = (msg: string, status = 500) => {
    console.error('[onlyoffice-callback]', msg)
    return new Response(JSON.stringify({ error: 1 }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = new URL(req.url)
    const storagePath = url.searchParams.get('path')
    if (!storagePath) return fail('missing path', 400)

    const body = await req.json()
    console.log('[onlyoffice-callback] status:', body.status, 'path:', storagePath)

    /**
     * status=2: 편집 완료(저장 준비됨)  ← 실제 파일 저장 필요
     * status=6: 강제저장 완료           ← 실제 파일 저장 필요
     * status=1: 편집 중                 ← 무시
     * status=4: 변경 없이 닫힘          ← 무시
     */
    if (body.status === 2 || body.status === 6) {
      if (!body.url) return fail('body.url missing')

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // 브라우저(사내망)가 처리할 수 있도록 큐에 저장
      // Edge Function(클라우드)은 로컬 OnlyOffice IP에 직접 접근 불가
      const { error } = await supabase
        .from('file_save_queue')
        .insert({ storage_path: storagePath, oo_url: body.url })

      if (error) return fail('queue insert failed: ' + error.message)

      console.log('[onlyoffice-callback] queued for browser save:', storagePath)
    }

    // OnlyOffice는 반드시 { "error": 0 } 을 받아야 정상 처리로 간주
    return ok()
  } catch (err) {
    return fail('unexpected: ' + String(err))
  }
})
