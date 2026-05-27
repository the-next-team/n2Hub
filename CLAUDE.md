# n2Hub — Claude Code 컨텍스트

> IT 프로젝트 산출물 통합관리 플랫폼
> 이 파일은 Claude Code / Claude Desktop이 프로젝트 전체 컨텍스트를 이해하기 위한 파일입니다.

---

## 서비스 한 줄 정의

**IT 프로젝트 산출물과 이슈를 한 곳에서 관리하는 협업형 문서 자동화 플랫폼**
- 레퍼런스: Confluence + Jira, Notion, SharePoint
- 핵심 차별점: 로고/표지/회사정보 변경 시 전체 산출물 자동 반영 + AI 초안 생성

---

## 기술 스택

```
프론트엔드
  Vite 6.4.2          빌드 도구
  React 19.2.6        UI 프레임워크
  TypeScript 5.9.3    언어
  Tailwind CSS v4.3   스타일링 (@import "tailwindcss" 한 줄, 설정 파일 없음)
  React Router v7     라우팅 (BrowserRouter + nested routes)
  TipTap 2.27.2       Block 에디터 (ProseMirror 기반, 아직 미완성)
  lucide-react        아이콘

백엔드
  Supabase            PostgreSQL + Auth + Storage + Realtime
  프로젝트 URL: https://lakiodyzpecidhmadbgy.supabase.co
  리전: ap-northeast-2 (Seoul)

AI
  Anthropic Claude API   문서 초안 생성, 변경 요약
  모델: claude-sonnet-4-5
  스트리밍: 활성화 (lib/anthropic.ts에 구현됨)

패키지 매니저: pnpm v11.3.0
  주의: pnpm v11은 pnpm.yaml로 설정 관리
  @esbuild/win32-x64 직접 설치 필요 (esbuild postinstall 스크립트 차단 이슈)
```

---

## 현재 구현 상태 (2026-05-26 기준)

### ✅ 완료
- [x] 프로젝트 초기 세팅 (Vite + React + TypeScript + Tailwind v4)
- [x] Supabase 연결 (URL + Publishable Key)
- [x] DB 스키마 생성 (projects, documents, document_versions, project_members, files)
- [x] RLS 활성화 + projects 테이블 정책 (select/insert/update/delete)
- [x] 로그인 / 회원가입 / 로그아웃 (Supabase Auth)
- [x] AuthProvider + useAuth 훅 (src/lib/auth.tsx)
- [x] 보호 라우트 (ProtectedRoute, GuestRoute)
- [x] 프로젝트 목록 + 생성 모달
- [x] 대시보드 (실제 프로젝트 수 반영)

### ⬜ 미완료 (우선순위 순)
- [ ] **Supabase Storage + 파일 업로드** ← 다음 작업
- [ ] 산출물 목록 (DocumentList) Supabase 연동
- [ ] TipTap 에디터 완성 + 자동저장
- [ ] DOCX → TipTap 변환 (mammoth.js)
- [ ] documents / document_versions RLS 정책 추가
- [ ] AI 문서 초안 생성 (스트리밍 UI)
- [ ] AI 버전 변경 요약
- [ ] 표지 설정 (로고·회사명·문서 제목)
- [ ] PDF 내보내기
- [ ] Vercel 배포

---

## IA 정의서 (Information Architecture)

### 화면 목록

| ID | 경로 | 화면명 | 설명 | 상태 |
|----|------|--------|------|------|
| AU-01 | /login | 로그인 | 이메일/비밀번호 로그인, 회원가입 전환 | ✅ 완료 |
| DA-01 | /dashboard | 대시보드 | 프로젝트 통계 카드, 최근 프로젝트 목록 | ✅ 완료 |
| PJ-01 | /projects | 프로젝트 목록 | 카드 그리드, 검색, 새 프로젝트 모달 | ✅ 완료 |
| PJ-10 | /projects/:id | 프로젝트 상세 | 산출물 목록·멤버 링크 | 🔧 스텁 |
| PJ-11 | /projects/:id/documents | 산출물 목록 | 테이블, 파일 업로드, 상태/담당자/버전 | 🔧 스텁 |
| DO-01 | /documents/:docId | 문서 에디터 | TipTap 에디터, AI 초안, 저장, 버전 | 🔧 스텁 |
| TM-01 | /templates | 템플릿 관리 | 분류별 템플릿 카드 | 🔧 스텁 |
| AC-01 | /settings | 설정 | 계정, 회사 정보, 알림 | 🔧 스텁 |

