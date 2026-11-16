/**
 * OnlyOffice 편집기 설정 서명
 *
 * 브라우저가 편집기를 열기 전에 호출합니다. 로그인한 사용자가 해당 파일의
 * 프로젝트 멤버인지 확인한 뒤, 편집기 설정에 서명(JWT)을 붙여 돌려줍니다.
 * 서명 비밀값은 서버(Secrets)에만 있고 브라우저로 나가지 않습니다.
 *
 * 필요한 Secret : ONLYOFFICE_JWT_SECRET (OnlyOffice 서버의 JWT_SECRET 과 같은 값)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const JWT_SECRET   = Deno.env.get('ONLYOFFICE_JWT_SECRET') ?? ''

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signJwt(payload: unknown, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const head = base64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64url(enc.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${body}`))
  return `${head}.${body}.${base64url(new Uint8Array(sig))}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!JWT_SECRET) return json({ error: 'ONLYOFFICE_JWT_SECRET 이 등록되지 않았습니다.' }, 500)

    // 1) 로그인 사용자 확인
    const accessToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: userData, error: userErr } = await admin.auth.getUser(accessToken)
    const user = userData?.user
    if (userErr || !user) return json({ error: '로그인이 필요합니다.' }, 401)

    const { storagePath, config } = await req.json()
    if (!storagePath || !config?.document || !config?.editorConfig) {
      return json({ error: '필수 파라미터가 누락됐습니다.' }, 400)
    }

    // 2) 파일이 실제로 있고, 사용자가 그 프로젝트의 멤버인지 확인
    const { data: file } = await admin
      .from('files').select('project_id').eq('storage_path', storagePath).maybeSingle()
    if (!file) return json({ error: '파일을 찾을 수 없습니다.' }, 404)

    const { data: member } = await admin
      .from('project_members').select('id')
      .eq('project_id', file.project_id).eq('user_id', user.id).maybeSingle()
    if (!member) return json({ error: '이 파일에 대한 권한이 없습니다.' }, 403)

    // 3) 저장 주소와 사용자 ID 는 서버에서 정한 값으로 고정한 뒤 서명
    const signedConfig = {
      ...config,
      editorConfig: {
        ...config.editorConfig,
        callbackUrl: `${SUPABASE_URL}/functions/v1/onlyoffice-callback?path=${encodeURIComponent(storagePath)}`,
        user: { ...(config.editorConfig.user ?? {}), id: user.id },
      },
    }
    const token = await signJwt(signedConfig, JWT_SECRET)

    return json({ config: { ...signedConfig, token } })
  } catch (err) {
    console.error('[onlyoffice-sign] unexpected error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})
