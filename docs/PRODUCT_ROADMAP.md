# NEXT Hub 제품 로드맵

> IT 산출물 관리 플랫폼의 단계별 고도화 계획.
> Jira/Confluence/Notion 의 좋은 점은 취하되, "복잡함"은 의도적으로 거른다.

---

## 0. 포지셔닝 — 우리는 Jira가 아니다

Jira는 *티켓 중심*, Confluence는 *위키 중심*. NEXT Hub은 **IT 산출물(문서) 중심**이고, 태스크와 일정은 *그 산출물을 만들기 위한 작업*이다. 이 한 줄이 무엇을 만들고/안 만들지의 기준이 된다.

```
산출물(Document) ←──생성──── 태스크(Task) ←──일정──── 마일스톤
       │                          │                      │
       └────── 검토/승인 ────┐    └─ 진행률 ──┐         │
                            ↓                ↓          ↓
                       프로젝트 대시보드 (한 화면)
```

세 기둥(문서·태스크·일정)의 **연결성**이 진짜 가치다. 단독 기능보다 *세 영역을 잇는 작업*에 가중치를 둔다.

---

## 1. 단순함 라인 (의도적으로 안 만드는 것)

| 원칙 | 의미 | Jira에서 빌려오지 않을 것 |
|---|---|---|
| 한 프로젝트 = 한 WBS | 워크플로우 분기 없음 | 다중 보드 · 스윔레인 · 이슈 타입 |
| 고정 상태 흐름 | 문서 `draft → review → approved`, 태스크 `예정 → 진행 → 완료/지연` | 커스텀 워크플로우 · 상태 빌더 |
| 권한 3단계 | 소유자 / 편집 / 조회 | 권한 매트릭스 · 필드 단위 권한 |
| 진행률(%)로 시간 표현 | 작업당 진행률 한 숫자 | 타임시트 · 워크로그 |
| 한 작업 = 한 담당자 | 책임 명확 | 다중 어사이니 · 어사이니 풀 |
| 고정된 알림 규칙 | 마감 임박 · 멘션만 | 자동화 룰 빌더 |

이 라인을 넘는 기능 요청은 다른 도구(Jira)에 맞는 신호로 본다.

---

## 2. 핵심 가치 — 연결성

| 연결 | UX 표현 |
|---|---|
| 산출물 ↔ 태스크 | 태스크 상세에 "이 작업의 산출물" 섹션 · 문서 상세에 "관련 작업" |
| 태스크 ↔ 일정 | 간트 차트에서 태스크 막대 · 캘린더에 마감 |
| 산출물 ↔ 일정 | 산출물 마감(due_date) · 마일스톤에 묶이는 산출물 |
| 사용자 ↔ 모든 것 | "내 작업 / 내 마감" 한 화면 |

---

## 3. 단계별 로드맵

### Phase 1 — 핵심 기능 마무리 (실사용 수준) · 약 2주

지금은 stub·Excel 의존이 섞여 실무 도입이 어렵다. 우선 완결성을 만든다.

| 기능 | 왜 | 비고 |
|---|---|---|
| **WBS 태스크 직접 편집** | Excel import 의존 줄임 | 추가/수정/삭제 UI, 기존 `useTasks` 확장 |
| **산출물 ↔ 태스크 연결** | 가장 큰 차별 가치 | `documents.task_id` FK + 양방향 패널 |
| **문서 상태 흐름 노출** | 검토/승인 가시화 | 컬럼은 이미 있음, UI만 |
| **내 작업 / 내 마감** | 개인 진입점 (Jira 대시보드 대체) | 대시보드 위젯 |
| **PDF 내보내기 완성** | 현 stub 완성 | `window.print` + 표지 |
| **표지 자동 반영** | CLAUDE.md 핵심 차별점 | 설정 페이지 → 회사정보/로고 → 문서 렌더 시 주입 |

**완료 정의**: 외부 Excel 없이 프로젝트 1건을 처음부터 끝까지 운영 가능.

### Phase 2 — 시각화 & 일정 · 약 2주

표만으로는 일정관리가 안 된다.

| 기능 | 비고 |
|---|---|
| **간트 차트** | WBS 데이터 그대로 활용(이미 start/end/progress 있음). 가벼운 라이브러리(예: `frappe-gantt`) |
| **마일스톤** | 단계별 핵심 마감(착수/설계 완료/검수). `milestones` 테이블 추가 |
| **캘린더 뷰** | 월/주 단위 마감 모음 |
| **프로젝트 대시보드 강화** | 진행률·지연·임박·최근 활동 한 화면 |

