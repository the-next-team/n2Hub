# n2Hub 서버 배포 가이드 (211.191.65.29)

> MobaXterm SSH 접속 기준. OnlyOffice가 이미 떠 있는 서버에 n2Hub를 8091 포트로 추가 배포.

---

## 1단계. 빌드 결과물 업로드 (Windows PC에서)

MobaXterm으로 서버 접속 후, **왼쪽 SFTP 파일 탐색기**를 이용해 드래그&드롭:

| 올릴 것 (로컬) | 서버 위치 |
|---------------|----------|
| `C:\Users\simba\eclipse-workspace\n2Hub\dist\` 폴더 전체 | `/opt/n2hub/dist/` |
| `C:\Users\simba\eclipse-workspace\n2Hub\deploy\nginx-n2hub.conf` | `/opt/n2hub/nginx-n2hub.conf` |

서버에서 폴더 먼저 생성:
```bash
sudo mkdir -p /opt/n2hub
sudo chmod 777 /opt/n2hub   # 업로드 편의용 (업로드 후 원복 가능)
```

---

## 2단계. Docker로 nginx 실행 (권장 — OnlyOffice도 Docker라면 이 방법)

```bash
# Docker 설치 확인
docker --version

# n2Hub 컨테이너 실행 (8091 포트)
docker run -d \
  --name n2hub \
  --restart unless-stopped \
  -p 8091:80 \
  -v /opt/n2hub/dist:/usr/share/nginx/html:ro \
  -v /opt/n2hub/nginx-n2hub.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
```

- `--restart unless-stopped` → 서버 재부팅해도 자동 시작
- 완료 후 접속: **http://211.191.65.29:8091**

### 새 버전 배포할 때 (이후 반복 작업)
```bash
# 1. 로컬에서 npx vite build
# 2. MobaXterm으로 dist/ 폴더 덮어쓰기 업로드
# 3. 끝 (컨테이너 재시작 불필요 — 정적 파일이라 즉시 반영)
```

---

## 2단계 (대안). Docker가 없다면 — 시스템 nginx

```bash
# nginx 설치 (Ubuntu/Debian)
sudo apt update && sudo apt install -y nginx

# 설정 복사 (listen 포트를 8091로 수정해야 함)
sudo cp /opt/n2hub/nginx-n2hub.conf /etc/nginx/conf.d/n2hub.conf
sudo sed -i 's/listen 80;/listen 8091;/' /etc/nginx/conf.d/n2hub.conf
sudo sed -i 's|/usr/share/nginx/html|/opt/n2hub/dist|' /etc/nginx/conf.d/n2hub.conf

# 문법 검사 후 적용
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3단계. 방화벽 확인

```bash
# 8091 포트 열기 (ufw 사용 시)
sudo ufw allow 8091/tcp

# firewalld 사용 시
sudo firewall-cmd --permanent --add-port=8091/tcp && sudo firewall-cmd --reload
```

---

## 4단계. 동작 확인 체크리스트

- [ ] `http://211.191.65.29:8091` 접속 → 로그인 화면
- [ ] 로그인 → 대시보드 표시
- [ ] `/projects/...` 경로에서 **F5 새로고침** → 404 안 나면 SPA fallback 정상
- [ ] 문서 클릭 → OnlyOffice 미리보기 정상
- [ ] 문서 편집 → 저장 → 재진입 시 반영 확인

---

## 주의사항

- **https로 바꾸지 말 것** (당분간): OnlyOffice가 http(8090)라서 n2Hub를 https로 서빙하면 브라우저가 mixed content로 차단함. 둘 다 http거나 둘 다 https여야 함.
- `.env.local` 값(Supabase 키 등)은 빌드 시점에 dist 안에 포함됨. 환경변수 바꾸면 재빌드 필요.
- `dist/`는 git에 커밋하지 않음 (빌드 산출물).
