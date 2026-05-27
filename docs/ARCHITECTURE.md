# 아키텍처 및 설계

> n2Hub의 기술 아키텍처, 데이터 모델, 설계 결정

---

## 🏗 시스템 아키텍처

### 고수준 아키텍처

```
┌─────────────────────────────────────────────┐
│         Browser (React + TypeScript)        │
│  ┌──────────────────────────────────────┐  │
│  │    Pages (Login, Dashboard, etc)     │  │
│  │    ↓                                 │  │
│  │    Components (Layout, UI, Editor)   │  │
│  │    ↓                                 │  │
│  │    Hooks (useProject, useDocument)   │  │
│  │    ↓                                 │  │
│  │    lib/ (Auth, Supabase, API)        │  │
│  └──────────────────────────────────────┘  │
└────────────────┬──────────────────────────┘
                 │
     ┌───────────┼──────────────┐
     │           │              │
     ▼           ▼              ▼
  Supabase   Anthropic        Edge
   (PostgreSQL, Auth,  Claude API  Functions
    Storage, Realtime) (Streaming) (예정)
```

### 계층 구조 (Layered Architecture)

```
Frontend (React)
  └─ Pages (라우트별 페이지)
       └─ Components (UI 컴포넌트)
            └─ Custom Hooks (상태 관리)
                 └─ lib/ (외부 서비스 통합)
                      └─ Supabase Client
                      └─ Anthropic Client
```

---

## 📊 데이터 모델

### Entity Relationship Diagram (ERD)

```
┌──────────────────┐         ┌────────────────────┐
│    projects      │         │   project_members  │
├──────────────────┤         ├────────────────────┤
│ id (PK)          │         │ id (PK)            │
│ name             │◄────┬───│ project_id (FK)    │
│ description      │     │   │ user_id (FK)       │
│ client_name      │     │   │ role               │
│ status           │     │   │ unique(PK)         │
│ created_by (FK)  │     │   └────────────────────┘
│ created_at       │     │
│ updated_at       │     │
└──────────────────┘     │
          │              │
          │    ┌─────────┘
          │    │
          │    ▼
          │ ┌──────────────────┐
          │ │    documents     │
          │ ├──────────────────┤
          │ │ id (PK)          │
          │ │ project_id (FK)  │
          │ │ title            │
          │ │ category         │
          │ │ status           │
          │ │ assignee_id (FK) │
          │ │ due_date         │
          │ │ current_version  │
          │ │ created_at       │
          │ │ updated_at       │
          │ └──────────────────┘
          │        │
          │        ▼
          │ ┌────────────────────────┐
          │ │  document_versions     │
          │ ├────────────────────────┤
          │ │ id (PK)                │
          │ │ document_id (FK)       │
          │ │ version                │
          │ │ content_json           │
          │ │ change_note            │
          │ │ created_by (FK)        │
          │ │ created_at             │
          │ └────────────────────────┘
          │
          ▼
    ┌──────────────────┐
    │      files       │
    ├──────────────────┤
    │ id (PK)          │
    │ project_id (FK)  │
    │ document_id (FK) │
    │ original_name    │
    │ storage_path     │
    │ mime_type        │
    │ size             │
    │ uploaded_by (FK) │
    │ created_at       │
    └──────────────────┘
```

### 테이블 정의

#### projects
```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description text,
  client_name varchar,
  status varchar DEFAULT 'active',  -- 'active', 'completed', 'archived'
  start_date date,
  end_date date,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

#### documents
```sql
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar NOT NULL,
  category varchar,  -- '계획', '실행', '종료' 등
  status varchar DEFAULT 'draft',  -- 'draft', 'review', 'approved'
  description text,
  assignee_id uuid REFERENCES auth.users(id),
  due_date date,
  current_version int DEFAULT 1,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

#### document_versions
```sql
CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version int NOT NULL,
  content_json jsonb,  -- TipTap 에디터 상태
  change_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp DEFAULT now()
);
```

#### files
```sql
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  original_name varchar NOT NULL,
  storage_path varchar NOT NULL,  -- Supabase Storage 경로
  mime_type varchar,
  size bigint,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp DEFAULT now()
);
```

#### project_members
```sql
CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role varchar DEFAULT 'member',  -- 'owner', 'editor', 'viewer'
  created_at timestamp DEFAULT now(),
  UNIQUE(project_id, user_id)
);
```

---

## 🔐 보안 (RLS - Row Level Security)

### RLS 정책 원칙

**원칙:** 모든 사용자는 자신이 생성하거나 초대된 프로젝트의 데이터만 볼 수 있음

```sql
-- projects 테이블
-- 자신이 생성한 프로젝트만 조회 가능
CREATE POLICY "select own projects" ON projects
  FOR SELECT USING (created_by = auth.uid());

-- documents 테이블
-- 자신이 생성한 프로젝트의 문서만 조회 가능
CREATE POLICY "select project documents" ON documents
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

-- files 테이블
-- 같은 프로젝트의 파일만 조회/업로드 가능
CREATE POLICY "select project files" ON files
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "upload project files" ON files
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );
```

### Supabase Storage 정책

```sql
CREATE POLICY "allow upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "allow download" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND 
    auth.uid() IS NOT NULL
  );
```

---

## 🔄 데이터 흐름

### 프로젝트 생성 흐름

```
1. User 입력 (ProjectList.tsx)
   ↓
2. createProject() 호출 (useProject.ts)
   ↓
3. Supabase INSERT (lib/supabase.ts)
   ↓
4. RLS 검사 (created_by = auth.uid())
   ↓
5. DB 저장 ✅
   ↓
6. UI 업데이트 (useProject state)
   ↓
7. /projects/:id 라우트 이동
```

### 문서 업로드 흐름

