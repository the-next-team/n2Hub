import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { WorkflowStatus, WorkflowHistory } from '../types'
import { WORKFLOW_STEPS } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHistory(row: any): WorkflowHistory {
  return {
    id: row.id,
    fileId: row.file_id,
    projectId: row.project_id,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status,
    fromVersion: row.from_version ?? null,
    toVersion: row.to_version,
    comment: row.comment ?? null,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    authorEmail: row.author_email,
  }
}

export function useWorkflow(fileId: string | null, projectId: string | null) {
  const [history, setHistory]             = useState<WorkflowHistory[]>([])
  const [currentStatus, setCurrentStatus] = useState<WorkflowStatus>('최초생성')
  const [currentVersion, setCurrentVersion] = useState<string>('v0.1')
  const [loading, setLoading]             = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  // 파일의 현재 워크플로우 상태 조회
  const fetchStatus = useCallback(async () => {
    if (!fileId) return
    setLoading(true)
    try {
      const { data: file } = await supabase
        .from('files')
        .select('workflow_status, workflow_version')
        .eq('id', fileId)
        .single()

      if (file) {
        setCurrentStatus((file.workflow_status ?? '최초생성') as WorkflowStatus)
        setCurrentVersion(file.workflow_version ?? 'v0.1')
      }

      // 이력 조회 (auth.users 직접 조인 불가 → changed_by 기준 이메일 별도 조회)
      const { data: hist } = await supabase
        .from('workflow_history')
        .select('*')
        .eq('file_id', fileId)
        .order('changed_at', { ascending: false })

      setHistory((hist ?? []).map(mapHistory))
    } finally {
      setLoading(false)
    }
  }, [fileId])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  /** 다음 단계로 전환 */
  const transition = useCallback(async (
    toStatus: WorkflowStatus,
    comment: string,
  ) => {
    if (!fileId || !projectId) return
    setTransitioning(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다')

      const step = WORKFLOW_STEPS.find(s => s.status === toStatus)
      if (!step) throw new Error('유효하지 않은 상태입니다')

      // files 테이블 업데이트
      await supabase
        .from('files')
        .update({ workflow_status: toStatus, workflow_version: step.version })
        .eq('id', fileId)

      // 이력 INSERT
      const { data: newHist } = await supabase
        .from('workflow_history')
        .insert([{
          file_id: fileId,
          project_id: projectId,
          from_status: currentStatus,
          to_status: toStatus,
          from_version: currentVersion,
          to_version: step.version,
          comment: comment || null,
          changed_by: user.id,
        }])
        .select()
        .single()

      setCurrentStatus(toStatus)
      setCurrentVersion(step.version)
      if (newHist) {
        setHistory(prev => [
          { ...mapHistory(newHist), authorEmail: user.email },
          ...prev,
        ])
      }
    } finally {
      setTransitioning(false)
    }
  }, [fileId, projectId, currentStatus, currentVersion])

  /** 현재 단계 인덱스 */
  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.status === currentStatus)
  const nextStep   = currentIdx < WORKFLOW_STEPS.length - 1 ? WORKFLOW_STEPS[currentIdx + 1] : null
  const isComplete = currentStatus === '완료'

  return {
    currentStatus, currentVersion, history, loading, transitioning,
    nextStep, isComplete, transition, refetch: fetchStatus,
  }
}