### 컴포넌트 계층

```
App.tsx
├── AuthProvider (src/lib/auth.tsx — auth context 전역 공급)
└── BrowserRouter
    ├── GuestRoute → /login → Login
    └── ProtectedRoute (미인증 시 /login 리다이렉트)
        └── Layout (src/components/layout/Layout.tsx)
            ├── Sidebar
            │   ├── n2Hub 로고
            │   ├── NavLink: 대시보드 / 프로젝트 / 템플릿 / 설정
            │   └── 하단: 사용자 이메일 + 로그아웃 버튼
            └── <Outlet> (페이지 렌더 영역)
                ├── Dashboard
                ├── ProjectList (+ CreateProjectModal 인라인)
                ├── ProjectDetail
                ├── DocumentList
                ├── DocumentEditor
                ├── TemplateManager
                └── Settings
```

### 사용자 흐름

```
미인증 사용자
  → 모든 경로 접근 시 /login 리다이렉트
  → 로그인/회원가입 완료 → /dashboard

인증된 사용자
  /dashboard
    → 프로젝트 카드 클릭 → /projects/:id
    → "전체 보기" → /projects

  /projects
    → "새 프로젝트" 버튼 → 모달 → 생성 후 /projects/:id 이동
    → 프로젝트 카드 클릭 → /projects/:id

  /projects/:id
    → "산출물 목록" → /projects/:id/documents

  /projects/:id/documents
    → 파일 업로드 → Storage 저장 + documents 레코드 생성
    → 문서 행 클릭 → /documents/:docId

  /documents/:docId
    → TipTap 에디터 편집
    → "AI 초안 생성" → 스트리밍으로 에디터에 입력
    → "저장" → document_versions 레코드 생성
    → "PDF 내보내기" → window.print()
```

---

## 파일 구조 (실제)

```
n2Hub/
├── CLAUDE.md                       ← 이 파일
├── .env.local                      ← 환경변수 (커밋 금지)
├── pnpm.yaml                       ← pnpm v11 설정 (esbuild 빌드 허용)
├── package.json
├── vite.config.ts                  ← @vitejs/plugin-react + @tailwindcss/vite
├── tsconfig.app.json
├── tsconfig.node.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx                     ← 라우터 + AuthProvider 래핑
    ├── index.css                   ← @import "tailwindcss"
    │
    ├── lib/
    │   ├── auth.tsx                ← AuthContext, AuthProvider, useAuth()
    │   ├── supabase.ts             ← createClient (URL + Anon Key)
    │   ├── anthropic.ts            ← generateDocumentDraft(), summarizeChanges()
    │   └── pdf.ts                  ← window.print() 래퍼
    │
    ├── hooks/
    │   ├── useProject.ts           ← useProjects() — CRUD + snake_case 매핑
    │   ├── useDocument.ts          ← useDocuments(projectId) — 미완성
    │   └── useAI.ts                ← useAI() — 스트리밍 상태 관리
    │
    ├── types/
    │   └── index.ts                ← Project, Document, DocumentVersion, ProjectMember
    │
    ├── utils/
    │   └── index.ts                ← formatDate(), formatVersion(), cn()
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.tsx          ← Sidebar + <Outlet>
    │   │   └── Sidebar.tsx         ← 네비게이션 + useAuth 로그아웃
    │   ├── ui/                     ← 비어있음 (버튼, 배지 등 추가 예정)
    │   └── editor/                 ← 비어있음 (TipTap 컴포넌트 추가 예정)
    │
    └── pages/
        ├── Login.tsx               ← ✅ Supabase Auth 연동 완료
        ├── Dashboard.tsx           ← ✅ 실제 프로젝트 수 반영
        ├── ProjectList.tsx         ← ✅ 카드 그리드 + 생성 모달 완료
        ├── ProjectDetail.tsx       ← 🔧 스텁
        ├── DocumentList.tsx        ← 🔧 스텁 (파일 업로드 구현 예정)
        ├── DocumentEditor.tsx      ← 🔧 스텁 (TipTap 구현 예정)
        ├── TemplateManager.tsx     ← 🔧 스텁
        └── Settings.tsx            ← 🔧 스텁
```

---

## 환경변수 (.env.local)

```bash
VITE_SUPABASE_URL=https://lakiodyzpecidhmadbgy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_SHnsFWTQqUlZemylzYSzCQ_nMMNWf-7
VITE_ANTHROPIC_API_KEY=sk-ant-...   # 미설정 — 나중에 추가
```

