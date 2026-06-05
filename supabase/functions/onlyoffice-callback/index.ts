/**
 * OnlyOffice Document Server Callback
 *
 * OnlyOffice가 문서 편집 완료 후 이 엔드포인트를 호출합니다.
 * status=2 일 때 편집된 파일을 다운로드하여 Supabase Storage에 저장합니다.
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

  try {
    const url = new URL(req.url)
    const storagePath = url.searchParams.get('path')

    if (!storagePath) {
      return new Response(JSON.stringify({ error: 1 }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    console.log('[onlyoffice-callback] status:', body.status, 'path:', storagePath)

    /**
     * OnlyOffice callback status codes:
     *  0 - no document with the key identifier could be found
     *  1 - document is being edited
     *  2 - document is ready for saving ← 여기서 실제 저장
     *  3 - document saving error has occurred
     *  4 - document is closed with no changes
     *  6 - document is being edited, but the current document state is saved
     *  7 - error has occurred while force saving the document
     */
    if (body.status === 2 || body.status === 6) {
      // 편집된 파일 다운로드
      const fileResp = await fetch(body.url)
      if (!fileResp.ok) {
        console.error('[onlyoffice-callback] failed to fetch edited file:', body.url)
        return new Response(JSON.stringify({ error: 1 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const fileBuffer = await fileResp.arrayBuffer()

      // Supabase Storage에 저장
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })

      if (uploadErr) {
        console.error('[onlyoffice-callback] upload error:', uploadErr.message)
        return new Response(JSON.stringify({ error: 1 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('[onlyoffice-callback] saved:', storagePath)
    }

    // OnlyOffice는 반드시 { "error": 0 } 을 받아야 정상 처리로 간주
    return new Response(JSON.stringify({ error: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[onlyoffice-callback] unexpected error:', err)
    return new Response(JSON.stringify({ error: 1 }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
