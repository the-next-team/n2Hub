# Git 워크플로우 상세 가이드

> Git Flow 기반의 협업 워크플로우 및 모범 사례

---

## 📊 브랜치 전략

### 브랜치 구조

```
main (프로덕션)
  ↑
  └─ PR (승인 필수)
  
develop (개발/통합)
  ↑
  ├─ feature/* (기능 개발)
  ├─ bugfix/* (버그 수정)
  └─ hotfix/* (긴급 패치)
```

### 브랜치 목적

| 브랜치 | 목적 | 언제 | 누가 |
|--------|------|------|------|
| `main` | 배포 가능한 프로덕션 코드 | 릴리스 때 | 리드 |
| `develop` | 다음 릴리스 통합 브랜치 | 매일 | 모두 |
| `feature/*` | 새 기능 개발 | 기능 단위 | 개발자 |
| `bugfix/*` | 버그 수정 | 버그 발견 시 | 개발자 |
| `hotfix/*` | 긴급 프로덕션 패치 | 긴급 시 | 리드 |

---

## 🚀 작업 흐름

### 1️⃣ 새 기능 개발 시작

```bash
# Step 1: develop 브랜치 최신 코드 받기
git checkout develop
git pull origin develop

# Step 2: 기능 브랜치 생성
git checkout -b feature/document-upload
# 브랜치명 규칙: feature/{kebab-case-feature-name}

# Step 3: 코드 작성 (선택사항: 여러 커밋)
echo "파일 수정" > src/pages/DocumentList.tsx
git add src/pages/DocumentList.tsx
git commit -m "feat(document): 파일 업로드 UI 추가"

# Step 4: 브랜치 푸시
git push -u origin feature/document-upload
# -u: 원격 브랜치 추적 설정 (다음부터 git push만 해도 됨)
```

### 2️⃣ PR 생성 및 코드 리뷰

**GitHub 웹 인터페이스:**

1. **PR 생성** 클릭
2. **Base**: `develop`, **Compare**: `feature/document-upload`
3. **PR 제목**: `feat(document): 파일 업로드 기능 추가`
4. **설명** 작성:
   ```markdown
   ## 변경 사항
   - DocumentList.tsx에 파일 업로드 UI 추가
   - useDocument.ts 훅에 Storage 업로드 로직 구현
   - 파일명 파싱 유틸 작성
   
   ## 체크리스트
   - [x] 로컬에서 테스트 완료
   - [x] 린트 통과
   - [ ] 단위 테스트 작성 (선택)
   
   Closes #15
   ```
5. **Reviewers** 추가: AI 리뷰어 선택
6. **Create Pull Request** 클릭

### 3️⃣ 리뷰 및 수정

**리뷰어 피드백:**
```
이 부분은 이렇게 개선하면 좋을 것 같습니다...
```

**코드 수정:**
```bash
# feature 브랜치에서 피드백 반영
git checkout feature/document-upload

# 코드 수정 후
git add .
git commit -m "fix: 피드백 반영 — 에러 처리 개선"
git push origin feature/document-upload
# (자동으로 PR에 반영됨)
```

### 4️⃣ 승인 및 머지

**PR 승인 후 (GitHub):**

1. **Squash and merge** 또는 **Create a merge commit** 선택
2. 머지 메시지 확인 후 **Confirm merge**
3. **Delete branch** (원격 브랜치 삭제)

**로컬 정리:**
```bash
# develop으로 전환
git checkout develop
git pull origin develop

# 로컬 feature 브랜치 삭제
git branch -d feature/document-upload

# (Optional) 모든 추적 안 되는 브랜치 삭제
git fetch origin --prune
```

---

## 🔧 일반적인 시나리오

### 시나리오 1: 버그 수정

```bash
# 1. develop에서 bugfix 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b bugfix/auth-redirect-loop

# 2. 버그 수정
# src/lib/auth.tsx 수정...
git add .
git commit -m "fix(auth): 무한 리다이렉트 루프 해결"

# 3. PR 생성 & 머지
git push -u origin bugfix/auth-redirect-loop
# GitHub에서 PR 생성 → 승인 → 머지

# 4. 정리
git checkout develop
git pull origin develop
git branch -d bugfix/auth-redirect-loop
```

### 시나리오 2: 긴급 프로덕션 패치

