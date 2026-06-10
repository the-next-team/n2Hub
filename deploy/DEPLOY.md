# NEXT Hub 서버 배포 가이드

> ✅ **2026-06-10 배포 완료** — http://211.191.65.14:8091

---

## 현재 배포 상태

| 항목 | 값 |
|------|-----|
| 서버 | n2dev2 (211.191.65.14, Rocky Linux 9.7) |
| 계정 | n2soft (docker 그룹 — sudo 불필요) |
| 접속 URL | **http://211.191.65.14:8091** |
| 배포 경로 | `/home/n2soft/n2hub/dist` |
| 컨테이너 | `n2hub` (nginx:alpine, `--restart unless-stopped`) |
| OnlyOffice | 같은 서버 8090 포트 (별도 컨테이너) |
| SSH 키 | `%USERPROFILE%\.ssh\n2hub_deploy` (Windows 개발 PC) |

---

## 새 버전 배포 (반복 작업)

개발 PC PowerShell에서 3줄:

```powershell
npx vite build
ssh -i "$env:USERPROFILE\.ssh\n2hub_deploy" n2soft@211.191.65.14 "rm -rf ~/n2hub/dist"
scp -r -i "$env:USERPROFILE\.ssh\n2hub_deploy" dist n2soft@211.191.65.14:~/n2hub/
ssh -i "$env:USERPROFILE\.ssh\n2hub_deploy" n2soft@211.191.65.14 "chmod -R a+rX ~/n2hub/dist && docker restart n2hub"
```

> ⚠️ 마지막 `docker restart n2hub` 필수 — 마운트된 dist를 rm으로 지우고 새로 만들면
> 컨테이너가 삭제된 옛 폴더(inode)를 계속 바라봐서 403이 남. 재시작하면 새 폴더로 재마운트됨.

⚠️ `pnpm build`는 기존 TypeScript 오류로 실패함 → `npx vite build` 사용 (타입검사 생략)
⚠️ zip 업로드 금지 — PowerShell `Compress-Archive`는 백슬래시 경로라서 Linux unzip 깨짐. `scp -r` 사용.

---

## 컨테이너 관리

```bash
# 상태 확인
docker ps --filter name=n2hub

# 로그
docker logs n2hub --tail 50

# 재시작 (설정 파일 nginx-n2hub.conf 수정 시 필요)
docker restart n2hub

# 완전 재생성
docker rm -f n2hub
docker run -d --name n2hub --restart unless-stopped -p 8091:80 \
  -v ~/n2hub/dist:/usr/share/nginx/html:ro \
  -v ~/n2hub/nginx-n2hub.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
```

---

## 주의사항

- **https로 바꾸지 말 것**: OnlyOffice가 http(8090)라서 NEXT Hub를 https로 서빙하면 mixed content 차단됨
- `.env.local` 값(Supabase 키, OnlyOffice 주소)은 빌드 시점에 포함 → 변경 시 재빌드 필요
- 파일 권한: 업로드 후 `chmod -R a+rX` 필수 (컨테이너 nginx가 uid 101로 읽음)
