import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useProjectParts(projectId: string) {
  const [parts, setParts]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    supabase.from('projects').select('parts').eq('id', projectId).single()
      .then(({ data }) => {
        setParts(Array.isArray(data?.parts) ? data.parts : [])
        setLoading(false)
      })
  }, [projectId])

  const save = useCallback(async (next: string[]) => {
    setParts(next)
    await supabase.from('projects').update({ parts: next }).eq('id', projectId)
  }, [projectId])

  const addPart = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || parts.includes(trimmed)) return
    await save([...parts, trimmed])
  }, [parts, save])

  const removePart = useCallback(async (name: string) => {
    await save(parts.filter(p => p !== name))
  }, [parts, save])

  return { parts, loading, addPart, removePart }
}
