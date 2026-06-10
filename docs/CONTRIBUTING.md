# 기여 가이드 (CONTRIBUTING)

> NEXT Hub 프로젝트에 기여하는 방법

---

## 🎯 기여의 종류

### 🐛 버그 리포트

버그를 발견했나요? Issue를 생성해주세요.

**템플릿:**
```markdown
## 버그 설명
[간단하고 명확한 설명]

## 재현 단계
1. ...
2. ...
3. ...

## 예상 동작
[예상되는 동작]

## 실제 동작
[실제 발생한 동작]

## 환경
- OS: [e.g., macOS, Windows]
- 브라우저: [e.g., Chrome, Safari]
- Node 버전: [e.g., 18.0.0]

## 스크린샷
[있으면 첨부]
```

### ✨ 기능 요청

새로운 기능을 제안하고 싶다면 Discussion을 시작해주세요.

**템플릿:**
```markdown
## 기능 설명
[기능에 대한 상세 설명]

## 문제점
[이 기능이 해결할 문제]

## 제안하는 솔루션
[기능이 작동하는 방식]

## 대안
[고려한 다른 솔루션]
```

### 💬 문서 개선

오타, 불명확한 설명, 빠진 내용을 발견했다면:
1. 직접 PR로 수정 제출, 또는
2. Issue로 보고

---

## 🚀 코드 기여 프로세스

### 0️⃣ 사전 준비

```bash
# 저장소 포크 (선택)
# GitHub: Fork 버튼 클릭

# 클론
git clone https://github.com/YOUR_USERNAME/n2Hub.git
cd n2Hub

# 업스트림 추가 (선택)
git remote add upstream https://github.com/the-next-team/n2Hub.git
```

### 1️⃣ 개발 브랜치 생성

```bash
# develop 최신 코드
git checkout develop
git pull origin develop

# 기능 브랜치 생성
git checkout -b feature/your-feature-name
```

**브랜치명 규칙:**
```
feature/document-upload    ✅ Good
feature/fix-auth-bug       ✅ Good
feature/add-ai-summary     ✅ Good

feature/xxx                ❌ Too vague
feature/something          ❌ Too generic
FEATURE/MY_FEATURE         ❌ Wrong case
```

### 2️⃣ 코드 작성

**코딩 스타일:**

```typescript
// ✅ 좋은 예

// 명확한 함수명
async function uploadDocumentFile(file: File): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(`${Date.now()}-${file.name}`, file);
    
  if (error) throw new Error(error.message);
  return data.path;
}

// 타입 안전
interface DocumentUploadProps {
  projectId: string;
  onSuccess: (path: string) => void;
  onError: (error: Error) => void;
}

// 적절한 에러 처리
try {
  const path = await uploadDocumentFile(file);
  onSuccess(path);
} catch (error) {
  onError(error as Error);
}
```

```typescript
// ❌ 나쁜 예

// 모호한 함수명
function upload(f) {
  // 구현...
}

// any 타입 회피
function process(data: any) {
  return data.something;
}

// 에러 처리 무시
const result = await uploadFile(file);
```

**주요 원칙:**

- **TypeScript**: 모든 코드는 `noImplicitAny` 통과
- **컴포넌트**: 함수형 + React Hooks
- **상태 관리**: React Context (필요시 추가)
- **스타일**: Tailwind CSS 사용 (자체 CSS 금지)
- **주석**: 필요한 부분만 (WHY, not WHAT)
- **테스트**: 중요 로직에 유닛 테스트 (예정)

### 3️⃣ 커밋

```bash
git add src/pages/DocumentList.tsx
git commit -m "feat(document): 파일 업로드 UI 추가"
```