> Supabase Publishable Key (구 anon key)는 RLS가 활성화된 경우 브라우저에서 안전하게 사용 가능.
> Anthropic Key는 데모 목적. 실서비스는 Supabase Edge Function 프록시 사용 권장.

---

## DB 스키마 (Supabase — 생성 완료)

```sql
-- ✅ 생성됨
projects            (id, name, description, client_name, start_date, end_date, status, created_by, created_at)
documents           (id, project_id, title, description, category, status, assignee_id, due_date, current_version, created_at, updated_at)
document_versions   (id, document_id, version, content_json, change_note, created_by, created_at)
project_members     (id, project_id, user_id, role, unique(project_id, user_id))
files               (id, project_id, document_id, original_name, storage_path, size, mime_type, version, uploaded_by, created_at)

-- ✅ RLS 활성화됨 (모든 테이블)

-- ✅ projects 정책 (생성됨)
"select own projects"  → for select using (created_by = auth.uid())
"insert projects"      → for insert with check (created_by = auth.uid())
"update own projects"  → for update using (created_by = auth.uid())
"delete own projects"  → for delete using (created_by = auth.uid())

-- ⬜ documents, document_versions, files 정책 (미생성 — 다음 작업 시 추가 필요)
```

### documents RLS 정책 (다음 작업 시 SQL Editor에서 실행)

```sql
create policy "select project documents" on documents
  for select using (
    project_id in (select id from projects where created_by = auth.uid())
  );

create policy "insert project documents" on documents
  for insert with check (
    project_id in (select id from projects where created_by = auth.uid())
  );

create policy "update project documents" on documents
  for update using (
    project_id in (select id from projects where created_by = auth.uid())
  );

create policy "delete project documents" on documents
  for delete using (
    project_id in (select id from projects where created_by = auth.uid())
  );

create policy "select document versions" on document_versions
  for select using (
    document_id in (
      select id from documents where project_id in (
        select id from projects where created_by = auth.uid()
      )
    )
  );

create policy "insert document versions" on document_versions
  for insert with check (created_by = auth.uid());

create policy "select files" on files
  for select using (
    project_id in (select id from projects where created_by = auth.uid())
  );

create policy "insert files" on files
  for insert with check (
    project_id in (select id from projects where created_by = auth.uid())
  );
```

---

## 기존 산출물 파일 정보

**로컬 경로**: `C:\N2_핀다AI뱅크\10.관리산출물`
**현재 프로젝트**: 핀다AI뱅크 저축은행 뱅킹시스템 구축 (프로젝트 코드: FNDB)

### 파일명 규칙
```
[프로젝트코드]-[단계코드]-[유형코드]-[번호]. [문서명]_v[버전].[확장자]
예: FNDB-01-PP-010. 사업수행계획서_v0.1.docx
```

### 폴더 구조
```
10.관리산출물/
├── 01.계획/                  ← DOCX 10개, XLSX 2개 (현재 작업 중)
│   ├── FNDB-01-PP-010. 사업수행계획서_v0.1.docx
│   ├── FNDB-01-PP-011. 사업범위기술서(WBS)_v1.2.xlsx
│   ├── FNDB-01-PP-020. 품질보증계획서_v0.1.docx
│   ├── FNDB-01-PP-030. 형상관리계획서_v0.1.docx
│   ├── FNDB-01-PP-040. 자원관리계획서_v0.1.docx
│   ├── FNDB-01-PP-050. 의사소통계획서_v0.1.docx
│   ├── FNDB-01-PP-060. 위험관리계획서_v0.1.docx
│   ├── FNDB-01-PP-070. 요구관리계획서_v0.1.docx
│   ├── FNDB-01-PP-080. 보안관리계획서_v0.1.docx
│   ├── FNDB-01-PP-090. 교육계획서_v0.1.docx
│   ├── FNDB-01-PP-100. 일정관리계획서_v0.1.docx
│   └── old/                 ← 이전 버전 보관
├── 02.실행/
│   ├── 01. 표준관리/
│   ├── 02. 범위관리/
│   ├── 03. 일정관리/
│   ├── 04. 교육관리/
│   ├── 05. 형상관리/
│   ├── 06. 품질관리/
│   ├── 07. 인력관리/
│   ├── 09. 위험관리/
│   └── 10. 보안관리/
├── 03.종료/
├── 08. 진척관리/
├── 10.사업수행계획서/
├── 11.착수보고/
└── 12.기술협상/
```

