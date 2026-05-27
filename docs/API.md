# API 문서

> Supabase REST API 및 클라이언트 호출 가이드

---

## 🔗 기본 정보

### Supabase REST API

```
Base URL: https://lakiodyzpecidhmadbgy.supabase.co
API Version: v1
Authentication: Bearer Token (Supabase Auth)
```

### 인증

모든 요청에 Authorization 헤더 포함:

```bash
Authorization: Bearer {access_token}
```

access_token은 `useAuth()` 훅에서 `user.accessToken`으로 얻을 수 있습니다.

---

## 📑 Projects API

### 프로젝트 목록 조회

**엔드포인트:** `GET /rest/v1/projects`

**권한:** RLS - 자신이 생성한 프로젝트만

**클라이언트 코드:**
```typescript
import { supabase } from '@/lib/supabase';

async function getProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

**cURL:**
```bash
curl -X GET \
  'https://lakiodyzpecidhmadbgy.supabase.co/rest/v1/projects?order=created_at.desc' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'apikey: YOUR_ANON_KEY'
```

**응답:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "핀다AI뱅크 뱅킹시스템",
    "description": "저축은행 뱅킹시스템 구축",
    "client_name": "핀다AI뱅크",
    "status": "active",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "created_by": "user-uuid",
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-05-20T14:30:00Z"
  }
]
```

### 프로젝트 생성

**엔드포인트:** `POST /rest/v1/projects`

**클라이언트 코드:**
```typescript
async function createProject(
  name: string,
  description: string,
  clientName: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('projects')
    .insert([{
      name,
      description,
      client_name: clientName,
      created_by: userId,
      status: 'active'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**요청 본문:**
```json
{
  "name": "새 프로젝트",
  "description": "프로젝트 설명",
  "client_name": "클라이언트명",
  "status": "active",
  "created_by": "user-uuid"
}
```

**응답:** 생성된 프로젝트 객체

### 프로젝트 업데이트

**엔드포인트:** `PATCH /rest/v1/projects?id=eq.{projectId}`

**클라이언트 코드:**
```typescript
async function updateProject(
  projectId: string,
  updates: Partial<Project>
) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### 프로젝트 삭제

**엔드포인트:** `DELETE /rest/v1/projects?id=eq.{projectId}`

**클라이언트 코드:**
```typescript
async function deleteProject(projectId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}
```

---

## 📄 Documents API

### 문서 목록 조회

**엔드포인트:** `GET /rest/v1/documents?project_id=eq.{projectId}`