```bash
# ⚠️ hotfix는 main에서 시작!
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-bug

# 긴급 패치 적용
git commit -m "hotfix: 심각한 인증 버그 해결"

# 1️⃣ main에 PR 생성
git push origin hotfix/critical-auth-bug
# GitHub: PR → main ← hotfix/critical-auth-bug

# 2️⃣ develop에도 역방향 PR 생성
git checkout develop
git pull origin develop
git merge origin/hotfix/critical-auth-bug
# (또는 GitHub에서 PR 생성)
git push origin develop
```

### 시나리오 3: feature 브랜치가 오래된 경우

```bash
# develop 최신 코드 반영
git checkout feature/your-feature
git fetch origin

# Rebase (권장: 선형 히스토리)
git rebase origin/develop
# 충돌 시: 해결 → git add . → git rebase --continue

# 또는 Merge (선택)
git merge origin/develop

# 푸시 (rebase 후 필요)
git push -f origin feature/your-feature
```

### 시나리오 4: 커밋 실수 수정

```bash
# 마지막 커밋 메시지 수정
git commit --amend -m "수정된 메시지"

# 마지막 커밋 취소 (커밋 내용 유지)
git reset --soft HEAD~1
# 수정 후
git add .
git commit -m "수정된 커밋"

# 마지막 커밋 완전 취소
git reset --hard HEAD~1

# 이미 푸시한 경우
git push -f origin feature/your-feature
```

### 시나리오 5: develop에 실수로 직접 커밋한 경우

```bash
# 커밋 되돌리기
git reset --soft HEAD~1

# feature 브랜치 생성
git checkout -b feature/fix-something

# feature에서 커밋
git add .
git commit -m "feat: 기능명"

# develop 초기화
git checkout develop
git reset --hard origin/develop

# 계속 진행
git push origin feature/fix-something
```

---

## 📝 커밋 메시지 규칙

### Conventional Commits 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 목록

```
feat      새 기능
fix       버그 수정
docs      문서 작성/수정
style     코드 스타일 (포맷팅, 세미콜론 등)
refactor  리팩토링 (기능 변화 없음)
perf      성능 개선
test      테스트 추가/수정
chore     빌드, 의존성, 설정 변경
ci        CI/CD 설정 변경
```

### Scope (선택)

기능 영역을 명시:
```
auth      인증 관련
document  문서 관련
storage   파일 저장소
ui        UI/컴포넌트
api       API 통합
```

### 예시

#### ✅ 좋은 예

```
feat(document): Supabase Storage 파일 업로드 기능

- DocumentList.tsx에 드래그앤드롭 UI 추가
- useDocument.ts 훅에 Storage 업로드 로직 추가
- 파일명 파싱 유틸 함수 작성
- 에러 처리 및 진행률 표시 추가

Closes #15
```

```
fix(auth): 로그인 후 대시보드 리다이렉트 실패

다시 로그인 요청 받는 문제 해결.
AuthProvider의 useEffect 의존성 배열 수정.

Related: #42
```

```
refactor(hooks): useProject 훅 최적화

불필요한 상태 업데이트 제거하고
로직을 더 선명하게 구성.
```

#### ❌ 나쁜 예

```
fix stuff              # 너무 모호함
fixed the bug          # 대문자 안 씀
docs: add readme file  # 너무 일반적

FEAT: 기능 추가
혼합된 타입들
여러 기능 섞임
```

---

## 🔗 PR 작성 체크리스트

PR을 생성하기 전에 확인:

```markdown
## 작성자 체크리스트

- [ ] develop 브랜치에서 최신 코드 반영 (`git pull origin develop`)
- [ ] 로컬에서 테스트 완료 (`pnpm dev` 후 수동 테스트)
- [ ] 린트 통과 (`pnpm lint` 또는 커밋 전 자동 린트)
- [ ] TypeScript 에러 없음 (빌드 성공)
- [ ] 불필요한 console.log 제거
- [ ] 커밋 메시지가 Conventional Commits 형식
- [ ] 관련 이슈 번호 포함 (Closes #15)
- [ ] 스크린샷 또는 링크 첨부 (UI 변경 시)

## 리뷰어 체크리스트

- [ ] 코드가 프로젝트 표준을 따름
- [ ] 보안 이슈 없음 (SQL injection, XSS 등)
- [ ] 에러 처리 적절함
- [ ] TypeScript 타입이 올바름
- [ ] 불필요한 의존성 추가 없음
- [ ] 테스트 커버리지 충분함 (선택)
```

