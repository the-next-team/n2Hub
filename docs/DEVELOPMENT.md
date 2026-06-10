# 개발 환경 설정 및 가이드

> NEXT Hub 로컬 개발 환경 구축 및 개발 팁

---

## 📋 사전 요구사항

### 필수

- **Node.js**: 18.0 LTS 이상 ([다운로드](https://nodejs.org))
- **pnpm**: 11.0 이상
  ```bash
  npm install -g pnpm
  pnpm --version
  ```
- **Git**: 2.0 이상

### 권장 도구

| 도구 | 용도 | 설명 |
|------|------|------|
| **VS Code** | 에디터 | 권장 |
| **Tailwind CSS IntelliSense** | VS Code 확장 | 클래스명 자동완성 |
| **ES7+ React Snippets** | VS Code 확장 | React 코드 스니펫 |
| **PostgreSQL Client** | DB 클라이언트 | pgAdmin 또는 DBeaver |
| **Postman** | API 테스트 | REST API 테스트용 |
| **React DevTools** | 브라우저 확장 | React 컴포넌트 디버깅 |

---

## 🚀 초기 설정

### 1단계: 저장소 클론

```bash
git clone https://github.com/the-next-team/n2Hub.git
cd n2Hub
```

### 2단계: 브랜치 전환

```bash
# develop 브랜치로 이동
git checkout develop
git pull origin develop
```

### 3단계: 의존성 설치

```bash
pnpm install
```

**pnpm v11 이슈 발생 시:**
```bash
pnpm add -D @esbuild/win32-x64
```

### 4단계: 환경변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# Supabase
VITE_SUPABASE_URL=https://lakiodyzpecidhmadbgy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_SHnsFWTQqUlZemylzYSzCQ_nMMNWf-7

# Anthropic Claude API (백엔드 프록시 권장, 데모 목적만)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

**보안 주의:**
- `.env.local`은 `.gitignore`에 포함됨 (커밋 금지)
- 실서비스는 Supabase Edge Function으로 API 호출 권장

### 5단계: 개발 서버 실행

```bash
pnpm dev
```

출력:
```
VITE v6.4.2  ready in 243 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

브라우저에서 `http://localhost:5173` 열기

---

## 💻 개발 명령어

### 개발 서버

```bash
pnpm dev        # 개발 서버 시작 (HMR 활성화)
pnpm preview    # 프로덕션 빌드 미리보기
```

### 빌드

```bash
pnpm build      # TypeScript + Vite 번들링
                # → dist/ 폴더 생성
```

### 린트 및 포맷팅

```bash
pnpm lint       # ESLint 검사
```

### 디버깅

```bash
# 개발 서버 디버깅 로그 활성화
DEBUG=* pnpm dev

# 브라우저 콘솔
F12 → Console / Sources 탭
```

---

## 🔐 Supabase 연동 가이드

### 프로젝트 정보

```
프로젝트 URL: https://lakiodyzpecidhmadbgy.supabase.co
리전: ap-northeast-2 (Seoul)
```

### 대시보드 접속

1. https://app.supabase.com 로그인
2. 프로젝트 `NEXT Hub` 선택
3. **SQL Editor** 또는 **Table Editor**에서 데이터 관리

### 자주 사용하는 작업

#### 데이터 확인

```sql
-- SQL Editor에서 실행
SELECT * FROM projects WHERE created_by = 'user_id';
SELECT * FROM documents WHERE project_id = 'project_id';
```

#### 테스트 데이터 생성

```sql
INSERT INTO projects (name, description, created_by)
VALUES ('테스트 프로젝트', '테스트용', 'your-user-id');
```

#### RLS 정책 확인

Supabase Dashboard → `[테이블명]` → **Authentication** → **Policies**

#### Storage 파일 확인

Supabase Dashboard → **Storage** → `documents` 버킷 → 업로드된 파일 목록

---

## 🖥 VS Code 설정 (권장)

### `.vscode/settings.json` 예시

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### 권장 확장 프로그램

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint",
    "dsznajder.es7-react-js-snippets",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.code-runner",
    "gruntfuggel.simple-react-snippets"
  ]
}
```

---

## 🐛 디버깅 팁

### React 컴포넌트 상태 확인

```bash
# 1. React DevTools 설치
# Chrome: https://chrome.google.com/webstore/detail/...

# 2. F12 → Components 탭에서 컴포넌트 트리 확인
```

### Supabase 네트워크 요청 확인

```bash
# 1. F12 → Network 탭
# 2. Filter: fetch

