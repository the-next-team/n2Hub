import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface SearchFile {
  id:         string
  name:       string
  project_id: string
  project_name?: string
  kind:       'file'
}

export interface SearchTask {
  id:         string
  name:       string
  wbs_code:   string
  project_id: string
  project_name?: string
  status:     string
  kind:       'task'
}

export interface SearchIssue {
  id:         string
  name:       string
  project_id: string
  project_name?: string
  status:     string
  priority:   string
  kind:       'issue'
}

export interface SearchResults {
  files:  SearchFile[]
  tasks:  SearchTask[]
  issues: SearchIssue[]
}

export function useGlobalSearch() {
  const search = useCallback(async (query: string): Promise<SearchResults> => {
    const q = query.trim()
    if (!q) return { files: [], tasks: [], issues: [] }
    const like = `%${q}%`

    const [fileRes, taskRes, issueRes] = await Promise.allSettled([
      supabase
        .from('files')
        .select('id, original_name, project_id')
        .ilike('original_name', like)
        .limit(5),

      supabase
        .from('wbs_tasks')
        .select('id, task_name, wbs_code, project_id, status')
        .ilike('task_name', like)
        .limit(5),

      supabase
        .from('issues')
        .select('id, title, project_id, status, priority')
        .ilike('title', like)
        .not('status', 'eq', 'closed')
        .limit(5),
    ])

    const files: SearchFile[] = fileRes.status === 'fulfilled'
      ? (fileRes.value.data ?? []).map(r => ({ id: r.id, name: r.original_name, project_id: r.project_id, kind: 'file' as const }))
      : []

    const tasks: SearchTask[] = taskRes.status === 'fulfilled'
      ? (taskRes.value.data ?? []).map(r => ({ id: r.id, name: r.task_name, wbs_code: r.wbs_code, project_id: r.project_id, status: r.status, kind: 'task' as const }))
      : []

    const issues: SearchIssue[] = issueRes.status === 'fulfilled'
      ? (issueRes.value.data ?? []).map(r => ({ id: r.id, name: r.title, project_id: r.project_id, status: r.status, priority: r.priority, kind: 'issue' as const }))
      : []

    // 프로젝트명 조회
    const projectIds = [...new Set([
      ...files.map(f => f.project_id),
      ...tasks.map(t => t.project_id),
      ...issues.map(i => i.project_id),
    ])]

    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects').select('id, name').in('id', projectIds)
      const nameMap: Record<string, string> = {}
      for (const p of projects ?? []) nameMap[p.id] = p.name
      files.forEach(f => { f.project_name = nameMap[f.project_id] })
      tasks.forEach(t => { t.project_name = nameMap[t.project_id] })
      issues.forEach(i => { i.project_name = nameMap[i.project_id] })
    }

    return { files, tasks, issues }
  }, [])

  return { search }
}
