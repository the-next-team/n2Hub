import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type BoardStatus = 'todo' | 'in_progress' | 'done'

export interface SprintItem {
  id: string
  kind: 'task' | 'issue'
  title: string
  status: BoardStatus
  assigneeName: string | null
  priority?: string
  originalStatus: string  // 원본 상태값
}

function taskStatus(s: string): BoardStatus {
  if (s === 'completed') return 'done'
  if (s === 'in_progress') return 'in_progress'
  return 'todo'
}
function issueStatus(s: string): BoardStatus {
  if (s === 'resolved' || s === 'closed') return 'done'
  if (s === 'in_progress') return 'in_progress'
  return 'todo'
}

export function useSprintBoard(sprintId: string | null, projectId: string) {
  const [items, setItems]   = useState<SprintItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!sprintId) { setItems([]); return }
    setLoading(true)
    try {
      const [{ data: tasks }, { data: issues }] = await Promise.all([
        supabase.from('wbs_tasks').select('id, task_name, status, assignee_name')
          .eq('sprint_id', sprintId),
        supabase.from('issues').select('id, title, status, assignee_name, priority')
          .eq('sprint_id', sprintId),
      ])
      const mapped: SprintItem[] = [
        ...(tasks ?? []).map(t => ({
          id: t.id, kind: 'task' as const, title: t.task_name,
          status: taskStatus(t.status), originalStatus: t.status,
          assigneeName: t.assignee_name ?? null,
        })),
        ...(issues ?? []).map(i => ({
          id: i.id, kind: 'issue' as const, title: i.title,
          status: issueStatus(i.status), originalStatus: i.status,
          assigneeName: i.assignee_name ?? null, priority: i.priority,
        })),
      ]
      setItems(mapped)
    } finally { setLoading(false) }
  }, [sprintId])

  useEffect(() => { fetch() }, [fetch])

  const moveItem = useCallback(async (item: SprintItem, newBoardStatus: BoardStatus) => {
    // board 상태 → 원본 상태 매핑
    const taskMap: Record<BoardStatus, string> = { todo: 'not_started', in_progress: 'in_progress', done: 'completed' }
    const issueMap: Record<BoardStatus, string> = { todo: 'open', in_progress: 'in_progress', done: 'resolved' }

    const newStatus = item.kind === 'task' ? taskMap[newBoardStatus] : issueMap[newBoardStatus]
    const table     = item.kind === 'task' ? 'wbs_tasks' : 'issues'
    const field     = item.kind === 'task' ? 'status'    : 'status'

    await supabase.from(table).update({ [field]: newStatus }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newBoardStatus, originalStatus: newStatus } : i))
  }, [])

  // 번다운용 통계
  const total     = items.length
  const done      = items.filter(i => i.status === 'done').length
  const remaining = total - done

  return { items, loading, moveItem, total, done, remaining, refetch: fetch }
}

// 프로젝트 내 스프린트 미배정 태스크·이슈 조회 (백로그)
export async function fetchBacklog(projectId: string, sprintId: string) {
  const [{ data: tasks }, { data: issues }] = await Promise.all([
    supabase.from('wbs_tasks').select('id, task_name, status, assignee_name')
      .eq('project_id', projectId).is('sprint_id', null),
    supabase.from('issues').select('id, title, status, assignee_name, priority')
      .eq('project_id', projectId).is('sprint_id', null)
      .neq('status', 'closed'),
  ])
  return {
    tasks:  (tasks  ?? []).map(t => ({ id: t.id, kind: 'task'  as const, title: t.task_name, assigneeName: t.assignee_name })),
    issues: (issues ?? []).map(i => ({ id: i.id, kind: 'issue' as const, title: i.title,     assigneeName: i.assignee_name, priority: i.priority })),
  }
}

export async function assignToSprint(kind: 'task' | 'issue', id: string, sprintId: string | null) {
  const table = kind === 'task' ? 'wbs_tasks' : 'issues'
  await supabase.from(table).update({ sprint_id: sprintId }).eq('id', id)
}
