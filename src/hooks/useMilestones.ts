import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Milestone {
  id: string
  project_id: string
  name: string
  due_date: string | null          // YYYY-MM-DD
  status: 'planned' | 'done' | 'missed'
  created_at: string
}

export function useMilestones(projectId: string) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      setMilestones((data ?? []) as Milestone[])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { if (projectId) fetch() }, [projectId, fetch])

  const create = useCallback(async (
    name: string,
    due_date: string | null,
  ): Promise<void> => {
    setError(null)
    try {
      const { data, error } = await supabase
        .from('milestones')
        .insert([{ project_id: projectId, name: name.trim(), due_date, status: 'planned' }])
        .select()
        .single()
      if (error) throw error
      setMilestones(prev =>
        [...prev, data as Milestone].sort((a, b) =>
          (a.due_date ?? '').localeCompare(b.due_date ?? ''),
        ),
      )
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }, [projectId])

  const update = useCallback(async (
    id: string,
    changes: Partial<Pick<Milestone, 'name' | 'due_date' | 'status'>>,
  ): Promise<void> => {
    setError(null)
    try {
      const { data, error } = await supabase
        .from('milestones')
        .update(changes)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      setMilestones(prev =>
        prev.map(m => m.id === id ? { ...m, ...(data as Milestone) } : m),
      )
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    setMilestones(prev => prev.filter(m => m.id !== id))
    await supabase.from('milestones').delete().eq('id', id)
  }, [])

  return { milestones, loading, error, create, update, remove, refresh: fetch }
}
