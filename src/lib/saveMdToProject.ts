import { supabase } from './supabase'

const AI_FOLDER_NAME = 'AI 요약'

/** AI가 생성한 MD 파일을 프로젝트의 "AI 요약" 폴더에 저장 */
export async function saveMdToProject(
  content: string,
  fileName: string,          // 저장할 파일명 (예: 사업수행계획서_요약.md)
  projectId: string,
  userId: string,
): Promise<{ fileId: string; folderPath: string }> {

  // 1. "AI 요약" 폴더가 없으면 생성
  const { data: existing } = await supabase
    .from('files')
    .select('id')
    .eq('project_id', projectId)
    .eq('folder_path', '')
    .eq('original_name', AI_FOLDER_NAME)
    .eq('mime_type', 'folder')
    .maybeSingle()

  if (!existing) {
    await supabase.from('files').insert({
      project_id:    projectId,
      original_name: AI_FOLDER_NAME,
      folder_path:   '',
      storage_path:  '',
      size:          0,
      mime_type:     'folder',
      version:       '',
      uploaded_by:   userId,
    })
  }

  // 2. MD 파일 Storage 업로드
  const blob        = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const storagePath = `${projectId}/${crypto.randomUUID()}.md`

  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, blob, { contentType: 'text/markdown', upsert: false })
  if (upErr) throw upErr

  // 3. files 테이블에 레코드 생성
  const { data, error: dbErr } = await supabase.from('files').insert({
    project_id:    projectId,
    original_name: fileName,
    folder_path:   AI_FOLDER_NAME,
    storage_path:  storagePath,
    size:          blob.size,
    mime_type:     'text/markdown',
    version:       'v1.0',
    uploaded_by:   userId,
  }).select('id').single()

  if (dbErr) throw dbErr
  return { fileId: data.id, folderPath: AI_FOLDER_NAME }
}
