# Slack 알림 설정 가이드

> GitHub Actions로 Slack에 PR, 배포 알림 자동 전송

---

## 📋 설정 단계

### 1단계: Slack Webhook URL 생성

**Slack 워크스페이스 설정:**

1. https://api.slack.com/apps 접속
2. **"Create New App"** → **"From scratch"**
3. App name: `NEXT Hub GitHub`
4. Workspace 선택
5. **Create App**

**Incoming Webhooks 활성화:**

1. 앱 페이지 → **"Incoming Webhooks"**
2. **"Activate Incoming Webhooks"** 토글
3. **"Add New Webhook to Workspace"**
4. 채널 선택 (예: `#dev`, `#deployments`)
5. **"Allow"**
6. **Webhook URL 복사** (중요!)

```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX...
```

---

### 2단계: GitHub Secrets 설정

**GitHub Repository 설정:**

1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**
2. **"New repository secret"**
3. Name: `SLACK_WEBHOOK_URL`
4. Value: Webhook URL 붙여넣기
5. **Add secret**

---

### 3단계: 워크플로우 확인

`.github/workflows/slack-notification.yml`이 이미 생성되어 있습니다.

**트리거 이벤트:**

| 이벤트 | 알림 내용 |
|--------|---------|
| PR 생성 | 🔔 새로운 PR 알림 |
| PR 수정 | 🔄 PR 업데이트 알림 |
| PR 머지 | ✅ PR 머지 완료 알림 |
| main 푸시 | 🚀 프로덕션 배포 준비 |
| develop 푸시 | 📝 개발 브랜치 업데이트 |

---

## 🔔 알림 예시

### PR 생성 알림

```
🔔 새로운 PR
제목: feat(document): 파일 업로드 기능
작성자: @geniuschoi
브랜치: feature/document-upload → develop

설명: Supabase Storage 연동...

[PR 보기] 버튼
```

### PR 머지 알림

```
✅ PR 머지됨
제목: feat(document): 파일 업로드 기능
머지된 브랜치: feature/document-upload → develop
머지한 사람: @geniuschoi

[PR 보기] 버튼
```

### 배포 알림

```
🚀 main 브랜치 업데이트
커밋: a1b2c3d
메시지: docs: 프로젝트 문서화 완성
푸시한 사람: geniuschoi

[커밋 보기] 버튼
```

---

## 🎯 채널별 알림 분리 (선택)

여러 채널로 알림을 보내고 싶으면:

```bash
# 채널별 Webhook URL 생성
SLACK_WEBHOOK_URL          # #dev (PR, 개발)
SLACK_WEBHOOK_URL_DEPLOY   # #deployments (main, 배포)
SLACK_WEBHOOK_URL_ALERT    # #alerts (실패, 에러)
```

**GitHub Secrets에 추가:**

```
Settings → Secrets
├─ SLACK_WEBHOOK_URL
├─ SLACK_WEBHOOK_URL_DEPLOY
└─ SLACK_WEBHOOK_URL_ALERT
```

**워크플로우에서 조건부 사용:**

```yaml
- name: Deploy 알림
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  uses: slackapi/slack-github-action@v1.24.0
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL_DEPLOY }}
    payload: { ... }
```

---

## 🧪 테스트

### 수동 테스트

```bash
# 로컬에서 커밋 & 푸시
git commit -m "test: slack notification"
git push origin develop

# GitHub Actions 실행 확인
GitHub 저장소 → Actions → slack-notification
```

### Webhook 테스트

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"테스트 메시지"}' \
  YOUR_WEBHOOK_URL
```

---

## 🚨 문제 해결

### Webhook URL이 작동하지 않음

- [ ] Webhook URL이 정확한가? (복사-붙여넣기 확인)
- [ ] GitHub Secrets에 저장되었는가?
- [ ] Slack 앱이 워크스페이스에서 활성화되었는가?
- [ ] Incoming Webhooks가 활성화되었는가?

**확인:**

```bash
# Webhook URL 테스트 (로컬)
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"테스트"}' \
  https://hooks.slack.com/services/T.../B.../XXX...
```

### 알림이 안 옴

- [ ] 워크플로우 파일이 `.github/workflows/slack-notification.yml`에 있나?
- [ ] 브랜치명이 `main` 또는 `develop`인가?
- [ ] PR 이벤트가 `opened`, `synchronize`, `closed` 중 하나인가?

**로그 확인:**

```
GitHub → Actions → slack-notification → [워크플로우 실행]
  → [단계] → 로그 확인
```

---

## 📌 팁

### 1. 채널에서 Slack App 초대

Slack 채널 → **설정** → **앱 추가** → `NEXT Hub GitHub` 선택

### 2. Slack 메시지 커스터마이징

`slack-notification.yml`의 `payload` 부분을 수정하면 메시지 형식 변경 가능

```yaml
"text": "이 부분을 수정할 수 있습니다"
```

### 3. 더 많은 이벤트 추가

```yaml
on:
  pull_request:
    types: [opened, synchronize, closed, reopened]
  push:
    branches: [main, develop]
  issues:        # Issue 생성 시
    types: [opened]
  release:       # Release 생성 시
    types: [published]
```

---

## 📚 참고

- [Slack API Documentation](https://api.slack.com/messaging/webhooks)
- [GitHub Actions Slack Integration](https://github.com/slackapi/slack-github-action)
- [Slack Message Formatting](https://api.slack.com/messaging/composing/layouts)

---

## ✅ 완료 체크리스트

- [ ] Slack Webhook URL 생성
- [ ] GitHub Secrets에 `SLACK_WEBHOOK_URL` 추가
- [ ] 워크플로우 파일 확인 (`.github/workflows/slack-notification.yml`)
- [ ] 테스트 PR 생성 (Slack 알림 확인)
- [ ] 팀원들에게 공유

완료되면 모든 PR과 배포가 Slack에 자동으로 알림됩니다! 🎉
