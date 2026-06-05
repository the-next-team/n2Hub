import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DocumentComment } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(row: any, emailMap: Record<string, string> = {}): DocumentComment {
  return {
    id: row.id,
    fileId: row.file_id,
    projectId: row.project_id,
    content: row.content,
    parentId: row.parent_id ?? null,
    mentions: row.mentions ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorEmail: emailMap[row.created_by] ?? row.created_by,
    replies: [],
  }
}

function nestComments(flat: DocumentComment[]): DocumentComment[] {
  const map = new Map<string, DocumentComment>()
  flat.forEach(c => map.set(c.id, { ...c, replies: [] }))
  const roots: DocumentComment[] = []
  map.forEach(c => {
    if (c.parentId) {
      const parent = map.get(c.parentId)
      if (parent) parent.replies!.push(c)
      else roots.push(c)
    } else {
      roots.push(c)
    }
  })
  return roots
}

function flattenComments(cs: DocumentComment[]): DocumentComment[] {
  const result: DocumentComment[] = []
  function walk(list: DocumentComment[]) {
    list.forEach(c => { result.push(c); if (c.replies?.length) walk(c.replies) })
  }
  walk(cs)
  return result
}

export function useDocumentComments(fileId: string | null, projectId: string | null) {
  const [comments, setComments] = useState<DocumentComment[]>([])
  const [loading, setLoading]   = useState(false)
  const [posting, setPosting]   = useState(false)

  const fetchComments = useCallback(async () => {
    if (!fileId) return
    setLoading(true)
    try {
      const { data: rows } = await supabase
        .from('document_comments')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: true })

      const userIds = [...new Set((rows ?? []).map((r: any) => r.created_by as string))]
      const emailMap: Record<string, string> = {}
      if (userIds.length && projectId) {
        const { data: members } = await supabase
          .from('project_members')
          .select('user_id, email')
          .eq('project_id', projectId)
          .in('user_id', userIds)
        ;(members ?? []).forEach((m: any) => { emailMap[m.user_id] = m.email })
      }

      const mapped = (rows ?? []).map((r: any) => mapComment(r, emailMap))
      setComments(nestComments(mapped))
    } finally {
      setLoading(false)
    }
  }, [fileId, projectId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!fileId || !projectId || !content.trim()) return
    setPosting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다')

      const { data: row } = await supabase
        .from('document_comments')
        .insert([{
          file_id: fileId,
          project_id: projectId,
          content: content.trim(),
          parent_id: parentId ?? null,
          created_by: user.id,
        }])
        .select()
        .single()

      if (row) {
        const newComment = mapComment(row, { [user.id]: user.email ?? '' })
        setComments(prev => {
          const flat = flattenComments(prev)
          return nestComments([...flat, newComment])
        })
      }
    } finally {
      setPosting(false)
    }
  }, [fileId, projectId])

  const deleteComment = useCallback(async (commentId: string) => {
    await supabase.from('document_comments').delete().eq('id', commentId)
    setComments(prev => {
      const flat = flattenComments(prev).filter(c => c.id !== commentId)
      return nestComments(flat)
    })
  }, [])

  const totalCount = flattenComments(comments).length

  return { comments, loading, posting, addComment, deleteComment, totalCount, refetch: fetchComments }
}