# Supabase 요청들:
# - GET /rest/v1/projects
# - POST /rest/v1/documents
# - POST /storage/v1/object/documents/...
```

### 로깅 패턴

```typescript
// src/lib/logger.ts (선택, 유틸)
export const log = {
  debug: (tag: string, data: any) => {
    if (import.meta.env.DEV) {
      console.log(`[${tag}]`, data);
    }
  },
  error: (tag: string, error: any) => {
    console.error(`[${tag}]`, error);
  }
};

// 사용
import { log } from '@/lib/logger';
log.debug('ProjectList', projects);
log.error('API', error);
```

---

## 📦 주요 라이브러리 사용법

### 인증 (useAuth)

```typescript
import { useAuth } from '@/lib/auth';

const { user, loading, signIn, signUp, signOut } = useAuth();

if (loading) return <div>로딩 중...</div>;
if (!user) return <div>로그인 필요</div>;

return <div>환영합니다, {user.email}!</div>;
```

### Supabase 쿼리

```typescript
import { supabase } from '@/lib/supabase';

// 프로젝트 조회
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('created_by', userId)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Query error:', error);
  return;
}

console.log('Projects:', data);
```

**주의: snake_case ↔ camelCase 변환**

```typescript
// DB 컬럼: created_by (snake_case)
// TS 타입: createdBy (camelCase)

// useProject.ts의 mapProject() 함수로 자동 변환
const projects = data.map(mapProject);
```

### AI 스트리밍 (useAI)

```typescript
import { useAI } from '@/hooks/useAI';

const { isGenerating, generatedText, generate } = useAI();

const handleGenerateDraft = async () => {
  await generate('사업수행계획서', '프로젝트 설명...');
  console.log('생성된 문서:', generatedText);
};

return (
  <div>
    <button onClick={handleGenerateDraft} disabled={isGenerating}>
      {isGenerating ? '생성 중...' : 'AI 초안 생성'}
    </button>
    {generatedText && <div>{generatedText}</div>}
  </div>
);
```

### Tailwind CSS (v4 with @import)

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-success: #10b981;
}
```

```tsx
// 컴포넌트에서 사용
export function Button() {
  return (
    <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
      클릭
    </button>
  );
}
```

---

## 🧪 테스트 (예정)

### 테스트 작성 구조

```typescript
// src/hooks/__tests__/useProject.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useProject } from '../useProject';

describe('useProject', () => {
  it('프로젝트 목록을 가져와야 함', async () => {
    const { result } = renderHook(() => useProject());
    
    await waitFor(() => {
      expect(result.current.projects).toBeDefined();
    });
  });
});
```

---

## 🔄 자주하는 작업

### 새 페이지 추가

```typescript
// 1. src/pages/NewPage.tsx 생성
export function NewPage() {
  return <div>새 페이지</div>;
}

// 2. src/App.tsx에 라우트 추가
<Route path="/new-page" element={<NewPage />} />

// 3. src/components/layout/Sidebar.tsx에 네비 추가
<NavLink to="/new-page">새 페이지</NavLink>
```

### 새 훅 추가

```typescript
// src/hooks/useNewFeature.ts
import { useState, useEffect } from 'react';

export function useNewFeature() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // 초기화 로직
  }, []);

  return { state };
}
```

### Tailwind 커스텀 클래스

```css
/* src/index.css */
@import "tailwindcss";

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700;
  }
}
```

---

## 🚨 자주 발생하는 문제

### 문제: "Module not found" 에러

**원인**: TypeScript 경로 alias 설정 오류

**해결**:
```json
// tsconfig.app.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### 문제: Supabase RLS 때문에 데이터가 안 보임

**원인**: RLS 정책이 없거나 잘못 설정됨

**확인**:
```sql
-- Supabase SQL Editor에서 실행
SELECT * FROM auth.users; -- 인증된 사용자 확인
SELECT * FROM projects WHERE created_by = auth.uid(); -- RLS 테스트
```

### 문제: HMR이 작동하지 않음

**해결**:
```bash
# 포트 충돌 확인
lsof -i :5173

# 개발 서버 재시작
pnpm dev --force
```

### 문제: pnpm install이 계속 실패

**해결**:
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm add -D @esbuild/win32-x64
```

---

## 📚 추가 자료

- [Vite 문서](https://vitejs.dev)
- [React 공식 가이드](https://react.dev)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [Supabase 가이드](https://supabase.com/docs)
- [TipTap 에디터 문서](https://www.tiptap.dev)

---

## 📞 도움 필요?

- **버그**: GitHub Issues에 작성
- **질문**: GitHub Discussions에 질문
- **팀 협업**: Slack #dev 채널
