import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'n2Hub <noreply@n2soft.co.kr>'
const APP_URL        = Deno.env.get('APP_URL')    ?? 'http://localhost:5173'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, projectName, projectId, inviterName, role } = await req.json()

    if (!to || !projectName || !inviterName) {
      return new Response(
        JSON.stringify({ error: '필수 파라미터가 누락됐습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const roleLabel = role === 'pm' ? 'PM (프로젝트 매니저)' : '멤버'
    const projectUrl = `${APP_URL}/projects/${projectId}`

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- 헤더 -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">n2Hub</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">IT 프로젝트 산출물 통합관리</p>
          </td>
        </tr>

        <!-- 본문 -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              안녕하세요,<br>
              <strong>${inviterName}</strong> 님이 <strong>${projectName}</strong> 프로젝트에 초대했습니다.
            </p>

            <!-- 역할 배지 -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#ede9fe;border-radius:8px;padding:12px 20px;">
                  <p style="margin:0;font-size:12px;color:#7c3aed;font-weight:600;">부여된 역할</p>
                  <p style="margin:4px 0 0;font-size:16px;color:#5b21b6;font-weight:700;">${roleLabel}</p>
                </td>
              </tr>
            </table>

            <!-- CTA 버튼 -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#6366f1;border-radius:8px;">
                  <a href="${projectUrl}"
                     style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">
                    프로젝트 바로가기 →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
              이 이메일은 n2Hub에서 자동 발송됐습니다.<br>
              문의: <a href="mailto:support@n2soft.co.kr" style="color:#6366f1;">support@n2soft.co.kr</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [to],
        subject: `[n2Hub] ${inviterName} 님이 "${projectName}" 프로젝트에 초대했습니다`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Resend API 오류')
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