**커밋 메시지:**
- [Conventional Commits](https://www.conventionalcommits.org) 따르기
- 영문 사용
- 과거형 금지 ("add" not "added")

```
feat(scope): 간단한 설명

상세 설명 (필요시)
- 포인트 1
- 포인트 2

Closes #123
```

### 4️⃣ PR 생성

```bash
git push -u origin feature/your-feature-name
```

**GitHub에서:**

1. "Compare & pull request" 버튼 클릭
2. Base: `develop`, Compare: `feature/your-feature-name`
3. 제목: Conventional Commits 형식
   ```
   feat(document): 파일 업로드 기능
   ```
4. 설명 작성:
   ```markdown
   ## 변경 사항
   - 파일 업로드 UI 구현
   - Storage 통합 로직 추가
   - 에러 처리 추가
   
   ## 스크린샷 / 링크
   [로컬에서 테스트한 스크린샷]
   
   ## 체크리스트
   - [x] 로컬에서 테스트
   - [x] TypeScript 에러 없음
   - [x] Lint 통과
   - [x] 커밋 메시지 형식 준수
   
   Closes #15
   ```
5. Reviewers: AI 리뷰어 추가
6. "Create pull request" 클릭

### 5️⃣ 리뷰 및 수정

리뷰어 피드백에 따라 코드 수정:

```bash
# 수정 후
git add .
git commit -m "fix: 코드 리뷰 피드백 반영"
git push origin feature/your-feature-name
```

### 6️⃣ 승인 및 머지

리뷰어 승인 후:

1. GitHub에서 "Squash and merge" 또는 "Create a merge commit"
2. 브랜치 삭제 확인

로컬 정리:
```bash
git checkout develop
git pull origin develop
git branch -d feature/your-feature-name
```

---

## ✅ PR 승인 기준

### 필수 조건

- [ ] TypeScript 에러 없음
- [ ] ESLint 통과 (자동)
- [ ] 1명 이상의 리뷰어 승인
- [ ] develop 브랜치와 충돌 없음
- [ ] 커밋 메시지 형식 준수
- [ ] 기능 로컬 테스트 완료

### 추가 권장

- [ ] 단위 테스트 작성 (중요 로직)
- [ ] 문서 업데이트 (새 기능)
- [ ] 성능 영향 검토
- [ ] 보안 검토 (사용자 입력 처리)

---

## 📐 아키텍처 개선

큰 변경(아키텍처, 라이브러리 추가)은 먼저 Discussion 시작:

```markdown
## 제안
[변경 사항 설명]

## 동기
[왜 필요한가]

## 영향도
[어떤 부분에 영향을 미치는가]

## 대안
[고려한 다른 방식]
```

---

## 🔒 보안 가이드

민감한 보안 이슈는 **공개하지 말고** 직접 보고:

```
security@n2soft.co.kr로 이메일 발송
```

**GitHub Issue로 공개하면 안 됨:**
- API 키 유출 방법
- 인증 우회 방법
- 데이터 접근 취약점

---

## 📚 개발 가이드

### 파일 구조 이해

```
src/
├── lib/           ← 유틸리티, 클라이언트 설정
├── hooks/         ← Custom React Hooks
├── components/    ← 재사용 가능한 컴포넌트
├── pages/         ← 페이지 컴포넌트
├── types/         ← TypeScript 타입 정의
└── utils/         ← 함수 유틸리티
```

### 새 기능 추가 체크리스트

```typescript
// 1. 타입 정의 추가
// src/types/index.ts
interface NewFeature {
  id: string;
  name: string;
}

// 2. 커스텀 훅 작성
// src/hooks/useNewFeature.ts
export function useNewFeature() {
  // ...
}

// 3. 컴포넌트 작성
// src/components/NewFeature.tsx
export function NewFeature() {
  const { data } = useNewFeature();
  return <div>{data.name}</div>;
}

// 4. 페이지에 통합
// src/pages/SomePage.tsx
import { NewFeature } from '@/components/NewFeature';

// 5. 라우트 추가
// src/App.tsx
<Route path="/new-feature" element={<NewFeature />} />

// 6. Sidebar 네비 추가
// src/components/layout/Sidebar.tsx
<NavLink to="/new-feature">New Feature</NavLink>
```

### Supabase 통합

```typescript
// 1. DB 스키마 먼저 설계
// Supabase SQL Editor에서 CREATE TABLE

// 2. 타입 생성
// src/types/index.ts
interface NewEntity {
  id: string;
  created_at: string;
}

// 3. 훅 작성
// src/hooks/useNewEntity.ts
export function useNewEntity() {
  const { user } = useAuth();
  
  const fetchEntities = async () => {
    const { data, error } = await supabase
      .from('new_entity')
      .select('*')
      .eq('created_by', user?.id);
    return { data, error };
  };

  return { fetchEntities };
}

// 4. RLS 정책 추가
// Supabase: [테이블명] → Authentication → Policies
```

---

## 🧪 테스트

### 수동 테스트 (현재)

각 PR은 로컬에서 수동 테스트 완료:

```bash
pnpm dev
# 브라우저에서 기능 테스트
# 1. 정상 케이스
# 2. 엣지 케이스
# 3. 에러 케이스
```

### 자동 테스트 (예정)

```bash
pnpm test
# 작성되면 추가 예정
```

---

## 📖 문서 작성

### README 수정

새 기능이나 스크린샷을 추가했다면:
```bash
# 1. README.md 업데이트
# 2. 필요시 docs/ 폴더에 상세 문서 추가
```

### 코드 주석

최소한만 작성 (WHY, not WHAT):

```typescript
// ❌ 불필요한 주석
const name = user.name; // user의 이름을 변수에 저장

// ✅ 필요한 주석
// Supabase RLS가 계정별 데이터를 필터링하므로
// created_by 체크는 불필요하지만 명시성을 위해 유지
const query = supabase
  .from('documents')
  .select('*')
  .eq('created_by', userId);
```

---

## 🆘 도움 받기

### 질문하기

1. **GitHub Discussions**: 설계 질문, 개념 설명
2. **GitHub Issues**: 버그 리포트, 기능 요청
3. **Slack** (팀원): 빠른 피드백 필요시

### 처음 기여하는 경우

```
1. 이 가이드 읽기 ✓
2. DEVELOPMENT.md로 개발 환경 구축 ✓
3. 작은 기능부터 시작 (버그 수정 등)
4. 리뷰어 피드백 받으며 학습
```

---

## 🙏 감사합니다!

당신의 기여는 NEXT Hub를 더 좋게 만들고 있습니다! 🎉

---

## 📋 추가 리소스

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 개발 환경
- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Git 가이드
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 기술 아키텍처
- [/GIT_FLOW.md](../GIT_FLOW.md) - 빠른 참조
