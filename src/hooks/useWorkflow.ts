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
    newFileId: row.new_file_id ?? null,
  }
}

export interface FileVersion {
  id: string
  originalName: string
  storagePath: string
  workflowStatus: WorkflowStatus
  workflowVersion: string
  createdAt: string
  isSuperseded: boolean
}

export function useWorkflow(fileId: string | null, projectId: string | null) {
  const [history, setHistory]               = useState<WorkflowHistory[]>([])
  const [fileVersions, setFileVersions]     = useState<FileVersion[]>([])
  const [currentStatus, setCurrentStatus]   = useState<WorkflowStatus>('최초생성')
  const [currentVersion, setCurrentVersion] = useState<string>('v0.1')
  const [loading, setLoading]               = useState(false)
  const [transitioning, setTransitioning]   = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!fileId) return
    setLoading(true)
    try {
      const { data: file } = await supabase
        .from('files')
        .select('workflow_status, workflow_version, storage_path')
        .eq('id', fileId)
        .single()

      if (file) {
        setCurrentStatus((file.workflow_status ?? '최초생성') as WorkflowStatus)
        setCurrentVersion(file.workflow_version ?? 'v0.1')
      }

      // 이력 조회
      const { data: hist } = await supabase
        .from('workflow_history')
        .select('*')
        .eq('file_id', fileId)
        .order('changed_at', { ascending: false })

      setHistory((hist ?? []).map(mapHistory))

      // 버전 이력: 같은 storage_path 폴더 + 이름(버전 제거) 기준으로 찾기
      if (file?.storage_path) {
        const folder = file.storage_path.split('/').slice(0, -1).join('/')
        const { data: versions } = await supabase
          .from('files')
          .select('id, original_name, storage_path, workflow_status, workflow_version, created_at, is_superseded')
          .like('storage_path', `${folder}/%`)
          .order('created_at', { ascending: false })

        setFileVersions((versions ?? []).map((v: any) => ({
          id: v.id,
          originalName: v.original_name,
          storagePath: v.storage_path,
          workflowStatus: (v.workflow_status ?? '최초생성') as WorkflowStatus,
          workflowVersion: v.workflow_version ?? 'v0.1',
          createdAt: v.created_at,
          isSuperseded: v.is_superseded ?? false,
        })))
      }
    } finally {
      setLoading(false)
    }
  }, [fileId])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  /**
   * 다음 단계로 전환
   * @param newFile - 새 버전 파일 (선택). 있으면 Storage 업로드 후 기존 파일을 superseded 처리
   */
  const transition = useCallback(async (
    toStatus: WorkflowStatus,
    comment: string,
    newFile?: File,
  ) => {
    if (!fileId || !projectId) return
    setTransitioning(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다')

      const step = WORKFLOW_STEPS.find(s => s.status === toStatus)
      if (!step) throw new Error('유효하지 않은 상태입니다')

      let newFileId: string | null = null

      if (newFile) {
        // ── 새 버전 파일 업로드 ──────────────────────────────────────
        // 현재 파일 정보 가져오기
        const { data: curFile } = await supabase
          .from('files')
          .select('storage_path, original_name')
          .eq('id', fileId)
          .single()

        if (!curFile) throw new Error('파일 정보를 찾을 수 없습니다')

        const folder = curFile.storage_path.split('/').slice(0, -1).join('/')
        const ext    = newFile.name.split('.').pop() ?? ''

        // 새 파일명: 기존 이름에서 버전 부분을 교체
        const baseName = curFile.original_name
          .replace(/\.[^.]+$/, '')                      // 확장자 제거
          .replace(/_v[\d.]+$/i, '')                    // 기존 버전 제거
        const newFileName = `${baseName}_${step.version}.${ext}`
        const newPath     = `${folder}/${newFileName}`

        // Storage 업로드
        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(newPath, newFile, { upsert: true })
        if (upErr) throw new Error(`파일 업로드 실패: ${upErr.message}`)

        // 새 files 레코드 생성
        const { data: newFileRow } = await supabase
          .from('files')
          .insert([{
            project_id:       projectId,
            original_name:    newFileName,
            storage_path:     newPath,
            size:             newFile.size,
            mime_type:        newFile.type,
            version:          step.version,
            uploaded_by:      user.id,
            workflow_status:  toStatus,
            workflow_version: step.version,
            version_note:     comment,
          }])
          .select()
          .single()
        if (!newFileRow) throw new Error('파일 레코드 생성 실패')
        newFileId = newFileRow.id

        // 기존 파일 superseded 처리
        await supabase
          .from('files')
          .update({ is_superseded: true, superseded_by: newFileId })
          .eq('id', fileId)

      } else {
        // ── 파일 없이 전환: 파일명도 버전에 맞게 자동 rename ──────────
        const { data: curFile } = await supabase
          .from('files')
          .select('storage_path, original_name, mime_type')
          .eq('id', fileId)
          .single()

        if (curFile) {
          const folder   = curFile.storage_path.split('/').slice(0, -1).join('/')
          const ext      = curFile.original_name.split('.').pop() ?? ''
          // 파일명에서 버전 suffix 제거 후 새 버전으로 교체
          const baseName = curFile.original_name
            .replace(/\.[^.]+$/, '')          // 확장자 제거
            .replace(/_v[\d.]+$/i, '')         // 기존 _v0.x 제거
          const newFileName = `${baseName}_${step.version}.${ext}`
          const newPath     = `${folder}/${newFileName}`

          // Storage 파일 이동 (rename)
          if (newPath !== curFile.storage_path) {
            const { error: moveErr } = await supabase.storage
              .from('documents')
              .move(curFile.storage_path, newPath)

            if (!moveErr) {
              // DB 파일 레코드 업데이트
              await supabase
                .from('files')
                .update({
                  workflow_status:  toStatus,
                  workflow_version: step.version,
                  original_name:    newFileName,
                  storage_path:     newPath,
                  version:          step.version,
                })
                .eq('id', fileId)
            } else {
              // move 실패 시 (이미 동일 경로 등) 상태만 업데이트
              await supabase
                .from('files')
                .update({ workflow_status: toStatus, workflow_version: step.version })
                .eq('id', fileId)
            }
          } else {
            await supabase
              .from('files')
              .update({ workflow_status: toStatus, workflow_version: step.version })
              .eq('id', fileId)
          }
        } else {
          await supabase
            .from('files')
            .update({ workflow_status: toStatus, workflow_version: step.version })
            .eq('id', fileId)
        }
      }

      // 워크플로우 이력 INSERT
      const { data: newHist } = await supabase
        .from('workflow_history')
        .insert([{
          file_id:      fileId,
          project_id:   projectId,
          from_status:  currentStatus,
          to_status:    toStatus,
          from_version: currentVersion,
          to_version:   step.version,
          comment:      comment || null,
          changed_by:   user.id,
          old_file_id:  newFileId ? fileId : null,
          new_file_id:  newFileId,
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

      // 버전 목록 갱신
      await fetchStatus()

      // 새 파일로 이동이 필요한 경우 ID 반환
      return newFileId
    } finally {
      setTransitioning(false)
    }
  }, [fileId, projectId, currentStatus, currentVersion, fetchStatus])

  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.status === currentStatus)
  const nextStep   = currentIdx < WORKFLOW_STEPS.length - 1 ? WORKFLOW_STEPS[currentIdx + 1] : null
  const isComplete = currentStatus === '완료'

  return {
    currentStatus, currentVersion, history, fileVersions,
    loading, transitioning, nextStep, isComplete,
    transition, refetch: fetchStatus,
  }
}
