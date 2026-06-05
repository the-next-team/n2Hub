import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export type SprintStatus = 'planning' | 'active' | 'completed'

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  status: SprintStatus
  createdAt: string
}

export interface SprintPayload {
  name: string
  goal?: string
  startDate?: string
  endDate?: string
  status?: SprintStatus
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSprint(r: any): Sprint {
  return { id: r.id, projectId: r.project_id, name: r.name, goal: r.goal, startDate: r.start_date, endDate: r.end_date, status: r.status, createdAt: r.created_at }
}

export function useSprints(projectId: string) {
  const { user } = useAuth()
  const [sprints, setSprints]   = useState<Sprint[]>([])
  const [loading, setLoading]   = useState(true)

  const fetch = useCallback(async () => {
    if (!projectId) return
    const { data } = await supabase.from('sprints').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    setSprints((data ?? []).map(mapSprint))
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetch() }, [fetch])

  const create = useCallback(async (payload: SprintPayload): Promise<Sprint> => {
    const { data, error } = await supabase.from('sprints').insert([{
      project_id: projectId,
      name:       payload.name,
      goal:       payload.goal ?? null,
      start_date: payload.startDate ?? null,
      end_date:   payload.endDate ?? null,
      status:     payload.status ?? 'planning',
      created_by: user?.id,
    }]).select().single()
    if (error) throw error
    const s = mapSprint(data)
    setSprints(prev => [s, ...prev])
    return s
  }, [projectId, user])

  const update = useCallback(async (id: string, payload: Partial<SprintPayload>): Promise<void> => {
    const patch: Record<string, unknown> = {}
    if (payload.name      !== undefined) patch.name       = payload.name
    if (payload.goal      !== undefined) patch.goal       = payload.goal
    if (payload.startDate !== undefined) patch.start_date = payload.startDate
    if (payload.endDate   !== undefined) patch.end_date   = payload.endDate
    if (payload.status    !== undefined) patch.status     = payload.status
    const { data, error } = await supabase.from('sprints').update(patch).eq('id', id).select().single()
    if (error) throw error
    setSprints(prev => prev.map(s => s.id === id ? mapSprint(data) : s))
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    await supabase.from('sprints').delete().eq('id', id)
    setSprints(prev => prev.filter(s => s.id !== id))
  }, [])

  const active = sprints.find(s => s.status === 'active') ?? null

  return { sprints, loading, active, create, update, remove, refetch: fetch }
}