```
1. User 파일 선택 (DocumentList.tsx)
   ↓
2. uploadFile() 호출 (useDocument.ts)
   ↓
3. Storage 업로드 (Supabase)
   ↓
4. files 테이블 INSERT
   ↓
5. documents 테이블 UPDATE (current_version)
   ↓
6. RLS 검사
   ↓
7. 업로드 완료 ✅
```

### AI 초안 생성 흐름

```
1. User "AI 초안 생성" 클릭 (DocumentEditor.tsx)
   ↓
2. generate() 호출 (useAI.ts)
   ↓
3. Anthropic API 호출
   │  - 모델: claude-sonnet-4-5
   │  - 스트리밍: 활성화
   │  - 프롬프트: 문서명 + 프로젝트 컨텍스트
   ↓
4. 스트림 응답 수신
   ↓
5. TipTap 에디터에 실시간 삽입
   ↓
6. 사용자가 "저장" 클릭
   ↓
7. document_versions INSERT
   ↓
8. 저장 완료 ✅
```

---

## 🎯 상태 관리 패턴

### Context API (전역 상태)

```typescript
// src/lib/auth.tsx
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // ...
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### Custom Hooks (로컬 상태)

```typescript
// src/hooks/useProject.ts
export function useProject() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('created_by', user?.id);
      
      if (error) throw error;
      setProjects(data.map(mapProject));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, fetchProjects]);

  return { projects, loading, error, fetchProjects };
}
```

---

## 🔌 외부 서비스 통합

### Supabase

**역할:**
- 데이터베이스 (PostgreSQL)
- 인증 (Email/Password, Social)
- 파일 저장소 (Storage)
- 실시간 구독 (Realtime)

**클라이언트:**
```typescript
// src/lib/supabase.ts
export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
```

### Anthropic Claude API

**역할:**
- 문서 초안 생성 (AI 작성 보조)
- 버전 변경 요약 (자동 요약)
- 스트리밍 응답 (실시간 입력)

**구현:**
```typescript
// src/lib/anthropic.ts
export async function generateDocumentDraft(
  documentType: string,
  context: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const stream = anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    stream: true,
    messages: [
      {
        role: 'user',
        content: `${documentType} 초안 작성: ${context}`
      }
    ]
  });

  let fullText = '';
  stream.on('text', (chunk) => {
    fullText += chunk;
    onChunk(chunk);
  });

  return fullText;
}
```

---

## 📝 설계 결정 (ADR)

### 1. Tailwind CSS v4 (@import만 사용)

**결정:** `tailwind.config.ts` 설정 파일 없이 `@import "tailwindcss"` 한 줄만 사용

**이유:**
- Tailwind CSS v4에서 설정 파일 불필요
- 간소화된 셋업
- 빠른 개발 속도

### 2. React Router v7 (중첩 라우트)

**결정:** React Router의 중첩 라우트 + `<Outlet>` 패턴 사용

**이유:**
- 계층적 UI 구조와 일치
- 조건부 렌더링 간결 (ProtectedRoute)
- 이후 부분 업데이트 용이

### 3. Supabase (자체 인증 시스템)

**결정:** Supabase Auth 사용 (Firebase 대신)

**이유:**
- PostgreSQL 데이터베이스 + Auth 통합
- 한국 리전 지원 (ap-northeast-2)
- 오픈소스 기반 (PostgREST)

### 4. TipTap (ProseMirror 기반)

**결정:** TipTap 2 사용 (Slate나 Draft.js 대신)

**이유:**
- 강력한 확장성
- Schema-driven (타입 안전)
- 협업 편집에 최적화 (Yjs 지원)

### 5. Claude API (스트리밍)

**결정:** Anthropic Claude API 스트리밍 (OpenAI 대신)

**이유:**
- 더 나은 문서 생성 품질
- 스트리밍 지원
- 컨텍스트 길이 (200K)

### 6. RLS (Row Level Security)

**결정:** Supabase RLS로 행 수준 보안 구현

**이유:**
- 데이터베이스 레벨 보안
- Backend 없이도 멀티테넌트 구현 가능
- 성능 최적화

---

## 🔮 향후 아키텍처 개선

### 1. Supabase Edge Functions (백엔드)

**목표:** Claude API 호출을 클라이언트에서 서버로 이동

```typescript
// supabase/functions/generate-document/index.ts
export const handler = async (req: Request) => {
  const { documentType, context } = await req.json();
  
  const text = await generateWithClaude(documentType, context);
  
  return new Response(text);
};
```

### 2. 실시간 협업 (Supabase Realtime + Yjs)

**목표:** 여러 사용자가 동시에 문서 편집

```typescript
// 실시간 업데이트 구독
const subscription = supabase
  .channel(`doc:${docId}`)
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'documents' },
    (payload) => {
      // 다른 사용자의 변경사항 반영
    }
  )
  .subscribe();
```

### 3. 번들 분할 (Route-based Code Splitting)

**목표:** 초기 로딩 시간 단축

```typescript
// React.lazy로 페이지 동적 임포트
const DocumentEditor = lazy(() => import('../pages/DocumentEditor'));
```

### 4. 캐싱 전략

**목표:** API 호출 최소화

```typescript
// TanStack Query (React Query) 도입
const { data: projects } = useQuery({
  queryKey: ['projects', userId],
  queryFn: () => fetchProjects(userId),
  staleTime: 1000 * 60 * 5, // 5분
});
```

---

## 📚 참고 자료

- [Supabase Architecture](https://supabase.com/docs/guides/getting-started/architecture)
- [React Pattern: Hooks + Context](https://react.dev/learn/scaling-up-with-reducer-and-context)
- [TipTap Editor Guide](https://www.tiptap.dev)
- [Conventional Database Design](https://www.postgresql.org/docs/current/sql-syntax.html)
