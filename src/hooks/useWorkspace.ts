import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface WorkspaceConfig {
  appName: string
  allowSignup: boolean
  projectCreatePolicy: 'all' | 'admin'
  projectDeletePolicy: 'owner' | 'admin'
}

const DEFAULT_CONFIG: WorkspaceConfig = {
  appName: 'NEXT Hub',
  allowSignup: true,
  projectCreatePolicy: 'all',
  projectDeletePolicy: 'owner',
}

// 훅 인스턴스 간 동기화용 커스텀 이벤트 (관리자 저장 → 사이드바 즉시 반영)
const SYNC_EVENT = 'workspace-config-updated'

/** 전역 워크스페이스 설정 + 현재 사용자의 admin 여부 */
export function useWorkspace() {
  const { user } = useAuth()
  const [config, setConfig]   = useState<WorkspaceConfig>(DEFAULT_CONFIG)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('workspace_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setConfig({
          appName:             data.app_name ?? DEFAULT_CONFIG.appName,
          allowSignup:         data.allow_signup ?? true,
          projectCreatePolicy: data.project_create_policy ?? 'all',
          projectDeletePolicy: data.project_delete_policy ?? 'owner',
        })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return }
    let cancelled = false
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setIsAdmin(data?.role === 'admin') })
    return () => { cancelled = true }
  }, [user?.id])

  // 다른 훅 인스턴스에서 저장 시 동기화
  useEffect(() => {
    const onSync = (e: Event) => setConfig((e as CustomEvent<WorkspaceConfig>).detail)
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [])

  const updateConfig = useCallback(async (patch: Partial<WorkspaceConfig>) => {
    const next = { ...config, ...patch }
    const { error } = await supabase.from('workspace_settings').update({
      app_name:              next.appName,
      allow_signup:          next.allowSignup,
      project_create_policy: next.projectCreatePolicy,
      project_delete_policy: next.projectDeletePolicy,
      updated_at:            new Date().toISOString(),
    }).eq('id', 1)
    if (error) throw new Error(error.message)
    setConfig(next)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }))
  }, [config])

  return { config, isAdmin, loading, updateConfig }
}

/** 사용자 목록 + 역할 관리 (관리자 페이지용) */
export interface WorkspaceUser {
  id: string
  email: string
  display_name: string | null
  role: string
  created_at: string
}

export function useWorkspaceUsers() {
  const [users, setUsers]     = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, created_at')
      .order('created_at', { ascending: true })
    setUsers((data ?? []) as WorkspaceUser[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const updateRole = useCallback(async (userId: string, role: 'admin' | 'user') => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) throw new Error(error.message)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
  }, [])

  return { users, loading, fetchUsers, updateRole }
}
