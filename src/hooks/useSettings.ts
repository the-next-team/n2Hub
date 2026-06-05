import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export type CoverStyle = 'minimal' | 'formal' | 'branded'

export type Align = 'left' | 'center' | 'right'

export interface CoverConfig {
  layout:       'centered' | 'sidebar' | 'header'
  accentColor:  string
  showCode:     boolean
  showVersion:  boolean
  showDivider:  boolean
  showDate:     boolean
  showClientLogo:    boolean
  showClientName:    boolean
  showPerformerLogo: boolean
  showPerformerName: boolean
  // 섹션별 정렬
  alignTop:    Align   // 고객사(상단)
  alignTitle:  Align   // 제목(중앙)
  alignBottom: Align   // 수행사(하단)
}

export const DEFAULT_COVER_CONFIG: CoverConfig = {
  layout:            'centered',
  accentColor:       '#111827',
  showCode:          true,
  showVersion:       true,
  showDivider:       true,
  showDate:          true,
  showClientLogo:    true,
  showClientName:    true,
  showPerformerLogo: true,
  showPerformerName: true,
  alignTop:    'center',
  alignTitle:  'center',
  alignBottom: 'center',
}

export interface WorkspaceSettings {
  companyName: string
  logoPath: string
  logoUrl: string
  footerText: string
  coverStyle: CoverStyle
  coverConfig: CoverConfig
}

const EMPTY: WorkspaceSettings = {
  companyName: '',
  logoPath: '',
  logoUrl: '',
  footerText: '',
  coverStyle: 'formal',
  coverConfig: DEFAULT_COVER_CONFIG,
}

export function useSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<WorkspaceSettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 공개 URL 반환 (logos 버킷은 public → 만료 없음)
  const resolveLogoUrl = useCallback((path: string): string => {
    if (!path) return ''
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    return data?.publicUrl ?? ''
  }, [])

  // 사용자 메타데이터에서 설정 읽기
  useEffect(() => {
    if (!user) { setLoading(false); return }
    const meta = user.user_metadata ?? {}
    const logoPath = meta.company_logo_path ?? ''

    const logoUrl = resolveLogoUrl(logoPath)
    let coverConfig: CoverConfig = DEFAULT_COVER_CONFIG
    try {
      if (meta.cover_config) coverConfig = { ...DEFAULT_COVER_CONFIG, ...JSON.parse(meta.cover_config) }
    } catch { /* 무시 */ }
    setSettings({
      companyName: meta.company_name ?? '',
      logoPath,
      logoUrl,
      footerText:  meta.footer_text ?? '',
      coverStyle:  (meta.cover_style as CoverStyle) ?? 'formal',
      coverConfig,
    })
    setLoading(false)
  }, [user, resolveLogoUrl])

  // 저장 (로고 제외 텍스트만)
  const saveSettings = useCallback(async (values: Pick<WorkspaceSettings, 'companyName' | 'footerText' | 'coverStyle' | 'coverConfig'>) => {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          company_name: values.companyName,
          footer_text:  values.footerText,
          cover_style:  values.coverStyle,
          cover_config: JSON.stringify(values.coverConfig),
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
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${user.id}.${ext}`   // logos 버킷 내 경로

    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) throw upErr

    const { error: metaErr } = await supabase.auth.updateUser({
      data: { company_logo_path: path },
    })
    if (metaErr) throw metaErr

    const logoUrl = resolveLogoUrl(path)
    setSettings(prev => ({ ...prev, logoPath: path, logoUrl }))
    return logoUrl
  }, [user, resolveLogoUrl])

  // 로고 삭제
  const removeLogo = useCallback(async () => {
    if (!user || !settings.logoPath) return
    await supabase.storage.from('logos').remove([settings.logoPath])
    await supabase.auth.updateUser({ data: { company_logo_path: '' } })
    setSettings(prev => ({ ...prev, logoPath: '', logoUrl: '' }))
  }, [user, settings.logoPath])

  return { settings, loading, saving, error, saveSettings, uploadLogo, removeLogo }
}
