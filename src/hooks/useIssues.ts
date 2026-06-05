import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { createNotification } from './useNotifications'

export type IssueType     = 'bug' | 'feature' | 'task' | 'improvement'
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low'
export type IssueStatus   = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface Issue {
  id:            string
  project_id:    string
  title:         string
  description:   string | null
  type:          IssueType
  priority:      IssuePriority
  status:        IssueStatus
  assignee_id:   string | null
  assignee_name: string | null
  reporter_id:   string
  reporter_name: string
  due_date:      string | null
  created_at:    string
  updated_at:    string
}

export type IssuePayload = {
  title:         string
  description?:  string | null
  type:          IssueType
  priority:      IssuePriority
  status:        IssueStatus
  assignee_id?:  string | null
  assignee_name?: string | null
  due_date?:     string | null
}

export function useIssues(projectId: string) {
  const { user } = useAuth()
  const [issues, setIssues]   = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchIssues = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('issues')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (e) throw e
      setIssues(data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { if (projectId) fetchIssues() }, [projectId, fetchIssues])

  const create = useCallback(async (payload: IssuePayload): Promise<Issue> => {
    const displayName =
      user?.user_metadata?.display_name ||
      user?.email?.split('@')[0] ||
      '알 수 없음'
    const { data, error: e } = await supabase
      .from('issues')
      .insert({ project_id: projectId, reporter_id: user?.id, reporter_name: displayName, ...payload })
      .select()
      .single()
    if (e) throw e
    const issue = data as Issue
    setIssues(prev => [issue, ...prev])
    // 담당자에게 알림
    if (payload.assignee_id && payload.assignee_id !== user?.id) {
      createNotification(payload.assignee_id, {
        type: 'issue_assigned', projectId,
        title: `이슈가 배정됐습니다: ${payload.title}`,
        body:  `담당자로 배정되었습니다.`,
        link:  `/projects/${projectId}/issues`,
      }).catch(() => {})
    }
    return issue
  }, [projectId, user])

  const update = useCallback(async (
    id: string,
    patch: Partial<IssuePayload & Pick<Issue, 'status'>>,
  ): Promise<Issue> => {
    const { data, error: e } = await supabase
      .from('issues')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (e) throw e
    setIssues(prev => prev.map(i => i.id === id ? data as Issue : i))
    return data as Issue
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('issues').delete().eq('id', id)
    if (e) throw e
    setIssues(prev => prev.filter(i => i.id !== id))
  }, [])

  return { issues, loading, error, create, update, remove, refetch: fetchIssues }
}