### 파일 업로드 계획 (다음 작업)
- Supabase Storage 버킷 `documents` 생성
- 파일명 자동 파싱 → 문서명, 버전, 카테고리 자동 추출
- DOCX → mammoth.js → TipTap 에디터 변환 (선택적)
- XLSX/PPTX → 원본 파일 다운로드만 지원

---

## 핵심 코드 패턴

### Auth 사용법
```tsx
import { useAuth } from '../lib/auth'

const { user, loading, signIn, signUp, signOut } = useAuth()
```

### Supabase 쿼리 패턴 (snake_case ↔ camelCase 변환 주의)
```ts
// DB 컬럼: snake_case / TS 타입: camelCase
// useProject.ts의 mapProject() 함수 참고
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('created_by', userId)
  .order('created_at', { ascending: false })
```

### AI 스트리밍 사용법
```ts
import { useAI } from '../hooks/useAI'

const { isGenerating, generatedText, generate } = useAI()
await generate('사업수행계획서', '프로젝트 설명...')
```

---

## 개발 명령어

```bash
pnpm dev          # 개발 서버 (localhost:5173)
pnpm build        # 프로덕션 빌드 (tsc -b && vite build)
pnpm preview      # 빌드 결과 미리보기
pnpm lint         # ESLint 검사
```

---

## 알려진 이슈 & 해결책

### pnpm v11 + esbuild 빌드 스크립트 차단
- **증상**: `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild`
- **해결**: `@esbuild/win32-x64@0.25.12` 직접 devDependencies에 추가됨
- **pnpm.yaml**: `onlyBuiltDependencies: [esbuild]` 설정 (현재는 불필요하나 유지)

### Supabase Publishable Key (신형 키)
- `sb_publishable_*` 형식 — @supabase/supabase-js v2.106+ 에서 지원
- `VITE_SUPABASE_ANON_KEY`에 그대로 사용

### RLS 없이는 데이터 접근 불가
- RLS 활성화 + 정책 없음 = 빈 결과 반환 (에러 아님)
- projects 정책은 생성됨, documents/files 정책은 미생성

---

## 다음 작업 상세 계획

### 1. Supabase Storage + 파일 업로드

**Supabase 대시보드 작업:**
1. Storage → New bucket → 이름: `documents`, Public: false
2. Storage Policy 추가 (인증된 사용자만 접근)

**코드 작업:**
1. `DocumentList.tsx` 완성 — 파일 업로드 UI + 목록 테이블
2. `useDocument.ts` 완성 — Supabase Storage 업로드 + files 테이블 연동
3. 파일명 파싱 유틸 — `FNDB-01-PP-010. 사업수행계획서_v0.1.docx` → `{ code, title, version, category }`

**Storage Policy SQL:**
```sql
create policy "upload files" on storage.objects
  for insert with check (
    bucket_id = 'documents' AND auth.uid() IS NOT NULL
  );

create policy "read own files" on storage.objects
  for select using (
    bucket_id = 'documents' AND auth.uid() IS NOT NULL
  );
```

### 2. DocumentList 완성
- Supabase `documents` + `files` 테이블 연동
- 컬럼: 문서명, 분류, 상태 배지, 담당자, 마감일, 버전, 파일 다운로드
- 파일 업로드 드래그앤드롭

### 3. TipTap 에디터 완성
- `src/components/editor/` 에 TipTap 컴포넌트 생성
- 확장: StarterKit + 표(Table) + 이미지
- 자동저장 (debounce 2초)
- 버전 저장 버튼 → `document_versions` INSERT

### 4. DOCX → TipTap 변환
```bash
pnpm add mammoth
```
- mammoth.js로 DOCX → HTML 추출
- HTML → TipTap setContent()

---

## MVP 완료 기준 체크리스트

- [x] 로그인 / 로그아웃 (Supabase Auth)
- [x] 프로젝트 생성 · 목록 조회
- [ ] 산출물 목록 (상태·담당자·마감일·버전 표시)
- [ ] 파일 업로드 + 원본 보관
- [ ] TipTap 에디터로 문서 작성 · 자동 저장
- [ ] DOCX → 에디터 가져오기
- [ ] 표지 설정 (로고·회사명·문서 제목)
- [ ] 버전 저장 · 이력 조회
- [ ] AI 문서 초안 생성 (스트리밍)
- [ ] AI 버전 변경 요약
- [ ] PDF 내보내기 (window.print)
- [ ] Vercel 배포 완료
