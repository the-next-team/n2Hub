# 배포 및 운영 가이드

> n2Hub 프로덕션 배포, 모니터링, 운영 절차

---

## 🚀 배포 전략

### 배포 환경

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│ Local    │ →   │ Vercel       │ →   │ Supabase │
│ develop  │     │ Staging/Prod │     │ (Shared) │
└──────────┘     └──────────────┘     └──────────┘
```

| 환경 | 위치 | 브랜치 | DB | 배포 |
|------|------|--------|-----|------|
| 로컬 | 개인 PC | develop | 로컬/스테이징 | - |
| 스테이징 | Vercel | develop | Supabase | 자동 |
| 프로덕션 | Vercel | main | Supabase | 수동 |

### 배포 프로세스

```
Feature 개발 (develop)
  ↓
PR → AI 리뷰 → 승인 → Merge to develop
  ↓
자동 배포 (Vercel Staging)
  ↓
통합 테스트 완료
  ↓
Release PR: develop → main
  ↓
AI 리뷰 → 승인 → Merge to main
  ↓
자동 배포 (Vercel Production)
  ↓
모니터링 & 운영
```

---

## 📦 Vercel 배포

### 초기 설정

#### 1단계: Vercel 계정 생성

```bash
npm install -g vercel
vercel login
```

#### 2단계: 프로젝트 연결

```bash
# 프로젝트 루트에서
vercel
```

프롬프트:
```
? Set up and deploy "n2Hub"? [Y/n] y
? Which scope do you want to deploy to? (your-team)
? Link to existing project? [y/N] N
? What's your project's name? n2Hub
? In which directory is your code? ./
? Want to modify these settings? [y/N] N
```

#### 3단계: 환경변수 설정

**Vercel Dashboard → Settings → Environment Variables**

```
VITE_SUPABASE_URL=https://lakiodyzpecidhmadbgy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_ANTHROPIC_API_KEY=sk-ant-... (선택)
```

**각 환경별:**
- Development: 로컬 테스트용
- Preview: PR 미리보기
- Production: 실제 서비스

### 배포 설정 (vercel.json)

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "vite",
  "env": {
    "VITE_SUPABASE_URL": "@vite_supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@vite_supabase_anon_key"
  }
}
```

### 배포 트리거

#### 자동 배포

```
develop 브랜치에 푸시 → Vercel이 자동으로 빌드 및 배포
  ↓ Vercel Staging으로 배포
  ↓ https://n2hub-staging.vercel.app

main 브랜치에 푸시 → Vercel이 자동으로 빌드 및 배포
  ↓ Vercel Production으로 배포
  ↓ https://n2hub.vercel.app (또는 커스텀 도메인)
```

#### 수동 배포

```bash
# Staging 배포
vercel --prod=false

# Production 배포
vercel --prod

# 특정 커밋으로 배포
vercel --target=production
```

### PR 미리보기

PR을 생성하면 Vercel이 자동으로:
1. 빌드
2. Preview URL 생성
3. PR 코멘트에 링크 추가

```
✅ Preview: https://n2hub-pr-15.vercel.app
```

---

## 🗄 Supabase 운영

### 데이터베이스 마이그레이션

#### 1단계: 스키마 변경 (SQL Editor)

```sql
-- Supabase Dashboard → SQL Editor
ALTER TABLE documents ADD COLUMN tags text[];
```

#### 2단계: 로컬에서 테스트

```bash
pnpm dev
# 새 컬럼 사용 가능한지 확인
```

#### 3단계: 모든 환경에 자동 반영

Supabase는 모든 연결된 앱(Local, Staging, Prod)에서 같은 DB를 사용하므로 SQL 변경사항이 즉시 반영됩니다.

### 백업 & 복구

**자동 백업:**
- Supabase Pro 이상: 매일 자동 백업
- Free 플랜: 수동 백업만 가능

**수동 백업:**

```bash
Supabase Dashboard → Database → Backups → Create backup
```

**복구:**

```bash
Supabase Dashboard → Database → Backups → [선택] → Restore
```

### 실시간 모니터링

**Supabase Dashboard:**

```
Database → Monitoring
├─ Query Performance
├─ Connection Count
├─ Storage Usage
└─ Auth Usage
```

---

## 📊 모니터링 & 로깅

### Vercel Analytics

**Dashboard:** https://vercel.com/dashboard

```
n2Hub → Analytics
├─ Response Time (평균 응답 시간)
├─ Status Codes (200, 404, 500 등)
├─ Bandwidth (데이터 전송량)
└─ Visitors (방문자 수)
```

### Browser Console 에러

```typescript
// src/lib/logger.ts (선택)
export function setupErrorTracking() {
  window.addEventListener('error', (event) => {
    console.error('[ERROR]', event.error);
    // 선택: 외부 에러 추적 서비스로 전송
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UNHANDLED PROMISE]', event.reason);
  });
}
```

### Supabase 쿼리 모니터링

```sql
-- Supabase Dashboard → SQL Editor
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🔐 보안 체크리스트

### 배포 전

- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있나?
- [ ] API 키가 하드코딩되지 않았나?
- [ ] TypeScript 에러가 모두 해결되었나?
- [ ] XSS 취약점 없나? (user input 검증)
- [ ] SQL injection 없나? (Supabase RLS 정책 확인)
- [ ] CORS 정책 올바른가?

### 운영 중

- [ ] 에러 로그 매일 확인?
- [ ] API 호출 권한 정상?
- [ ] RLS 정책이 의도대로 작동?
- [ ] 민감한 데이터 노출 없나?

### Supabase 보안

**API 키 관리:**

```
Supabase Dashboard → Project Settings → API Keys

