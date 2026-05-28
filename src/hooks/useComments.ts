import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface Comment {
  id: string
  project_id: string
  target_type: string
  target_id: string
  body: string
  author_id: string
  author_name: string
  created_at: string
}

export function useComments(
  projectId: string,
  targetType: 'task' | 'file',
  targetId: string | null,
) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!targetId) { setComments([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setComments((data ?? []) as Comment[])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [targetType, targetId])

  useEffect(() => { fetch() }, [fetch])

  // 실시간 구독
  useEffect(() => {
    if (!targetId) return
    const channel = supabase
      .channel(`comments:${targetType}:${targetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `target_id=eq.${targetId}`,
        },
        () => { fetch() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [targetId, targetType, fetch])

  const post = useCallback(async (body: string): Promise<void> => {
    if (!user || !targetId || !body.trim()) return
    setPosting(true)
    setError(null)
    try {
      // author_name: profiles.display_name → user_metadata → email 순으로 시도
      const authorName =
        (user.user_metadata?.display_name as string | undefined) ??
        user.email?.split('@')[0] ??
        '알 수 없음'

      const { data, error } = await supabase
        .from('comments')
        .insert([{
          project_id: projectId,
          target_type: targetType,
          target_id: targetId,
          body: body.trim(),
          author_id: user.id,
          author_name: authorName,
        }])
        .select()
        .single()
      if (error) throw error
      setComments(prev => [...prev, data as Comment])
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setPosting(false)
    }
  }, [user, projectId, targetType, targetId])

  const remove = useCallback(async (commentId: string): Promise<void> => {
    setComments(prev => prev.filter(c => c.id !== commentId))
    await supabase.from('comments').delete().eq('id', commentId)
  }, [])

  return { comments, loading, posting, error, post, remove, refresh: fetch }
}

// 댓글 수만 가져오는 경량 훅 (목록에서 배지 표시용)
export function useCommentCounts(
  projectId: string,
  targetType: 'task' | 'file',
  targetIds: string[],
): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!projectId || !targetIds.length) return
    supabase
      .from('comments')
      .select('target_id')
      .eq('project_id', projectId)
      .eq('target_type', targetType)
      .in('target_id', targetIds)
      .then(({ data }) => {
        const m = new Map<string, number>()
        for (const row of data ?? []) {
          m.set(row.target_id, (m.get(row.target_id) ?? 0) + 1)
        }
        setCounts(m)
      })
  }, [projectId, targetType, targetIds.join(',')])  // eslint-disable-line

  return counts
}
