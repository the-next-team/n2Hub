import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type MemberRole = 'pm' | 'pl' | 'developer' | 'qa'

export const ROLE_CFG: Record<MemberRole, { label: string; color: string; desc: string }> = {
  pm:        { label: 'PM',    color: 'bg-purple-100 text-purple-700', desc: '프로젝트 매니저' },
  pl:        { label: 'PL',    color: 'bg-blue-100 text-blue-700',     desc: '프로젝트 리더'  },
  developer: { label: '개발자', color: 'bg-emerald-100 text-emerald-700', desc: '개발자'       },
  qa:        { label: 'QA',    color: 'bg-orange-100 text-orange-700', desc: 'QA 엔지니어'   },
}

export const DEV_PARTS = [
  '프론트엔드', '백엔드', 'DB/데이터', '인프라/DevOps',
  '분석/설계', 'UI/UX', 'QA/테스트', '공통', '기타',
]

export interface MemberPermissions {
  canInvite:       boolean   // 멤버 초대
  canRemove:       boolean   // 멤버 삭제
  canEditRole:     boolean   // 역할 변경
  canUpload:       boolean   // 파일 업로드
  canCreateIssue:  boolean   // 이슈 생성
  canEditWBS:      boolean   // WBS 수정
  canEditDoc:      boolean   // 문서 편집
  canViewReport:   boolean   // 보고서 조회
}

export const DEFAULT_PERMISSIONS: Record<MemberRole, MemberPermissions> = {
  pm:        { canInvite: true,  canRemove: true,  canEditRole: true,  canUpload: true,  canCreateIssue: true,  canEditWBS: true,  canEditDoc: true,  canViewReport: true  },
  pl:        { canInvite: true,  canRemove: false, canEditRole: false, canUpload: true,  canCreateIssue: true,  canEditWBS: true,  canEditDoc: true,  canViewReport: true  },
  developer: { canInvite: false, canRemove: false, canEditRole: false, canUpload: true,  canCreateIssue: true,  canEditWBS: true,  canEditDoc: false, canViewReport: false },
  qa:        { canInvite: false, canRemove: false, canEditRole: false, canUpload: false, canCreateIssue: true,  canEditWBS: false, canEditDoc: false, canViewReport: true  },
}

export const PERMISSION_LABELS: { key: keyof MemberPermissions; label: string }[] = [
  { key: 'canInvite',      label: '멤버 초대'    },
  { key: 'canRemove',      label: '멤버 삭제'    },
  { key: 'canEditRole',    label: '역할 변경'    },
  { key: 'canUpload',      label: '파일 업로드'  },
  { key: 'canCreateIssue', label: '이슈 생성'    },
  { key: 'canEditWBS',     label: 'WBS 수정'    },
  { key: 'canEditDoc',     label: '문서 편집'    },
  { key: 'canViewReport',  label: '보고서 조회'  },
]

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: MemberRole
  display_name: string | null
  email: string
  part: string | null
  created_at: string
  // 통계 (조회 후 병합)
  issueCount?: number
  taskCount?: number
  completedTaskCount?: number
}