├─ Publishable Key (sb_publishable_*)
│  └─ 브라우저에서 사용 안전 (RLS로 보호)
│
└─ Secret Key (sb_secret_*)
   └─ 백엔드만 사용 (브라우저에 노출 금지)
```

**RLS 활성화 확인:**

```
Supabase Dashboard → [테이블명] → Authentication

□ RLS Enabled? ✓ (필수)
□ Policies exist? ✓ (필수)
```

---

## 🆘 문제 해결

### 배포 실패

**Vercel 빌드 로그 확인:**

```bash
vercel logs
```

**일반적인 원인:**

```
1. 환경변수 누락
   → Vercel Settings → Environment Variables 확인

2. 빌드 스크립트 오류
   → pnpm build 로컬에서 실행 확인

3. TypeScript 에러
   → pnpm lint 확인

4. 의존성 누락
   → package.json 확인, pnpm install 재실행
```

### 런타임 에러

**브라우저 콘솔:**

```
F12 → Console 탭에서 에러 메시지 확인
```

**Supabase 권한 에러:**

```
"new row violates row-level security policy"
→ RLS 정책 확인 (Supabase Dashboard)
```

**API 요청 실패:**

```
Network 탭에서 요청 상태 확인
→ 403: 권한 없음 (RLS)
→ 404: 테이블/엔드포인트 없음
→ 500: 서버 에러 (Supabase 상태 확인)
```

### 성능 저하

**원인:**

```
1. 느린 쿼리
   → SELECT * FROM large_table (인덱스 추가)

2. 이미지 최적화 부족
   → WebP 형식, 크기 최적화

3. 번들 사이즈 큼
   → npm install --save-dev bundlesize로 분석
```

---

## 📈 성능 최적화

### 빌드 최적화

```bash
# 번들 분석
pnpm build --report
```

### 런타임 최적화

```typescript
// 1. Code Splitting (라우트별)
const DocumentEditor = lazy(() => import('../pages/DocumentEditor'));

// 2. 메모이제이션
const MemoizedList = React.memo(DocumentList);

// 3. 쿼리 최적화
// SELECT * 대신 필요한 컬럼만
.select('id, title, status')

// 4. 캐싱 (추후 TanStack Query)
// const { data } = useQuery({ queryKey: [...], staleTime: 5 * 60 * 1000 });
```

---

## 🔄 배포 체크리스트

### Pre-Deployment (배포 전 48시간)

- [ ] 모든 기능 로컬에서 테스트 완료
- [ ] Staging에서 통합 테스트 완료
- [ ] 성능 테스트 (로딩 시간, 번들 사이즈)
- [ ] 보안 스캔 (민감한 정보 노출 여부)
- [ ] 문서 업데이트 (CHANGELOG, README)

### Deployment (배포 날)

- [ ] main 브랜치 최신 상태 확인
- [ ] Vercel 빌드 상태 모니터링
- [ ] Production 배포 완료 확인
- [ ] 스모크 테스트 (로그인 → 프로젝트 생성 → 문서 조회)
- [ ] 에러 로그 확인

### Post-Deployment (배포 후 24시간)

- [ ] Vercel 분석 데이터 확인
- [ ] 사용자 피드백 수집
- [ ] 에러 로그 모니터링
- [ ] 성능 지표 확인
- [ ] 롤백 계획 준비 (필요시)

---

## 🔙 롤백

### 긴급 롤백 (프로덕션 장애)

```bash
# 1. 이전 커밋으로 되돌리기
git revert <broken-commit>
git push origin main

# 2. Vercel이 자동으로 배포
# (또는 수동으로)
vercel --prod

# 3. Supabase 백업에서 복구 (필요시)
# Supabase Dashboard → Database → Backups → Restore
```

### PR 롤백

```bash
# 1. develop에 푸시된 커밋 제거
git revert <commit>
git push origin develop

# 2. Vercel Staging 자동 배포 취소 및 재배포
```

---

## 📚 참고 자료

- [Vercel Deployment Guide](https://vercel.com/docs/concepts/deployments/overview)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [React Performance](https://react.dev/reference/react/lazy)
- [Web Vitals](https://web.dev/vitals/)

---

## 📞 운영 팀 연락처

| 역할 | 담당자 | 연락처 |
|------|--------|-------|
| DevOps | - | - |
| DB Admin | - | - |
| 보안 | - | - |
| 모니터링 | - | - |

---

## 📋 운영 일정

### 정기 점검

| 주기 | 항목 |
|------|------|
| 매일 | 에러 로그 확인 |
| 주 1회 | 성능 지표 분석 |
| 월 1회 | 보안 감시 로그 확인 |
| 분기 1회 | DB 최적화 (인덱스, 통계) |
| 연 1회 | 보안 감사 |

### 백업 일정

- 자동 백업: 매일 (Pro 이상)
- 수동 백업: 주 1회
- 복구 테스트: 월 1회

---

<div align="center">

**n2Hub 운영팀이 항상 준비하고 있습니다.** 🚀

</div>