**완료 정의**: 영업·관리자 보고용 시각 자료를 도구 안에서 바로 보여줄 수 있다.

### Phase 3 — 협업 · 약 2~3주

검토·피드백이 없으면 산출물 관리 도구가 아니다.

| 기능 | 비고 |
|---|---|
| **댓글** (산출물 · 태스크) | `comments(target_type, target_id, body, author, created_at)` 단일 테이블 |
| **@멘션 + 알림 인박스** | 멘션은 댓글에 한정. 알림은 인앱 인박스 우선 |
| **활동 로그** | 변경 이력(상태·담당자·버전). 한 테이블, 화면별 필터 |
| **검색** | 프로젝트 내 산출물 전문 검색(Postgres `tsvector` + GIN) + 태스크 키워드 |

**완료 정의**: 검토 의견·결정 사항이 도구 안에 누적된다 (이메일·메신저로 흩어지지 않음).

### Phase 4 — 자동화 & 통합 · 약 2주

반복 작업 제거 + 외부 도구와의 접점.

| 기능 | 비고 |
|---|---|
| **마감 임박/지연 알림** | 기존 Slack 워크플로우 자산 활용. 일 1회 cron(Supabase Edge Function) |
| **템플릿 라이브러리** 실사용화 | 분류·검색·새 산출물 시 선택 적용 |
| **표지·스타일 일괄 적용** | 회사 정보 변경 시 전체 산출물 재렌더 |
| **DOCX 내보내기** | 기존 `mammoth.js` 역방향(HTML → DOCX) |

**완료 정의**: 사람이 매번 챙기던 알림·표지 적용·내보내기를 도구가 처리한다.

---

## 4. 데이터 스키마 변경 (단계별)

```sql
-- Phase 1: 산출물 ↔ 태스크 연결
ALTER TABLE documents ADD COLUMN task_id uuid REFERENCES tasks(id);
CREATE INDEX ON documents(task_id);

-- Phase 2: 마일스톤
CREATE TABLE milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  due_date date,
  status varchar DEFAULT 'planned',  -- planned | done | missed
  created_at timestamp DEFAULT now()
);

-- Phase 3: 협업
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_type varchar NOT NULL,      -- 'document' | 'task'
  target_id uuid NOT NULL,
  body text NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  verb varchar NOT NULL,             -- 'updated' | 'commented' | 'changed_status' ...
  target_type varchar NOT NULL,
  target_id uuid NOT NULL,
  meta jsonb,
  created_at timestamp DEFAULT now()
);

ALTER TABLE documents ADD COLUMN search_tsv tsvector;
CREATE INDEX documents_search_idx ON documents USING gin(search_tsv);
-- 트리거로 title/description 변경 시 tsv 갱신
```

각 테이블에 기존 패턴대로 RLS 정책을 함께 추가한다 (소속 프로젝트 멤버만 접근).

---

## 5. 우선순위 (한 번에 하나만 한다면)

1. **산출물 ↔ 태스크 연결 + 내 작업 뷰**
   가장 적은 코드로 가장 큰 차별 가치. "이 작업이 이 문서를 만든다"를 보여주는 순간 *Jira + Confluence 따로 쓰던 흐름*이 한 화면에 들어온다.

2. **간트 차트**
   이미 데이터(WBS)가 있어 화면만 붙이면 된다. 영업·관리자 보고용 임팩트가 크다.

3. **댓글 + 멘션**
   협업 도구로 인식 전환점.

---

## 6. 위험 요소

| 항목 | 리스크 | 완화 |
|---|---|---|
| 기능 범위 팽창 | "Jira에 있던 그거…"가 쌓이며 단순함 잃음 | §1 라인을 PR 리뷰 체크리스트에 포함 |
| 서드파티 편집기 한계 | FortuneSheet/DocxEditor 의존성 | 라이트 아일랜드 유지, 자체 TipTap 강화 우선 |
| 데이터 정합 | 산출물↔태스크 연결, 삭제 시 고아 데이터 | FK + `ON DELETE SET NULL`, 활동 로그로 추적 |
| AI 비용 | Claude 호출 증가 | 사용자별 요청 한도, 프롬프트 캐싱(추후) |

---

## 7. 다음 액션

1. 본 로드맵 확정(빼야 할 것/추가 항목 합의)
2. Phase 1 항목을 GitHub Issue 단위로 쪼개기
3. **산출물 ↔ 태스크 연결**부터 착수 (DB 스키마 + UI 양쪽 패널)

> 이 문서는 살아있는 계획서다. Phase 진행에 따라 갱신하고 변경 이력을 PR에 남긴다.
