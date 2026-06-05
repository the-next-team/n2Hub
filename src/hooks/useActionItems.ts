import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { createNotification } from './useNotifications'

export type ActionItemStatus = 'pending' | 'in_progress' | 'completed'

export interface ActionItem {
  id: string
  projectId: string
  title: string
  description: string | null
  assigneeId: string | null
  assigneeName: string | null
  dueDate: string | null
  status: ActionItemStatus
  source: 'manual' | 'meeting'
  meetingDocId: string | null
  issueId: string | null
  createdAt: string
  completedAt: string | null
}

export interface ActionItemPayload {
  title: string
  description?: string
  assigneeId?: string
  assigneeName?: string
  dueDate?: string
  source?: 'manual' | 'meeting'
  meetingDocId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ActionItem {
  return {
    id: r.id, projectId: r.project_id, title: r.title, description: r.description,
    assigneeId: r.assignee_id, assigneeName: r.assignee_name, dueDate: r.due_date,
    status: (r.status ?? 'pending') as ActionItemStatus, source: r.source, meetingDocId: r.meeting_doc_id,
    issueId: r.issue_id, createdAt: r.created_at, completedAt: r.completed_at,
  }
}

export function useActionItems(projectId?: string) {
  const { user } = useAuth()
  const [items, setItems]     = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      let query = supabase.from('action_items').select('*').order('created_at', { ascending: false })
      if (projectId) query = query.eq('project_id', projectId) as typeof query
      const { data } = await query
      setItems((data ?? []).map(mapRow))
    } catch { /* 무시 */ }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetch() }, [fetch])

  // Realtime 제거 (채널 충돌 이슈) → 생성/수정 시 로컬 상태 직접 업데이트로 대체

  const create = useCallback(async (pid: string, payload: ActionItemPayload): Promise<ActionItem> => {
    const { data, error } = await supabase.from('action_items').insert([{
      project_id:    pid,
      title:         payload.title,
      description:   payload.description ?? null,
      assignee_id:   payload.assigneeId ?? null,
      assignee_name: payload.assigneeName ?? null,
      due_date:      payload.dueDate ?? null,
      source:        payload.source ?? 'manual',
      meeting_doc_id: payload.meetingDocId ?? null,
      created_by:    user?.id,
    }]).select().single()
    if (error) throw error
    const item = mapRow(data)
    setItems(prev => [item, ...prev])

    // 담당자 알림
    if (payload.assigneeId && payload.assigneeId !== user?.id) {
      createNotification(payload.assigneeId, {
        type: 'action_item_assigned', projectId: pid,
        title: `액션 아이템이 배정됐습니다`,
        body:  payload.title,
        link:  `/projects/${pid}/action-items`,
      }).catch(() => {})
    }
    return item
  }, [user])

  const update = useCallback(async (id: string, patch: Partial<ActionItemPayload & { status: ActionItemStatus }>) => {
    const dbPatch: Record<string, unknown> = {}
    if (patch.title       !== undefined) dbPatch.title         = patch.title
    if (patch.description !== undefined) dbPatch.description   = patch.description
    if (patch.assigneeId  !== undefined) dbPatch.assignee_id   = patch.assigneeId
    if (patch.assigneeName!== undefined) dbPatch.assignee_name = patch.assigneeName
    if (patch.dueDate     !== undefined) dbPatch.due_date      = patch.dueDate
    if (patch.status      !== undefined) {
      dbPatch.status       = patch.status
      dbPatch.completed_at = patch.status === 'completed' ? new Date().toISOString() : null
    }
    const { data, error } = await supabase.from('action_items').update(dbPatch).eq('id', id).select().single()
    if (error) throw error
    const updated = mapRow(data)
    setItems(prev => prev.map(i => i.id === id ? updated : i))
    return updated
  }, [])

  const remove = useCallback(async (id: string) => {
    await supabase.from('action_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  /** 액션 아이템 → 이슈 생성 */
  const createIssue = useCallback(async (item: ActionItem) => {
    const { data, error } = await supabase.from('issues').insert([{
      project_id:    item.projectId,
      title:         item.title,
      description:   item.description,
      type:          'task',
      priority:      'medium',
      status:        'open',
      assignee_id:   item.assigneeId,
      assignee_name: item.assigneeName,
      due_date:      item.dueDate,
      reporter_id:   user?.id,
      reporter_name: user?.user_metadata?.display_name || user?.email?.split('@')[0],
    }]).select().single()
    if (error) throw error
    // 연결
    await supabase.from('action_items').update({ issue_id: data.id }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, issueId: data.id } : i))

    // 알림
    if (item.assigneeId && item.assigneeId !== user?.id) {
      createNotification(item.assigneeId, {
        type: 'issue_assigned', projectId: item.projectId,
        title: `이슈가 생성됐습니다: ${item.title}`,
        link:  `/projects/${item.projectId}/issues`,
      }).catch(() => {})
    }
    return data
  }, [user])

  /** 내 미완료 액션 아이템 */
  const myPending = items.filter(i => i.assigneeId === user?.id && i.status !== 'completed')

  return { items, loading, myPending, create, update, remove, createIssue, refetch: fetch }
}

/** 회의록에서 액션 아이템 추출 후 일괄 생성 */
export async function createActionItemsFromMeeting(
  projectId: string,
  meetingDocId: string,
  rawItems: { title: string; assigneeName?: string; dueDate?: string }[],
  members: { user_id: string; display_name?: string; email?: string }[],
  createdBy?: string,
): Promise<void> {
  if (!rawItems.length) return
  const rows = rawItems.map(item => {
    const member = members.find(m =>
      (m.display_name || m.email || '').includes(item.assigneeName ?? '') && item.assigneeName
    )
    return {
      project_id:     projectId,
      title:          item.title,
      assignee_id:    member?.user_id ?? null,
      assignee_name:  item.assigneeName ?? null,
      due_date:       item.dueDate ?? null,
      source:         'meeting',
      meeting_doc_id: meetingDocId,
      created_by:     createdBy ?? null,
    }
  })
  await supabase.from('action_items').insert(rows)

  // 알림
  for (const row of rows) {
    if (row.assignee_id && row.assignee_id !== createdBy) {
      createNotification(row.assignee_id, {
        type: 'action_item_assigned', projectId,
        title: `회의록 액션 아이템이 배정됐습니다`,
        body:  row.title,
        link:  `/projects/${projectId}/action-items`,
      }).catch(() => {})
    }
  }
}
