import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface UpcomingMilestone {
  id:         string
  name:       string
  due_date:   string
  project_id: string
}

export interface DashboardStats {
  openIssues:          number
  criticalIssues:      number
  upcomingMilestones:  UpcomingMilestone[]
  overdueMilestones:   number
  loading:             boolean
}

export function useDashboardStats(): DashboardStats {
  const [openIssues, setOpenIssues]             = useState(0)
  const [criticalIssues, setCriticalIssues]     = useState(0)
  const [upcomingMilestones, setUpcoming]       = useState<UpcomingMilestone[]>([])
  const [overdueMilestones, setOverdue]         = useState(0)
  const [loading, setLoading]                   = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0]

    Promise.allSettled([
      // 열린 이슈 수
      supabase.from('issues').select('id, priority', { count: 'exact' })
        .in('status', ['open', 'in_progress']),

      // 다가오는 마일스톤 (7일 이내)
      supabase.from('milestones')
        .select('id, name, due_date, project_id')
        .eq('status', 'planned')
        .gte('due_date', today)
        .lte('due_date', nextWeek)
        .order('due_date'),

      // 지난 마일스톤 수
      supabase.from('milestones')
        .select('id', { count: 'exact' })
        .eq('status', 'planned')
        .lt('due_date', today),
    ]).then(([issueRes, msRes, overdueRes]) => {
      if (issueRes.status === 'fulfilled' && !issueRes.value.error) {
        const rows = issueRes.value.data ?? []
        setOpenIssues(rows.length)
        setCriticalIssues(rows.filter((r: { priority: string }) => r.priority === 'critical').length)
      }
      if (msRes.status === 'fulfilled' && !msRes.value.error) {
        setUpcoming((msRes.value.data ?? []) as UpcomingMilestone[])
      }
      if (overdueRes.status === 'fulfilled' && !overdueRes.value.error) {
        setOverdue(overdueRes.value.data?.length ?? 0)
      }
      setLoading(false)
    })
  }, [])

  return { openIssues, criticalIssues, upcomingMilestones, overdueMilestones, loading }
}
