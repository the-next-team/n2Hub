import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type ActivityKind =
  | 'document_saved'
  | 'issue_created'
  | 'issue_updated'
  | 'comment_posted'
  | 'milestone_created'
  | 'task_updated'

export interface ActivityEvent {
  id:        string
  kind:      ActivityKind
  actor:     string   // 작성자/담당자
  summary:   string   // 짧은 설명
  detail?:   string   // 부가 정보
  link?:     string   // 내부 링크 경로
  ts:        string   // ISO 타임스탬프
}

export function useActivityLog(projectId: string, limit = 50) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const events: ActivityEvent[] = []

    await Promise.allSettled([
      // 1) 문서 버전 저장
      supabase
        .from('document_versions')
        .select('id, version, created_by, created_at, documents!inner(title, project_id)')
        .eq('documents.project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          for (const r of data ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = (r as any).documents
            events.push({
              id: `dv-${r.id}`,
              kind: 'document_saved',
              actor: '',
              summary: `"${doc?.title || '문서'}" ${r.version} 저장`,
              link: `/projects/${projectId}/documents`,
              ts: r.created_at,
            })
          }
        }),

      // 2) 이슈 생성
      supabase
        .from('issues')
        .select('id, title, type, priority, status, reporter_name, created_at, updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          for (const r of data ?? []) {
            events.push({
              id: `ic-${r.id}`,
              kind: 'issue_created',
              actor: r.reporter_name,
              summary: `이슈 "${r.title}" 생성`,
              detail: `${r.type} · ${r.priority}`,
              link: `/projects/${projectId}/issues`,
              ts: r.created_at,
            })
          }
        }),

      // 3) 댓글
      supabase
        .from('comments')
        .select('id, body, author_name, target_type, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          for (const r of data ?? []) {
            events.push({
              id: `cm-${r.id}`,
              kind: 'comment_posted',
              actor: r.author_name,
              summary: `${r.target_type === 'issue' ? '이슈' : r.target_type === 'task' ? '작업' : '파일'}에 댓글`,
              detail: r.body.length > 40 ? r.body.slice(0, 40) + '…' : r.body,
              link: `/projects/${projectId}/${r.target_type === 'issue' ? 'issues' : 'tasks'}`,
              ts: r.created_at,
            })
          }
        }),

      // 4) 마일스톤 생성
      supabase
        .from('milestones')
        .select('id, name, due_date, status, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          for (const r of data ?? []) {
            events.push({
              id: `ms-${r.id}`,
              kind: 'milestone_created',
              actor: '',
              summary: `마일스톤 "${r.name}" 추가`,
              detail: r.due_date ? `마감: ${r.due_date}` : undefined,
              link: `/projects/${projectId}/gantt`,
              ts: r.created_at,
            })
          }
        }),

      // 5) WBS 작업 업데이트 (최근 변경)
      supabase
        .from('wbs_tasks')
        .select('id, task_name, wbs_code, status, assignee_name, updated_at')
        .eq('project_id', projectId)
        .neq('status', 'not_started')
        .order('updated_at', { ascending: false })
        .limit(15)
        .then(({ data }) => {
          const STATUS_KO: Record<string, string> = {
            in_progress: '진행중', completed: '완료', delayed: '지연',
          }
          for (const r of data ?? []) {
            events.push({
              id: `tu-${r.id}`,
              kind: 'task_updated',
              actor: r.assignee_name ?? '',
              summary: `"${r.task_name}" ${STATUS_KO[r.status] ?? r.status}`,
              detail: r.wbs_code,
              link: `/projects/${projectId}/tasks`,
              ts: r.updated_at,
            })
          }
        }),
    ])

    // 시간순 정렬 + limit
    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    setEvents(events.slice(0, limit))
    setLoading(false)
  }, [projectId, limit])

  useEffect(() => { fetch() }, [fetch])

  return { events, loading, refetch: fetch }
}
