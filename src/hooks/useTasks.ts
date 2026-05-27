import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { WbsTask } from '../utils/wbsParser'

export interface Task {
  id: string
  project_id: string
  wbs_code: string
  wbs_level: number
  task_name: string
  start_date: string | null
  end_date: string | null
  planned_progress: number
  actual_progress: number
  assignee_name: string | null
  assignee_user_id: string | null
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  notes: string | null
  created_at: string
  updated_at: string
}

export type TaskUpdate = Partial<Pick<Task,
  'actual_progress' | 'planned_progress' | 'assignee_name' | 'assignee_user_id' |
  'status' | 'notes' | 'start_date' | 'end_date'
>>

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('wbs_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('wbs_code')
      if (error) throw error
      setTasks(data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) fetchTasks()
  }, [projectId, fetchTasks])

  /** WBS 파싱 결과로 기존 작업 전체 교체 */
  const importTasks = useCallback(async (rawTasks: WbsTask[]) => {
    setImporting(true)
    setError(null)
    try {
      // 기존 태스크 삭제
      const { error: delErr } = await supabase
        .from('wbs_tasks')
        .delete()
        .eq('project_id', projectId)
      if (delErr) throw delErr

      if (rawTasks.length === 0) {
        setTasks([])
        return
      }

      // 새 태스크 일괄 삽입
      const rows = rawTasks.map(t => ({ ...t, project_id: projectId }))
      const { error: insErr } = await supabase.from('wbs_tasks').insert(rows)
      if (insErr) throw insErr

      await fetchTasks()
    } catch (err) {
      setError(`가져오기 실패: ${(err as Error).message}`)
      throw err
    } finally {
      setImporting(false)
    }
  }, [projectId, fetchTasks])

  /** 단일 작업 업데이트 */
  const updateTask = useCallback(async (id: string, changes: TaskUpdate) => {
    setError(null)
    try {
      const { data, error } = await supabase
        .from('wbs_tasks')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      setTasks(prev => prev.map(t => t.id === id ? (data as Task) : t))
    } catch (err) {
      setError(`업데이트 실패: ${(err as Error).message}`)
    }
  }, [])

  return {
    tasks, loading, importing, error,
    fetchTasks, importTasks, updateTask,
  }
}
