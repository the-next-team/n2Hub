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
        const { data: curFile } = await supabase
          .from('files')
          .select('original_name, folder_path, storage_path')
          .eq('id', fileId)
          .single()

        if (!curFile) throw new Error('파일 정보를 찾을 수 없습니다')

        const currentFolderPath = curFile.folder_path ?? ''
        const oldFolderPath     = currentFolderPath ? `${currentFolderPath}/old` : 'old'

        // ── old 폴더 없으면 생성 ────────────────────────────────────
        const { data: existingOld } = await supabase
          .from('files')
          .select('id')
          .eq('project_id', projectId)
          .eq('folder_path', currentFolderPath)
          .eq('original_name', 'old')
          .eq('mime_type', 'folder')
          .maybeSingle()

        if (!existingOld) {
          await supabase.from('files').insert([{
            project_id:    projectId,
            original_name: 'old',
            folder_path:   currentFolderPath,
            storage_path:  '',
            size:          0,
            mime_type:     'folder',
            version:       '',
            uploaded_by:   user.id,
          }])
        }

        // ── 기존 파일 → old 폴더로 이동 ─────────────────────────────
        await supabase
          .from('files')
          .update({
            folder_path:   oldFolderPath,
            is_superseded: true,
          })
          .eq('id', fileId)

        // ── 새 파일명 생성 (버전 교체) ───────────────────────────────
        const ext         = newFile.name.split('.').pop() ?? ''
        const baseName    = curFile.original_name
          .replace(/\.[^.]+$/, '')
          .replace(/_v[\d.]+$/i, '')
        const newFileName = `${baseName}_${step.version}.${ext}`
        const storagePath = `${projectId}/${crypto.randomUUID()}.${ext}`

        // ── Storage 업로드 ───────────────────────────────────────────
        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, newFile, { upsert: false })
        if (upErr) throw new Error(`파일 업로드 실패: ${upErr.message}`)

        // ── 새 files 레코드 생성 (현재 폴더에) ──────────────────────
        const { data: newFileRow } = await supabase
          .from('files')
          .insert([{
            project_id:       projectId,
            original_name:    newFileName,
            folder_path:      currentFolderPath,
            storage_path:     storagePath,
            size:             newFile.size,
            mime_type:        newFile.type || 'application/octet-stream',
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

        // superseded_by 연결
        await supabase
          .from('files')
          .update({ superseded_by: newFileId })
          .eq('id', fileId)

      } else {
        // ── 파일 없이 전환: original_name의 버전 suffix만 DB에서 교체 ─
        // Storage 경로는 UUID 기반이므로 변경 불필요, 표시명만 업데이트
        const { data: curFile } = await supabase
          .from('files')
          .select('original_name')
          .eq('id', fileId)
          .single()

        const newOriginalName = curFile
          ? (() => {
              const ext      = curFile.original_name.split('.').pop() ?? ''
              const baseName = curFile.original_name
                .replace(/\.[^.]+$/, '')       // 확장자 제거
                .replace(/_v[\d.]+$/i, '')      // 기존 _v0.x 제거
              return `${baseName}_${step.version}.${ext}`
            })()
          : null

        await supabase
          .from('files')
          .update({
            workflow_status:  toStatus,
            workflow_version: step.version,
            version:          step.version,
            ...(newOriginalName ? { original_name: newOriginalName } : {}),
          })
          .eq('id', fileId)
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
