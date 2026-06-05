import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface FileSession { userId: string; userEmail: string; userName: string }

/** 파일 열람 시 세션 등록 → 언마운트 시 자동 삭제 */
export function useRegisterFileSession(fileId: string | undefined) {
  const { user } = useAuth()

  useEffect(() => {
    if (!fileId || !user) return
    const userName = user.user_metadata?.display_name || user.email?.split('@')[0] || '익명'
    supabase.from('file_sessions').upsert({
      file_id:    fileId,
      user_id:    user.id,
      user_email: user.email ?? '',
      user_name:  userName,
    }, { onConflict: 'file_id,user_id' }).then(() => {})

    return () => {
      supabase.from('file_sessions').delete().match({ file_id: fileId, user_id: user.id }).then(() => {})
    }
  }, [fileId, user])
}

/** 파일 목록에서 현재 열람 중인 사용자 목록 실시간 조회 */
export function useFileSessions(projectId: string) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Record<string, FileSession[]>>({})

  useEffect(() => {
    if (!projectId) return
    // 초기 로드
    supabase.from('file_sessions')
      .select('file_id, user_id, user_email, user_name')
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, FileSession[]> = {}
        data.forEach(r => {
          if (r.user_id === user?.id) return  // 본인 제외
          if (!map[r.file_id]) map[r.file_id] = []
          map[r.file_id].push({ userId: r.user_id, userEmail: r.user_email, userName: r.user_name })
        })
        setSessions(map)
      })

    // Realtime 구독
    const ch = supabase.channel(`file-sessions-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'file_sessions' }, () => {
        // 변경 발생 시 재조회 (간단 구현)
        supabase.from('file_sessions').select('file_id, user_id, user_email, user_name').then(({ data }) => {
          if (!data) return
          const map: Record<string, FileSession[]> = {}
          data.forEach(r => {
            if (r.user_id === user?.id) return
            if (!map[r.file_id]) map[r.file_id] = []
            map[r.file_id].push({ userId: r.user_id, userEmail: r.user_email, userName: r.user_name })
          })
          setSessions(map)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [projectId, user])

  return sessions
}
