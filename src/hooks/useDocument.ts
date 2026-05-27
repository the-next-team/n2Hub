import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Document, DocumentVersion, DocumentCategory, DocumentStatus } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDocument(row: any): Document {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description || '',
    category: (row.category || '기타') as DocumentCategory,
    status: (row.status || '작성중') as DocumentStatus,
    assigneeId: row.assignee_id || null,
    dueDate: row.due_date || null,
    currentVersion: row.current_version || 'v1.0',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVersion(row: any): DocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    version: row.version,
    contentJson: row.content_json || {},
    changeNote: row.change_note || '',
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

type CreateDocumentInput = {
  title: string
  category: DocumentCategory
  status: DocumentStatus
  dueDate: string
  description: string
}

export function useDocuments(projectId: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    async function fetchDocuments() {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
        if (error) throw error
        setDocuments((data || []).map(mapDocument))
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }
    fetchDocuments()
  }, [projectId])

  async function createDocument(input: CreateDocumentInput): Promise<Document> {
    const { data, error } = await supabase.from('documents').insert([{
      project_id: projectId,
      title: input.title,
      description: input.description || null,
      category: input.category,
      status: input.status,
      due_date: input.dueDate || null,
    }]).select().single()
    if (error) throw error
    const doc = mapDocument(data)
    setDocuments(prev => [doc, ...prev])
    return doc
  }

  return { documents, loading, error, createDocument }
}

export function useDocument(docId: string) {
  const [document, setDocument] = useState<Document | null>(null)
  const [latestVersion, setLatestVersion] = useState<DocumentVersion | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)

  const latestVersionRef = useRef<DocumentVersion | null>(null)
  const versionsRef = useRef<DocumentVersion[]>([])

  useEffect(() => { latestVersionRef.current = latestVersion }, [latestVersion])
  useEffect(() => { versionsRef.current = versions }, [versions])

  useEffect(() => {
    if (!docId) return
    async function fetch() {
      const [docRes, verRes] = await Promise.all([
        supabase.from('documents').select('*').eq('id', docId).single(),
        supabase.from('document_versions').select('*').eq('document_id', docId).order('created_at', { ascending: false }),
      ])
      if (docRes.data) setDocument(mapDocument(docRes.data))
      const vers = (verRes.data || []).map(mapVersion)
      setVersions(vers)
      setLatestVersion(vers[0] || null)
      setLoading(false)
    }
    fetch()
  }, [docId])

  const autoSave = useCallback(async (contentJson: object) => {
    const { data: { user } } = await supabase.auth.getUser()
    const current = latestVersionRef.current

    if (current) {
      await supabase.from('document_versions')
        .update({ content_json: contentJson })
        .eq('id', current.id)
      setLatestVersion(prev => prev ? { ...prev, contentJson } : prev)
    } else {
      const { data } = await supabase.from('document_versions').insert([{
        document_id: docId,
        version: 'v1.0',
        content_json: contentJson,
        change_note: '최초 작성',
        created_by: user?.id,
      }]).select().single()
      if (data) {
        const ver = mapVersion(data)
        latestVersionRef.current = ver
        setLatestVersion(ver)
        setVersions([ver])
        setDocument(prev => prev ? { ...prev, currentVersion: 'v1.0' } : prev)
        await supabase.from('documents').update({ current_version: 'v1.0' }).eq('id', docId)
      }
    }
  }, [docId])

  const saveNewVersion = useCallback(async (contentJson: object, note: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const currentVersions = versionsRef.current

    const lastVer = currentVersions[0]?.version || 'v0.9'
    const parts = lastVer.replace('v', '').split('.')
    const newVer = `v${parseInt(parts[0])}.${parseInt(parts[1]) + 1}`

    const { data } = await supabase.from('document_versions').insert([{
      document_id: docId,
      version: newVer,
      content_json: contentJson,
      change_note: note || '버전 저장',
      created_by: user?.id,
    }]).select().single()
    if (!data) return

    await supabase.from('documents').update({
      current_version: newVer,
      updated_at: new Date().toISOString(),
    }).eq('id', docId)

    const ver = mapVersion(data)
    versionsRef.current = [ver, ...currentVersions]
    setVersions(prev => [ver, ...prev])
    setLatestVersion(ver)
    latestVersionRef.current = ver
    setDocument(prev => prev ? { ...prev, currentVersion: newVer } : prev)
    return ver
  }, [docId])

  return { document, latestVersion, versions, loading, autoSave, saveNewVersion }
}
