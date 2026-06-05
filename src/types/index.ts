export type UserRole = 'admin' | 'member' | 'viewer'

export type DocumentStatus = '작성중' | '검토중' | '승인' | '완료'

export type DocumentCategory =
  | '요구사항'
  | '설계'
  | '개발'
  | '테스트'
  | '배포'
  | '기타'

// ── 워크플로우 ─────────────────────────────────────────────────────────────
export type WorkflowStatus = '최초생성' | '작성중' | '검토중' | '승인완료' | '완료'

export const WORKFLOW_STEPS: { status: WorkflowStatus; version: string; label: string }[] = [
  { status: '최초생성', version: 'v0.1', label: '최초생성' },
  { status: '작성중',   version: 'v0.5', label: '작성중'   },
  { status: '검토중',   version: 'v0.6', label: '검토중'   },
  { status: '승인완료', version: 'v0.7', label: '승인완료'  },
  { status: '완료',     version: 'v1.0', label: '완료'     },
]

/** 이 단계로 전환하려면 PM / PL 권한이 필요 */
export const WORKFLOW_REQUIRES_APPROVAL: WorkflowStatus[] = ['승인완료', '완료']

export interface WorkflowHistory {
  id: string
  fileId: string
  projectId: string
  fromStatus: WorkflowStatus | null
  toStatus: WorkflowStatus
  fromVersion: string | null
  toVersion: string
  comment: string | null
  changedBy: string
  changedAt: string
  authorEmail?: string
}

export interface DocumentComment {
  id: string
  fileId: string
  projectId: string
  content: string
  parentId: string | null
  mentions: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  authorEmail?: string
  authorName?: string
  replies?: DocumentComment[]
}

// ── 기존 타입들 ────────────────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  description: string
  clientName: string
  startDate: string
  endDate: string
  status: 'active' | 'archived'
  createdBy: string
  createdAt: string
  systemCode:  string | null
  systemName:  string | null
  logoUrl:     string | null
  themeColor:  string | null
}

export interface Document {
  id: string
  projectId: string
  title: string
  description: string
  category: DocumentCategory
  status: DocumentStatus
  assigneeId: string | null
  dueDate: string | null
  currentVersion: string
  createdAt: string
  updatedAt: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  version: string
  contentJson: object
  changeNote: string
  createdBy: string
  createdAt: string
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: UserRole
  name: string
  email: string
  avatarUrl: string | null
}

export interface FileRecord {
  id: string
  projectId: string
  originalName: string
  storagePath: string
  size: number
  mimeType: string
  version: string
  uploadedBy: string
  createdAt: string
  title: string
  workflowStatus: WorkflowStatus
  workflowVersion: string
}
