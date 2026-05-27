## 변경 사항

<!-- PR에서 변경한 내용을 요약하세요 -->
- 
- 

## 유형

<!-- 해당하는 유형을 선택하세요 -->
- [ ] 🎯 feat: 새 기능
- [ ] 🐛 fix: 버그 수정
- [ ] 📚 docs: 문서 작성/수정
- [ ] 🎨 style: 코드 포맷팅 (기능 변화 없음)
- [ ] ♻️ refactor: 리팩토링 (기능 변화 없음)
- [ ] ⚡ perf: 성능 개선
- [ ] ✅ test: 테스트 추가/수정
- [ ] 🔧 chore: 빌드, 의존성, 설정 변경

## 관련 이슈

<!-- 관련된 이슈 번호를 입력하세요 (선택사항) -->
Closes #<!-- 이슈 번호 -->

## 설명

<!-- 상세한 변경 사항 설명을 작성하세요 -->

## 테스트 방법

<!-- 이 PR을 어떻게 테스트했는지 설명하세요 -->
1. 
2. 
3. 

## 스크린샷 / 링크

<!-- UI 변경이 있으면 스크린샷을 첨부하세요 (선택사항) -->

## 체크리스트

<!-- 모두 완료해야 PR이 승인됩니다 -->
- [ ] 로컬에서 `pnpm dev` 실행 후 테스트 완료
- [ ] TypeScript 컴파일 에러 없음 (`pnpm build` 성공)
- [ ] ESLint 통과 (`pnpm lint` 통과)
- [ ] 커밋 메시지가 [Conventional Commits](https://www.conventionalcommits.org) 형식
- [ ] 불필요한 console.log 제거
- [ ] 문서 업데이트 필요 시 완료 (또는 "필요 없음")
- [ ] 신규 의존성 추가 시 이유 설명

## PR 규칙

### ✅ 반드시 따르세요

1. **Base 브랜치**: `develop` (긴급 핫픽스만 `main`)
2. **브랜치명**: `feature/xxx` 또는 `bugfix/xxx` 또는 `hotfix/xxx`
3. **커밋 메시지**: Conventional Commits 형식
   ```
   feat(scope): 간단한 설명
   fix(auth): 로그인 무한 루프 해결
   docs(guide): README 업데이트
   ```
4. **Reviewers**: AI 리뷰어 또는 팀 리드 추가 **필수**
5. **PR 크기**: 가능하면 작게 (큰 PR은 리뷰 어려움)

### ❌ 금지

- main에 직접 푸시 (PR 필수)
- develop에 직접 푸시 (feature 브랜치에서 PR로)
- 관련 없는 변경사항 포함
- 민감한 정보(API 키, 비밀번호) 커밋
- 테스트 없이 PR 생성

## 참고 자료

- [Git 워크플로우 가이드](../docs/GIT_WORKFLOW.md)
- [기여 가이드](../docs/CONTRIBUTING.md)
- [Conventional Commits](https://www.conventionalcommits.org)

---

💡 **팁**: PR 설명이 자세할수록 리뷰 시간이 단축됩니다!
