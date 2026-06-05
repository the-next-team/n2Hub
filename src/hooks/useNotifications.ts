import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
  projectId: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Notification {
  return { id: r.id, type: r.type, title: r.title, body: r.body, link: r.link, read: r.read, createdAt: r.created_at, projectId: r.project_id }
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data ?? []).map(mapRow))
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  // Realtime 구독 — 새 알림 실시간 수신
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifications(prev => [mapRow(payload.new), ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [user])

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, loading, unreadCount, markRead, markAllRead, refetch: fetch }
}

/** 알림 생성 유틸 */
export async function createNotification(
  userId: string,
  payload: { type: string; title: string; body?: string; link?: string; projectId?: string },
) {
  await supabase.from('notifications').insert([{
    user_id:    userId,
    project_id: payload.projectId ?? null,
    type:       payload.type,
    title:      payload.title,
    body:       payload.body ?? null,
    link:       payload.link ?? null,
  }])
}
