export type UserRole = 'admin' | 'member' | 'viewer'

export type DocumentStatus = '작성중' | '검토중' | '승인' | '완료'

export type DocumentCategory =
  | '요구사항'
  | '설계'
  | '개발'
  | '테스트'
  | '배포'
  | '기타'

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
  version: string       // "v1.0", "v2.1" 형식
  contentJson: object   // TipTap JSON
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
  title: string  // 파싱된 문서명
}
