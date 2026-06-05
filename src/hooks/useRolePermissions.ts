import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { type MemberRole, type MemberPermissions, DEFAULT_PERMISSIONS } from './useMembers'

export type RolePermissionMap = Record<MemberRole, MemberPermissions>

/** 프로젝트의 역할별 권한 조회 및 저장 */
export function useRolePermissions(projectId: string) {
  const [permissions, setPermissions] = useState<RolePermissionMap>({ ...DEFAULT_PERMISSIONS })
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    if (!projectId) return
    supabase.from('projects').select('role_permissions').eq('id', projectId).single()
      .then(({ data }) => {
        if (data?.role_permissions && Object.keys(data.role_permissions).length > 0) {
          // DB 값과 기본값 merge (새로 추가된 권한키 대비)
          const merged: RolePermissionMap = { ...DEFAULT_PERMISSIONS }
          for (const role of Object.keys(merged) as MemberRole[]) {
            if (data.role_permissions[role]) {
              merged[role] = { ...merged[role], ...data.role_permissions[role] }
            }
          }
          setPermissions(merged)
        }
        setLoading(false)
      })
  }, [projectId])

  const save = useCallback(async (next: RolePermissionMap) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('projects')
        .update({ role_permissions: next })
        .eq('id', projectId)
      if (error) throw error
      setPermissions(next)
    } finally { setSaving(false) }
  }, [projectId])

  const toggle = useCallback((role: MemberRole, key: keyof MemberPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] },
    }))
  }, [])

  const resetRole = useCallback((role: MemberRole) => {
    setPermissions(prev => ({ ...prev, [role]: { ...DEFAULT_PERMISSIONS[role] } }))
  }, [])

  return { permissions, loading, saving, save, toggle, resetRole }
}
