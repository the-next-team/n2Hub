import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'pm' | 'member'
  display_name: string | null
  email: string
  created_at: string
}

export function useMembers(projectId: string) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1) project_members 조회
      const { data: memberRows, error: memberErr } = await supabase
        .from('project_members')
        .select('id, project_id, user_id, role, display_name, created_at')
        .eq('project_id', projectId)
        .order('created_at')
      if (memberErr) throw memberErr

      const rows = memberRows ?? []
      if (rows.length === 0) { setMembers([]); return }

      // 2) profiles에서 이메일 별도 조회 (FK 관계 불필요)
      const userIds = rows.map(r => r.user_id)
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      const emailMap: Record<string, string> = {}
      for (const p of profileRows ?? []) emailMap[p.id] = p.email

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMembers(rows.map((r: any) => ({
        id: r.id,
        project_id: r.project_id,
        user_id: r.user_id,
        role: r.role,
        display_name: r.display_name,
        email: emailMap[r.user_id] ?? '',
        created_at: r.created_at,
      })))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { if (projectId) fetchMembers() }, [projectId, fetchMembers])

  /** 이메일로 유저 검색 */
  const findUserByEmail = useCallback(async (email: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()
    if (error) throw error
    return data as { id: string; email: string; display_name: string | null } | null
  }, [])

  /** 멤버 추가 */
  const addMember = useCallback(async (
    userId: string,
    email: string,
    role: 'pm' | 'member',
    displayName?: string,
  ) => {
    setError(null)
    const { error } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: userId,
      role,
      display_name: displayName || email.split('@')[0],
    })
    if (error) {
      if (error.code === '23505') throw new Error('이미 추가된 멤버입니다.')
      throw error
    }
    await fetchMembers()
  }, [projectId, fetchMembers])

  /** 역할 변경 */
  const updateRole = useCallback(async (memberId: string, role: 'pm' | 'member') => {
    setError(null)
    const { error } = await supabase
      .from('project_members')
      .update({ role })
      .eq('id', memberId)
    if (error) throw error
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
  }, [])

  /** 멤버 제거 */
  const removeMember = useCallback(async (memberId: string) => {
    setError(null)
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId)
    if (error) throw error
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }, [])

  /** 현재 유저의 역할 조회 */
  const getMyRole = useCallback(async (userId: string): Promise<'pm' | 'member' | null> => {
    const { data } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle()
    return (data?.role as 'pm' | 'member') ?? null
  }, [projectId])

  return {
    members, loading, error,
    fetchMembers, findUserByEmail,
    addMember, updateRole, removeMember, getMyRole,
  }
}