export function useMembers(projectId: string) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!projectId || projectId === 'none') { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('project_members')
        .select('id, project_id, user_id, role, display_name, part')
        .eq('project_id', projectId)
      if (err) throw err
      if (!rows?.length) { setMembers([]); setLoading(false); return }

      const userIds = rows.map(r => r.user_id)

      // 이메일 조회
      const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds)
      const emailMap: Record<string, string> = {}
      for (const p of profiles ?? []) emailMap[p.id] = p.email

      // 이슈 담당 수
      const { data: issues } = await supabase.from('issues').select('assignee_id').eq('project_id', projectId)
      const issueMap: Record<string, number> = {}
      for (const i of issues ?? []) { if (i.assignee_id) issueMap[i.assignee_id] = (issueMap[i.assignee_id] ?? 0) + 1 }

      // WBS 태스크 담당 수
      const { data: tasks } = await supabase.from('wbs_tasks').select('assignee_id, status').eq('project_id', projectId)
      const taskMap: Record<string, number> = {}
      const doneMap: Record<string, number> = {}
      for (const t of tasks ?? []) {
        if (t.assignee_id) {
          taskMap[t.assignee_id] = (taskMap[t.assignee_id] ?? 0) + 1
          if (t.status === 'completed') doneMap[t.assignee_id] = (doneMap[t.assignee_id] ?? 0) + 1
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMembers(rows.map((r: any) => ({
        id: r.id, project_id: r.project_id, user_id: r.user_id, created_at: '',
        role: (r.role ?? 'developer') as MemberRole,
        display_name: r.display_name, email: emailMap[r.user_id] ?? '',
        part: r.part ?? null,
        issueCount: issueMap[r.user_id] ?? 0,
        taskCount:  taskMap[r.user_id]  ?? 0,
        completedTaskCount: doneMap[r.user_id] ?? 0,
      })))
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { if (projectId) fetchMembers() }, [projectId, fetchMembers])

  const findUserByEmail = useCallback(async (email: string) => {
    const { data } = await supabase.from('profiles').select('id, email, display_name')
      .eq('email', email.trim().toLowerCase()).maybeSingle()
    return data as { id: string; email: string; display_name: string | null } | null
  }, [])

  const searchProfiles = useCallback(async (query: string) => {
    if (query.length < 2) return []
    const { data } = await supabase.from('profiles').select('id, email, display_name')
      .ilike('email', `%${query}%`).limit(6)
    return (data ?? []) as { id: string; email: string; display_name: string | null }[]
  }, [])

  const addMember = useCallback(async (
    userId: string, email: string, role: MemberRole,
    displayName?: string, part?: string,
    inviteOptions?: { projectName: string; inviterName: string },
  ) => {
    setError(null)
    const { error } = await supabase.from('project_members').insert({
      project_id: projectId, user_id: userId, role,
      display_name: displayName || email.split('@')[0],
      part: part || null,
    })
    if (error) {
      if (error.code === '23505') throw new Error('이미 추가된 멤버입니다.')
      throw error
    }
    await fetchMembers()
    if (inviteOptions) {
      supabase.functions.invoke('send-member-invite', { body: { to: email, projectName: inviteOptions.projectName, projectId, inviterName: inviteOptions.inviterName, role } }).catch(() => {})
    }
  }, [projectId, fetchMembers])

  const updateMember = useCallback(async (
    memberId: string,
    patch: { role?: MemberRole; part?: string | null; display_name?: string }
  ) => {
    setError(null)
    const updateData: Record<string, unknown> = {}
    if (patch.role         !== undefined) updateData.role         = patch.role
    if (patch.part         !== undefined) updateData.part         = patch.part
    if (patch.display_name !== undefined) updateData.display_name = patch.display_name
    const { error } = await supabase.from('project_members').update(updateData).eq('id', memberId)
    if (error) throw error
    setMembers(prev => prev.map(m => m.id === memberId ? {
      ...m,
      role:         (patch.role ?? m.role) as MemberRole,
      part:         patch.part !== undefined ? patch.part : m.part,
      display_name: patch.display_name ?? m.display_name,
    } : m))
  }, [])

  // 하위 호환
  const updateRole = useCallback(async (memberId: string, role: MemberRole) => updateMember(memberId, { role }), [updateMember])
  const updateDisplayName = useCallback(async (memberId: string, displayName: string) => updateMember(memberId, { display_name: displayName }), [updateMember])

  const removeMember = useCallback(async (memberId: string) => {
    setError(null)
    const { error } = await supabase.from('project_members').delete().eq('id', memberId)
    if (error) throw error
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }, [])

  const getMyRole = useCallback(async (userId: string): Promise<MemberRole | null> => {
    const { data } = await supabase.from('project_members').select('role')
      .eq('project_id', projectId).eq('user_id', userId).maybeSingle()
    return (data?.role as MemberRole) ?? null
  }, [projectId])

  return {
    members, loading, error, fetchMembers,
    findUserByEmail, searchProfiles,
    addMember, updateMember, updateRole, updateDisplayName, removeMember, getMyRole,
  }
}
