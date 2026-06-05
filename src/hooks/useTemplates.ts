import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface Template {
  id:           string
  name:         string
  description:  string | null
  category:     string
  content_text: string | null
  is_public:    boolean
  created_by:   string
  created_at:   string
}

export type TemplatePayload = {
  name:         string
  description?: string | null
  category:     string
  content_text?: string | null
  is_public?:   boolean
}

export function useTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: e } = await supabase
        .from('templates')
        .select('*')
        .order('category')
        .order('name')
      if (e) throw e
      setTemplates(data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = useCallback(async (payload: TemplatePayload): Promise<Template> => {
    const { data, error: e } = await supabase
      .from('templates')
      .insert({ ...payload, created_by: user?.id })
      .select().single()
    if (e) throw e
    setTemplates(prev => [...prev, data as Template].sort((a, b) => a.name.localeCompare(b.name)))
    return data as Template
  }, [user])

  const update = useCallback(async (id: string, patch: Partial<TemplatePayload>): Promise<Template> => {
    const { data, error: e } = await supabase
      .from('templates').update(patch).eq('id', id).select().single()
    if (e) throw e
    setTemplates(prev => prev.map(t => t.id === id ? data as Template : t))
    return data as Template
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('templates').delete().eq('id', id)
    if (e) throw e
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  return { templates, loading, error, create, update, remove, refetch: fetch }
}
