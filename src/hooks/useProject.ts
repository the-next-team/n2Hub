import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Project } from '../types'

type CreateProjectInput = {
  name: string
  description: string
  clientName: string
  startDate: string
  endDate: string
  systemCode: string
  systemName: string
  themeColor: string | null
}

type UpdateProjectInput = Partial<CreateProjectInput> & { logoUrl?: string | null; coverConfig?: Record<string, unknown> | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any): Project {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description || '',
    clientName:  row.client_name || '',
    startDate:   row.start_date || '',
    endDate:     row.end_date || '',
    status:      row.status,
    createdBy:   row.created_by || '',
    createdAt:   row.created_at,
    systemCode:  row.system_code || null,
    systemName:  row.system_name || null,
    logoUrl:     row.logo_url || null,
    themeColor:  row.theme_color || null,
    coverConfig: row.cover_config ?? null,
  }
}

export function useProjects() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<Error | null>(null)

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects').select('*').order('created_at', { ascending: false })
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
        name:         input.name,
        description:  input.description || null,
        client_name:  input.clientName || null,
        start_date:   input.startDate || null,
        end_date:     input.endDate || null,
        system_code:  input.systemCode || null,
        system_name:  input.systemName || null,
        theme_color:  input.themeColor || null,
        created_by:   user?.id,
      }])
      .select().single()
    if (error) throw error
    const project = mapProject(data)
    setProjects(prev => [project, ...prev])
    return project
  }

  async function updateProject(id: string, input: UpdateProjectInput): Promise<void> {
    const patch: Record<string, unknown> = {}
    if (input.name        !== undefined) patch.name        = input.name
    if (input.description !== undefined) patch.description = input.description || null
    if (input.clientName  !== undefined) patch.client_name = input.clientName  || null
    if (input.startDate   !== undefined) patch.start_date  = input.startDate   || null
    if (input.endDate     !== undefined) patch.end_date    = input.endDate     || null
    if (input.systemCode  !== undefined) patch.system_code = input.systemCode  || null
    if (input.systemName  !== undefined) patch.system_name = input.systemName  || null
    if (input.themeColor  !== undefined) patch.theme_color = input.themeColor  || null
    if (input.logoUrl     !== undefined) patch.logo_url    = input.logoUrl     || null
    if (input.coverConfig !== undefined) patch.cover_config = input.coverConfig ?? null

    const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single()
    if (error) throw error
    setProjects(prev => prev.map(p => p.id === id ? mapProject(data) : p))
  }

  return { projects, loading, error, createProject, updateProject, refetch: fetchProjects }
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
