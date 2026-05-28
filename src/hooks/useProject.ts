import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Project } from '../types'

type CreateProjectInput = {
  name: string
  description: string
  clientName: string
  startDate: string
  endDate: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    clientName: row.client_name || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    status: row.status,
    createdBy: row.created_by || '',
    createdAt: row.created_at,
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProjects((data || []).map(mapProject))
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }

  async function createProject(input: CreateProjectInput): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: input.name,
        description: input.description || null,
        client_name: input.clientName || null,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        created_by: user?.id,
      }])
      .select()
      .single()
    if (error) throw error
    const project = mapProject(data)
    setProjects(prev => [project, ...prev])
    return project
  }

  return { projects, loading, error, createProject, refetch: fetchProjects }
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setProject(mapProject(data))
      setLoading(false)
    })
  }, [id])

  return { project, loading }
}
