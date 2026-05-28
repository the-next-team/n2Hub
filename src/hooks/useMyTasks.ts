import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface MyTask {
  id: string
  project_id: string
  projectName: string
  wbs_code: string
  task_name: string
  end_date: string | null
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  actual_progress: number
  planned_progress: number
}

export function useMyTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetch() {
      setLoading(true)
      try {
        // wbs_tasks → projects join (FK 관계 이용)
        const { data, error } = await supabase
          .from('wbs_tasks')
          .select('id, project_id, wbs_code, task_name, end_date, status, actual_progress, planned_progress, projects(name)')
          .eq('assignee_user_id', user!.id)
          .neq('status', 'completed')
          .order('end_date', { ascending: true, nullsFirst: false })
          .limit(30)

        if (error) throw error

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTasks((data || []).map((row: any) => ({
          ...row,
          projectName: row.projects?.name ?? '—',
        })))
      } catch {
        setTasks([])
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [user])

  const overdue = tasks.filter(t => {
    if (!t.end_date) return false
    return new Date(t.end_date) < new Date(new Date().toDateString())
  })

  const dueSoon = tasks.filter(t => {
    if (!t.end_date) return false
    const days = Math.ceil((new Date(t.end_date).getTime() - Date.now()) / 86_400_000)
    return days >= 0 && days <= 7
  })

  return { tasks, loading, overdue, dueSoon }
}
