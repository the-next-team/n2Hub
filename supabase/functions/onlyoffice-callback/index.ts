/**
 * OnlyOffice Document Server Callback
 *
 * OnlyOffice가 문서 편집 완료 후 이 엔드포인트를 호출합니다.
 * status=2 일 때 편집된 파일을 다운로드하여 Supabase Storage에 저장합니다.
 *
 * 이 주소는 로그인 없이 호출되므로, OnlyOffice 서버가 붙여 보내는 서명(JWT)을
 * 검증해서 우리 문서 서버가 보낸 요청만 처리합니다.
 *
 * 필요한 Secret : ONLYOFFICE_JWT_SECRET (OnlyOffice 서버의 JWT_SECRET 과 같은 값)
 * 참고: https://api.onlyoffice.com/editors/callback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, authorizationjwt, x-client-info, apikey, content-type',
}

const JWT_SECRET = Deno.env.get('ONLYOFFICE_JWT_SECRET') ?? ''

const CONTENT_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc:  'application/msword',
  xls:  'application/vnd.ms-excel',
  ppt:  'application/vnd.ms-powerpoint',
}

// OnlyOffice 는 { "error": 0 } 을 받아야 정상 처리로 간주합니다.
function reply(error: 0 | 1, status = 200) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fromBase64url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** HS256 서명을 검증하고 내용을 돌려줍니다. 서명이 틀리면 null. */
async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, sig] = parts
  try {
    const header = JSON.parse(new TextDecoder().decode(fromBase64url(head)))
    if (header.alg !== 'HS256') return null
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    )
    const ok = await crypto.subtle.verify('HMAC', key, fromBase64url(sig), enc.encode(`${head}.${body}`))
    if (!ok) return null
    return JSON.parse(new TextDecoder().decode(fromBase64url(body)))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const storagePath = url.searchParams.get('path')
    if (!storagePath) return reply(1, 400)

    if (!JWT_SECRET) {
      console.error('[onlyoffice-callback] ONLYOFFICE_JWT_SECRET is not set')
      return reply(1, 500)
    }

    // 서명 검증 : 본문의 token 또는 헤더(AuthorizationJwt / Authorization)
    const rawBody = await req.json()
    const headerToken = (req.headers.get('AuthorizationJwt') ?? req.headers.get('Authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
    const token = typeof rawBody?.token === 'string' ? rawBody.token : headerToken
    const claims = token ? await verifyJwt(token, JWT_SECRET) : null
    if (!claims) {
      console.error('[onlyoffice-callback] invalid or missing signature')
      return reply(1, 401)
    }
    // 헤더로 온 토큰은 내용이 payload 아래에 들어 있습니다.
    const body = (claims.payload ?? claims) as { status?: number; url?: string }

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
    if ((body.status === 2 || body.status === 6) && body.url) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // 파일함에 등록된 경로만 덮어쓸 수 있습니다.
      const { data: file } = await supabase
        .from('files').select('id').eq('storage_path', storagePath).maybeSingle()
      if (!file) {
        console.error('[onlyoffice-callback] unknown storage path:', storagePath)
        return reply(1, 404)
      }

      // 편집된 파일 다운로드
      const fileResp = await fetch(body.url)
      if (!fileResp.ok) {
        console.error('[onlyoffice-callback] failed to fetch edited file:', body.url)
        return reply(1)
      }
      const fileBuffer = await fileResp.arrayBuffer()

      const ext = storagePath.split('.').pop()?.toLowerCase() ?? ''
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
          upsert: true,
        })

      if (uploadErr) {
        console.error('[onlyoffice-callback] upload error:', uploadErr.message)
        return reply(1)
      }

      await supabase.from('files').update({ size: fileBuffer.byteLength }).eq('id', file.id)
      console.log('[onlyoffice-callback] saved:', storagePath)
    }

    return reply(0)
  } catch (err) {
    console.error('[onlyoffice-callback] unexpected error:', err)
    return reply(1, 500)
  }
})