---

## 🚨 주의사항

### ❌ 절대 금지

```bash
# 1. main에 직접 푸시
git push origin main  # ❌

# 2. develop에 force push
git push -f origin develop  # ❌ (협업 시)

# 3. 메인 브랜치에서 feature 생성
git checkout -b feature/xxx main  # ❌

# 4. PR 없이 머지
git merge feature/xxx  # ❌ (develop일 때도)
```

### ✅ 올바른 방법

```bash
# 1. 항상 develop에서 시작
git checkout develop
git pull origin develop

# 2. feature 브랜치 생성
git checkout -b feature/xxx

# 3. 작업 후 PR로 리뷰 요청
git push -u origin feature/xxx
# GitHub에서 PR 생성

# 4. 승인 후 머지
# GitHub UI에서 "Merge pull request"
```

---

## 📊 자주 쓰는 Git 명령어

### 상태 확인

```bash
git status                    # 현재 상태
git branch -a                 # 모든 브랜치 (로컬 + 원격)
git branch -vv                # 추적 정보 포함
git log --oneline -10         # 최근 10개 커밋
git log --graph --decorate    # 그래프 형식
```

### 동기화

```bash
git fetch origin              # 원격 정보 받기
git pull origin develop       # develop 최신 코드 가져오기
git push origin feature/xxx   # feature 푸시
```

### 브랜치 관리

```bash
git checkout -b feature/xxx           # 브랜치 생성 + 전환
git checkout feature/xxx              # 브랜치 전환
git branch -d feature/xxx             # 로컬 브랜치 삭제
git push origin --delete feature/xxx  # 원격 브랜치 삭제
```

### 히스토리 수정

```bash
git rebase origin/develop     # develop 최신 코드 반영
git cherry-pick <commit>      # 특정 커밋 가져오기
git reset --soft HEAD~1       # 마지막 커밋 취소 (내용 유지)
git reset --hard origin/develop  # 로컬 변경 모두 버림 (위험!)
```

---

## 🔍 충돌 해결

### 머지 충돌 (Merge Conflict)

```bash
# develop에서 최신 코드 가져오기
git pull origin develop

# 충돌 파일 확인
git status

# 충돌 부분:
<<<<<<< HEAD
내 코드
=======
다른 코드
>>>>>>> origin/develop

# 수정 후
git add .
git commit -m "merge: 충돌 해결"
git push origin feature/xxx
```

### Rebase 충돌

```bash
git rebase origin/develop

# 충돌 발생 시 수정
# 1. 충돌 파일 열기 → 수정
# 2. git add .
# 3. git rebase --continue

# 또는 취소
git rebase --abort
```

---

## 📌 모범 사례

### PR은 작고 자주

```
나쁨: 한 번에 거대한 PR (코드 리뷰 어려움)
좋음: 작은 단위의 PR을 자주 생성 (빠른 리뷰)

예시:
  하나: feature/auth (인증 전체) ❌ 너무 큼
  여러 개:
    - feature/auth-login (로그인)
    - feature/auth-signup (회원가입)
    - feature/auth-logout (로그아웃)
```

### 의미 있는 커밋 메시지

```
나쁨: "fix", "update", "modify"
좋음: "fix(auth): 로그인 후 대시보드 리다이렉트 실패 해결"

나쁨: 여러 기능을 한 커밋에
좋음: 기능별로 분리된 커밋
```

### 정기적인 동기화

```bash
# 매일 아침 develop 최신 코드 받기
git checkout feature/your-feature
git fetch origin
git rebase origin/develop
```

---

## 🆘 Git 복구

### 실수로 삭제한 커밋 복구

```bash
git reflog              # 모든 작업 이력 확인
git checkout <hash>    # 원하는 지점으로 복구
```

### 잘못된 푸시 되돌리기

```bash
# 로컬에서 이전 상태로 복구
git reset --hard <commit-hash>

# 원격에 반영 (위험 - 협업 팀에 알림)
git push -f origin feature/xxx
```

---

## 📚 참고 자료

- [GitHub Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [Conventional Commits](https://www.conventionalcommits.org)
- [Pro Git Book](https://git-scm.com/book/en/v2)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)
