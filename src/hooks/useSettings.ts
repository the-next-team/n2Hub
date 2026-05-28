import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface WorkspaceSettings {
  companyName: string
  logoPath: string       // storage path (e.g. "logos/uuid.png")
  logoUrl: string        // 서명된 URL (표시용, 임시)
  footerText: string
}

const EMPTY: WorkspaceSettings = {
  companyName: '',
  logoPath: '',
  logoUrl: '',
  footerText: '',
}

export function useSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<WorkspaceSettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 서명 URL 생성 (logoPath → 1시간 유효)
  const resolveLogoUrl = useCallback(async (path: string): Promise<string> => {
    if (!path) return ''
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 3600)
      return data?.signedUrl ?? ''
    } catch {
      return ''
    }
  }, [])

  // 사용자 메타데이터에서 설정 읽기
  useEffect(() => {
    if (!user) { setLoading(false); return }
    const meta = user.user_metadata ?? {}
    const logoPath = meta.company_logo_path ?? ''

    resolveLogoUrl(logoPath).then(logoUrl => {
      setSettings({
        companyName: meta.company_name ?? '',
        logoPath,
        logoUrl,
        footerText: meta.footer_text ?? '',
      })
      setLoading(false)
    })
  }, [user, resolveLogoUrl])

  // 저장 (로고 제외 텍스트만)
  const saveSettings = useCallback(async (values: Pick<WorkspaceSettings, 'companyName' | 'footerText'>) => {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          company_name: values.companyName,
          footer_text: values.footerText,
        },
      })
      if (error) throw error
      setSettings(prev => ({ ...prev, ...values }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }, [])

  // 로고 업로드 → Storage 저장 → 메타데이터 갱신
  const uploadLogo = useCallback(async (file: File): Promise<string> => {
    if (!user) throw new Error('로그인이 필요합니다')
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `logos/${user.id}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) throw upErr

    const { error: metaErr } = await supabase.auth.updateUser({
      data: { company_logo_path: path },
    })
    if (metaErr) throw metaErr

    const logoUrl = await resolveLogoUrl(path)
    setSettings(prev => ({ ...prev, logoPath: path, logoUrl }))
    return logoUrl
  }, [user, resolveLogoUrl])

  // 로고 삭제
  const removeLogo = useCallback(async () => {
    if (!user || !settings.logoPath) return
    await supabase.storage.from('documents').remove([settings.logoPath])
    await supabase.auth.updateUser({ data: { company_logo_path: '' } })
    setSettings(prev => ({ ...prev, logoPath: '', logoUrl: '' }))
  }, [user, settings.logoPath])

  return { settings, loading, saving, error, saveSettings, uploadLogo, removeLogo }
}