**클라이언트 코드:**
```typescript
async function getDocuments(projectId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

**응답:**
```json
[
  {
    "id": "doc-uuid",
    "project_id": "project-uuid",
    "title": "사업수행계획서",
    "category": "계획",
    "status": "draft",
    "description": "프로젝트 수행 계획",
    "assignee_id": "user-uuid",
    "due_date": "2026-06-30",
    "current_version": 1,
    "created_at": "2026-05-20T10:00:00Z",
    "updated_at": "2026-05-20T14:30:00Z"
  }
]
```

### 문서 상세 조회

**엔드포인트:** `GET /rest/v1/documents?id=eq.{docId}`

**클라이언트 코드:**
```typescript
async function getDocument(docId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error) throw error;
  return data;
}
```

### 문서 생성

**엔드포인트:** `POST /rest/v1/documents`

**클라이언트 코드:**
```typescript
async function createDocument(
  projectId: string,
  title: string,
  category: string
) {
  const { data, error } = await supabase
    .from('documents')
    .insert([{
      project_id: projectId,
      title,
      category,
      status: 'draft',
      current_version: 0
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### 문서 버전 조회

**엔드포인트:** `GET /rest/v1/document_versions?document_id=eq.{docId}`

**클라이언트 코드:**
```typescript
async function getDocumentVersions(docId: string) {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', docId)
    .order('version', { ascending: false });

  if (error) throw error;
  return data;
}
```

**응답:**
```json
[
  {
    "id": "version-uuid",
    "document_id": "doc-uuid",
    "version": 2,
    "content_json": { /* TipTap editor state */ },
    "change_note": "첫 번째 수정",
    "created_by": "user-uuid",
    "created_at": "2026-05-25T10:00:00Z"
  },
  {
    "id": "version-uuid",
    "document_id": "doc-uuid",
    "version": 1,
    "content_json": { /* TipTap editor state */ },
    "change_note": "초안 작성",
    "created_by": "user-uuid",
    "created_at": "2026-05-20T10:00:00Z"
  }
]
```

### 문서 버전 저장

**엔드포인트:** `POST /rest/v1/document_versions`

**클라이언트 코드:**
```typescript
async function saveDocumentVersion(
  documentId: string,
  content: any, // TipTap JSON
  changeNote: string,
  userId: string,
  version: number
) {
  const { error } = await supabase
    .from('document_versions')
    .insert([{
      document_id: documentId,
      content_json: content,
      change_note: changeNote,
      created_by: userId,
      version
    }]);

  if (error) throw error;

  // documents 테이블 업데이트
  await supabase
    .from('documents')
    .update({
      current_version: version,
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId);
}
```

---

## 📦 Files API

### 파일 업로드

**엔드포인트:** `POST /storage/v1/object/documents/{path}`

**클라이언트 코드:**
```typescript
async function uploadFile(
  projectId: string,
  file: File
) {
  // 저장 경로: projects/{projectId}/{timestamp}-{filename}
  const path = `projects/${projectId}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // files 테이블에 기록
  await supabase
    .from('files')
    .insert([{
      project_id: projectId,
      original_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size: file.size,
      uploaded_by: userId
    }]);

  return data;
}
```

### 파일 목록 조회

**엔드포인트:** `GET /rest/v1/files?project_id=eq.{projectId}`

**클라이언트 코드:**
```typescript
async function getProjectFiles(projectId: string) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### 파일 다운로드

**엔드포인트:** `GET /storage/v1/object/documents/{path}`

**클라이언트 코드:**
```typescript
async function downloadFile(storagePath: string) {
  const { data, error } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (error) throw error;

  // Blob을 다운로드
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = storagePath.split('/').pop() || 'file';
  link.click();
}
```

### 파일 삭제

**엔드포인트:** `DELETE /storage/v1/object/documents/{path}`

**클라이언트 코드:**
```typescript
async function deleteFile(storagePath: string, fileId: string) {
  // Storage에서 삭제
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([storagePath]);

  if (storageError) throw storageError;

  // files 테이블에서 삭제
  const { error: dbError } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId);

  if (dbError) throw dbError;
}
```

---

## 🔐 Authentication API

### 로그인

**클라이언트 코드:**
```typescript
async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data.user;
}
```

### 회원가입

**클라이언트 코드:**
```typescript
async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });

  if (error) throw error;
  return data.user;
}
```

### 로그아웃

**클라이언트 코드:**
```typescript
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

### 현재 사용자 정보

**클라이언트 코드:**
```typescript
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

---

## 🤖 AI API

### Claude 초안 생성 (스트리밍)

**엔드포인트:** Anthropic Claude API

**클라이언트 코드:**
```typescript
import { Anthropic } from '@anthropic-ai/sdk';

async function generateDocumentDraft(
  documentType: string,
  context: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.VITE_ANTHROPIC_API_KEY
  });

  const stream = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    stream: true,
    messages: [
      {
        role: 'user',
        content: `
${documentType} 문서 작성:

프로젝트 정보:
${context}

위 정보를 바탕으로 전문적인 ${documentType}을(를) 작성해주세요.
구조화된 섹션과 구체적인 내용을 포함하세요.
`
      }
    ]
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const chunk = event.delta.text;
      fullText += chunk;
      onChunk(chunk);
    }
  }

  return fullText;
}
```

---

## 📊 Type 정의

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  client_name?: string;
  status: 'active' | 'completed' | 'archived';
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### Document

```typescript
interface Document {
  id: string;
  project_id: string;
  title: string;
  category?: string;
  status: 'draft' | 'review' | 'approved';
  description?: string;
  assignee_id?: string;
  due_date?: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}
```

### DocumentVersion

```typescript
interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  content_json: any; // TipTap JSON
  change_note?: string;
  created_by: string;
  created_at: string;
}
```

### File

```typescript
interface File {
  id: string;
  project_id: string;
  document_id?: string;
  original_name: string;
  storage_path: string;
  mime_type?: string;
  size: number;
  uploaded_by: string;
  created_at: string;
}
```

---

## 🔄 에러 처리

### 에러 응답 예시

```typescript
try {
  await supabase
    .from('projects')
    .select('*')
    .eq('id', 'invalid-id');
} catch (error) {
  // error 구조
  {
    message: "Column not found",
    code: "42883",
    details: "...",
    hint: "..."
  }
}
```

### 에러 처리 패턴

```typescript
async function safeFetch<T>(
  fn: () => Promise<T>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 사용
const { data, error } = await safeFetch(() =>
  supabase.from('projects').select('*')
);

if (error) {
  console.error('프로젝트 조회 실패:', error.message);
  // UI에 에러 표시
}
```

---

## 🧪 테스트 방법

### Postman에서 테스트

1. **Authorization 헤더 설정**
   ```
   Authorization: Bearer {your_access_token}
   ```

2. **GET 요청 예시**
   ```
   GET https://lakiodyzpecidhmadbgy.supabase.co/rest/v1/projects
   ```

3. **POST 요청 예시**
   ```
   POST https://lakiodyzpecidhmadbgy.supabase.co/rest/v1/projects
   
   Body (JSON):
   {
     "name": "테스트",
     "created_by": "user-id"
   }
   ```

### cURL에서 테스트

```bash
# 프로젝트 목록
curl -X GET \
  'https://lakiodyzpecidhmadbgy.supabase.co/rest/v1/projects' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "apikey: YOUR_ANON_KEY"

# 프로젝트 생성
curl -X POST \
  'https://lakiodyzpecidhmadbgy.supabase.co/rest/v1/projects' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 프로젝트",
    "created_by": "user-uuid"
  }'
```

---

## 📚 참고 자료

- [Supabase REST API Docs](https://supabase.com/docs/reference/api/overview)
- [PostgREST Documentation](https://postgrest.org)
- [Anthropic Claude API](https://docs.anthropic.com)
