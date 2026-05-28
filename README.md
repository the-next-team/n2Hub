# 🎯 n2Hub — IT 프로젝트 산출물 통합관리 플랫폼

<div align="center">

**IT 프로젝트 산출물과 이슈를 한 곳에서 관리하는 협업형 문서 자동화 플랫폼**

[![React](https://img.shields.io/badge/React-19.2.6-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4.3-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Claude API](https://img.shields.io/badge/Claude%20API-Sonnet%204.5-000000?logo=anthropic)](https://claude.ai)

[빠른 시작](#-빠른-시작) • [기술 스택](#-기술-스택) • [개발 가이드](./docs/DEVELOPMENT.md) • [Git 워크플로우](./docs/GIT_WORKFLOW.md)

</div>

---

## 📋 목차

- [프로젝트 소개](#프로젝트-소개)
- [주요 기능](#주요-기능)
- [기술 스택](#-기술-스택)
- [빠른 시작](#-빠른-시작)
- [프로젝트 구조](#프로젝트-구조)
- [개발 환경](#개발-환경)
- [문서](#-문서)
- [기여 가이드](#기여-가이드)
- [라이선스](#라이선스)

---

## 프로젝트 소개

**n2Hub**는 IT 프로젝트의 복잡한 산출물 관리 문제를 해결하는 통합 플랫폼입니다.

### 🎯 핵심 문제

```
일반적인 현황:
  ❌ 산출물이 여러 곳에 산재 (로컬, 이메일, 클라우드)
  ❌ 버전 관리가 수동적 (파일명에 v1, v2... 붙임)
  ❌ 변경 사항 추적 어려움 (누가, 언제, 왜 변경했나)
  ❌ 템플릿 재사용 불가능 (매번 처음부터 작성)
```

### ✨ n2Hub의 해결책

```
n2Hub를 통해:
  ✅ 모든 산출물을 한 곳에서 관리
  ✅ 자동 버전 관리 및 변경 이력 추적
  ✅ 로고/회사정보 변경 시 전체 산출물 자동 반영
  ✅ AI 초안 생성으로 작성 시간 80% 단축
  ✅ 템플릿 라이브러리로 재사용성 극대화
```

### 🏆 주요 특징

- **통합 문서 관리**: 프로젝트별 산출물 한 곳에서 관리
- **AI 기반 초안 생성**: Claude API로 자동 문서 생성
- **실시간 협업**: 동시 편집, 변경 사항 실시간 반영
- **자동 스타일 적용**: 로고·회사명·색상 변경 시 전체 산출물 자동 적용
- **완벽한 버전 관리**: 모든 변경 이력 자동 저장 및 복원 가능
- **PDF 내보내기**: 언제든 고급 서식의 PDF로 변환

---

## 주요 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| 🔐 **인증** | ✅ 완료 | Supabase 이메일 로그인/회원가입 |
| 📊 **대시보드** | ✅ 완료 | 프로젝트 통계 및 최근 활동 |
| 📁 **프로젝트 관리** | ✅ 완료 | 프로젝트 생성·편집·삭제 |
| 📄 **산출물 목록** | 🔧 진행중 | 문서 목록·상태·담당자 관리 |
| ✍️ **문서 에디터** | 🔧 진행중 | TipTap 블록 에디터 + 자동저장 |
| 📤 **파일 업로드** | 🔧 진행중 | Supabase Storage 통합 |
| 🤖 **AI 초안 생성** | ⏳ 예정 | Claude API 스트리밍 |
| 📊 **변경 요약** | ⏳ 예정 | AI로 변경 사항 자동 요약 |
| 🎨 **표지 설정** | ⏳ 예정 | 로고·회사명·색상 관리 |
| 📑 **PDF 내보내기** | ⏳ 예정 | 고급 서식 PDF 생성 |
| 🔄 **버전 관리** | ⏳ 예정 | 자동 버전 저장 및 복원 |
| 👥 **협업 권한** | ⏳ 예정 | 팀원 초대 및 권한 관리 |

---

## 🛠 기술 스택

### 프론트엔드

| 항목 | 기술 | 용도 |
|------|------|------|
| 빌드 도구 | **Vite 6.4.2** | 초고속 개발 서버 및 번들링 |
| UI 프레임워크 | **React 19.2.6** | 컴포넌트 기반 UI |
| 언어 | **TypeScript 5.9.3** | 타입 안전성 |
| 스타일링 | **Tailwind CSS v4.3** | 유틸리티 우선 CSS (설정 없이 @import만 사용) |
| 라우팅 | **React Router v7** | 중첩 라우트 기반 SPA |
| 에디터 | **TipTap 2.27.2** | ProseMirror 기반 블록 에디터 |
| 아이콘 | **lucide-react** | 일관된 아이콘 세트 |

### 백엔드 & 데이터

| 항목 | 기술 | 용도 |
|------|------|------|
| DB | **Supabase PostgreSQL** | 완전 관리형 데이터베이스 |
| 인증 | **Supabase Auth** | 이메일/소셜 인증 |
| 스토리지 | **Supabase Storage** | 파일 업로드 (DOCX, XLSX, PDF) |
| 실시간 | **Supabase Realtime** | 실시간 협업 (예정) |

### AI & LLM

| 항목 | 기술 | 용도 |
|------|------|------|
| LLM | **Claude Sonnet 4.5** | 문서 초안 생성, 변경 요약 |
| API | **Anthropic SDK** | 스트리밍 지원 |
| 구현 | **lib/anthropic.ts** | 초안 생성 + 스트리밍 UI |

### 패키지 매니저

```bash
pnpm v11.3.0
  └─ 주의: @esbuild/win32-x64 수동 설치 필요
```

---

## 🚀 빠른 시작

### 사전 요구사항

- **Node.js** 18.0 이상
- **pnpm** 11.0 이상
- **Git** (협업 시)

### 1️⃣ 저장소 클론

```bash
git clone https://github.com/the-next-team/n2Hub.git
cd n2Hub
```

### 2️⃣ 의존성 설치

```bash
pnpm install

# pnpm v11 이슈 발생 시
pnpm add -D @esbuild/win32-x64
```

### 3️⃣ 환경변수 설정

`.env.local` 파일 생성:

```bash
# Supabase
VITE_SUPABASE_URL=https://lakiodyzpecidhmadbgy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_SHnsFWTQqUlZemylzYSzCQ_nMMNWf-7

# Anthropic Claude API (선택, 백엔드에서 처리 권장)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### 4️⃣ 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 `http://localhost:5173` 열기

### 5️⃣ 프로덕션 빌드

```bash
pnpm build    # TypeScript 컴파일 + Vite 번들링
pnpm preview  # 빌드 결과 미리보기
```

---

## 프로젝트 구조

```
n2Hub/
├── README.md                    ← 프로젝트 개요 (이 파일)
├── CLAUDE.md                    ← Claude Code 컨텍스트
├── GIT_FLOW.md                  ← Git Flow 빠른 참조
│
├── docs/                        ← 📚 상세 문서
│   ├── DEVELOPMENT.md           ← 개발 환경 설정
│   ├── GIT_WORKFLOW.md          ← Git 워크플로우 상세 가이드
│   ├── CONTRIBUTING.md          ← 기여 가이드
│   ├── ARCHITECTURE.md          ← 아키텍처 및 설계
│   ├── API.md                   ← API 문서
│   └── DEPLOYMENT.md            ← 배포 가이드
│
├── src/
│   ├── main.tsx                 ← 앱 진입점
│   ├── App.tsx                  ← 라우터 + AuthProvider
│   ├── index.css                ← Tailwind CSS (@import "tailwindcss")
│   │
│   ├── lib/
│   │   ├── auth.tsx             ← AuthContext, useAuth 훅
│   │   ├── supabase.ts          ← Supabase 클라이언트
│   │   ├── anthropic.ts         ← Claude API (스트리밍)
│   │   └── pdf.ts               ← PDF 내보내기
│   │
│   ├── hooks/
│   │   ├── useProject.ts        ← 프로젝트 CRUD
│   │   ├── useDocument.ts       ← 문서 CRUD + 파일 업로드
│   │   └── useAI.ts             ← AI 스트리밍 상태 관리
│   │
│   ├── types/
│   │   └── index.ts             ← TypeScript 타입 정의
│   │
│   ├── utils/
│   │   └── index.ts             ← 유틸리티 함수
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.tsx       ← Sidebar + <Outlet>
│   │   │   └── Sidebar.tsx      ← 네비게이션
│   │   ├── ui/                  ← 재사용 가능한 UI 컴포넌트
│   │   └── editor/              ← TipTap 에디터 컴포넌트
│   │
│   └── pages/
│       ├── Login.tsx            ← 로그인/회원가입
│       ├── Dashboard.tsx        ← 대시보드
│       ├── ProjectList.tsx      ← 프로젝트 목록
│       ├── ProjectDetail.tsx    ← 프로젝트 상세
│       ├── DocumentList.tsx     ← 산출물 목록
│       ├── DocumentEditor.tsx   ← 문서 에디터
│       ├── TemplateManager.tsx  ← 템플릿 관리
│       └── Settings.tsx         ← 설정
│
├── vite.config.ts               ← Vite 설정 (@vitejs/plugin-react)
├── tsconfig.app.json            ← TypeScript 앱 설정
├── tsconfig.node.json           ← TypeScript 빌드 설정
├── package.json                 ← 프로젝트 메타데이터
├── pnpm.yaml                    ← pnpm v11 설정
└── index.html                   ← HTML 진입점
```

---

## 개발 환경

### 주요 명령어

```bash
# 개발
pnpm dev              # 개발 서버 시작 (localhost:5173)
pnpm build            # 프로덕션 빌드
pnpm preview          # 빌드 결과 미리보기
pnpm lint             # ESLint 검사

# 데이터베이스 (수동)
# Supabase 대시보드에서 SQL Editor 사용
```

### 개발 팁

- **Hot Module Replacement (HMR)**: 파일 저장 시 자동 갱신
- **Tailwind IntelliSense**: VS Code 확장 권장
- **React DevTools**: 브라우저 확장으로 디버깅
- **Supabase 대시보드**: https://app.supabase.com (DB 모니터링)

더 자세한 설정은 [DEVELOPMENT.md](./docs/DEVELOPMENT.md) 참고

---

## 📚 문서

| 문서 | 설명 |
|------|------|
| [docs/PRODUCT_ROADMAP.md](./docs/PRODUCT_ROADMAP.md) | 제품 로드맵 — 단계별 고도화 계획 |
| [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | 디자인 시스템 — 토큰·타이포·컴포넌트 규약 |
| [GIT_FLOW.md](./GIT_FLOW.md) | Git 브랜치 관리 빠른 참조 |
| [docs/GIT_WORKFLOW.md](./docs/GIT_WORKFLOW.md) | Git 워크플로우 상세 가이드 |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | 개발 환경 설정 및 팁 |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | 코드 기여 가이드 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 아키텍처 및 설계 결정 |
| [docs/API.md](./docs/API.md) | API 엔드포인트 문서 |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | 배포 및 운영 가이드 |
| [CLAUDE.md](./CLAUDE.md) | Claude Code 컨텍스트 |

---

## 기여 가이드

### 기여 프로세스

1. **develop 브랜치에서 기능 브랜치 생성**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **코드 작성 및 커밋**
   ```bash
   git add .
   git commit -m "feat: 기능명 — 상세 설명"
   ```

3. **PR 생성**
   - 베이스: `develop`
   - AI 리뷰어 추가
   - 설명: 변경 사항, 테스트, 관련 이슈 번호 포함

4. **리뷰 및 머지**
   - AI 리뷰어 승인 필수
   - develop에 머지

5. **릴리스 준비**
   - develop → main으로 PR 생성
   - 버전 태그 추가

더 자세한 사항은 [CONTRIBUTING.md](./docs/CONTRIBUTING.md) 참고

### 커밋 메시지 규칙

```
<type>(<scope>): <subject>

<body>

Closes #{이슈번호}
```

**Type**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

예:
```
feat(document-upload): Supabase Storage 파일 업로드 추가

- DocumentList.tsx에 드래그앤드롭 UI 추가
- useDocument.ts 훅 완성
- 파일명 파싱 유틸 작성

Closes #15
```

---

## 🗂 데이터베이스 스키마

### 핵심 테이블

```sql
projects              — 프로젝트 마스터
├── id, name, description, client_name, status
├── start_date, end_date
├── created_by (FK: auth.users)
└── created_at, updated_at

documents            — 산출물 문서
├── id, project_id, title, category, status
├── assignee_id (FK: auth.users)
├── due_date, current_version
└── created_at, updated_at

document_versions   — 버전 이력
├── id, document_id, version, content_json
├── change_note, created_by
└── created_at

files               — 업로드 파일
├── id, project_id, document_id
├── original_name, storage_path, mime_type, size
├── uploaded_by
└── created_at

project_members     — 팀 멤버
├── id, project_id, user_id, role
└── unique(project_id, user_id)
```

### RLS (Row Level Security)

모든 테이블에 RLS 활성화됨:
- **projects**: `created_by = auth.uid()`
- **documents**: `project_id in (created by user)`
- **files**: `project_id in (created by user)`

---

## 🚢 배포

### Vercel 배포 (예정)

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel
```

환경변수 설정:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_ANTHROPIC_API_KEY (백엔드 프록시 사용 권장)
```

더 자세한 사항은 [DEPLOYMENT.md](./docs/DEPLOYMENT.md) 참고

---

## 🐛 알려진 이슈

### pnpm v11 + esbuild 이슈
- **증상**: `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild`
- **해결**: `@esbuild/win32-x64` 수동 설치
  ```bash
  pnpm add -D @esbuild/win32-x64
  ```

### Supabase RLS 설정
- RLS 활성화 후 정책이 없으면 데이터가 반환되지 않음 (에러 아님)
- 반드시 SELECT/INSERT/UPDATE/DELETE 정책 추가 필요

---

## 📞 지원

- **문서**: [docs/](./docs/) 폴더 참고
- **이슈 리포트**: GitHub Issues
- **질문**: GitHub Discussions
- **팀 협업**: Slack (내부)

---

## 📝 라이선스

This project is proprietary software. All rights reserved.

---

## 👥 팀

- **PM**: n2soft
- **개발**: Claude Code (AI-assisted development)
- **설계**: 내부 기술팀

---

<div align="center">

**마지막 업데이트**: 2026-05-27

[위로 ↑](#-n2hub--it-프로젝트-산출물-통합관리-플랫폼)

</div>
