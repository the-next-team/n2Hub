# n2Hub 디자인 시스템

> 톤앤매너: **미니멀 프로페셔널 + 인디고**
> 절제된 뉴트럴(zinc), 얇은 보더 우선, 그림자 최소, 넉넉한 여백.

모든 시각 속성은 **디자인 토큰**(CSS 변수)으로 관리합니다. 색을 하드코딩하지 말고 토큰 유틸리티를 사용하세요. 토큰만 바꾸면 앱 전체와 라이트/다크가 일괄 반영됩니다.

정의 위치: [`src/index.css`](../src/index.css)
컴포넌트: [`src/components/ui/`](../src/components/ui/)

---

## 1. 컬러 토큰

`@theme inline` + CSS 변수로 선언되어 `.dark` 오버라이드가 유틸리티에 그대로 반영됩니다.

### 브랜드 (인디고)
| 토큰 | 유틸리티 | Light | Dark |
|---|---|---|---|
| `primary` | `bg-primary` `text-primary` `ring-primary` | `#4f46e5` | `#818cf8` |
| `primary-hover` | `hover:bg-primary-hover` | `#4338ca` | `#a5b4fc` |
| `primary-soft` | `bg-primary-soft` | `#eef2ff` | `#232136` |

### 뉴트럴 (zinc)
| 토큰 | 유틸리티 | Light | Dark | 용도 |
|---|---|---|---|---|
| `canvas` | `bg-canvas` | `#fafafa` | `#0a0a0b` | 페이지 배경 |
| `surface` | `bg-surface` | `#ffffff` | `#161618` | 카드·툴바·모달 |
| `surface-hover` | `bg-surface-hover` | `#f4f4f5` | `#202023` | hover·스켈레톤·칩 |
| `line` | `border-line` `divide-line` | `#e8e8ec` | `#28282d` | 보더·구분선 |
| `content` | `text-content` | `#18181b` | `#ededf0` | 기본 텍스트·제목 |
| `content-muted` | `text-content-muted` | `#71717a` | `#a1a1aa` | 보조 텍스트 |
| `content-subtle` | `text-content-subtle` | `#a1a1aa` | `#71717a` | 캡션·플레이스홀더 |

### 상태색 (text/soft 쌍)
| 토큰 | 유틸리티 | 의미 |
|---|---|---|
| `success` / `success-soft` | `text-success` `bg-success-soft` | 완료·정상 |
| `warning` / `warning-soft` | `text-warning` `bg-warning-soft` | 진행·주의 |
| `danger` / `danger-soft` | `text-danger` `bg-danger-soft` | 지연·오류·삭제 |

> 보라(`purple`)는 **AI 기능 전용 강조색**으로만 사용합니다(예: AI 초안). Google Sheets 버튼의 emerald는 외부 브랜드 어포던스 예외입니다.

---

## 2. 타이포그래피

기준 본문 14px / line-height 1.6 (`body`). 한글 가독성을 위해 음수 자간은 쓰지 않습니다.
폰트: **Pretendard**(`--font-sans`).

| 역할 | 스펙 | 적용 |
|---|---|---|
| 페이지 타이틀 | 24px / 700 / leading-tight | `<PageHeader>` |
| 섹션 타이틀 | 16px / 600 | `<SectionTitle>` |
| 다이얼로그 타이틀 | 18px / 600 (`text-lg font-semibold`) | 모달 헤더 |
| 본문 | 14px / 1.6 | `body` 상속 (별도 `text-sm` 불필요) |
| 라벨·강조 | 14px / 500~600 | `font-medium` |
| 캡션·메타 | 12px | `text-xs` |

> `text-2xl` 등 rem 유틸은 html 16px 기준이라 본문 14px 변경과 무관합니다.

---

## 3. 모양 · 깊이

### Radius
- 카드/모달: `rounded-xl` = **10px** (`--radius-xl` 재정의)
- 컨트롤(버튼/입력/칩): `rounded-lg` = 8px

### Elevation (그림자)
보더 우선, 그림자는 절제. 3단계만 사용합니다.

| 토큰 | 유틸리티 | 용도 |
|---|---|---|
| `shadow-card` | `shadow-card` | 카드 hover·문서 용지 |
| `shadow-popover` | `shadow-popover` | 드롭다운·메뉴 |
| `shadow-modal` | `shadow-modal` | 다이얼로그 |

> Tailwind 기본 `shadow-sm/lg/xl`은 쓰지 않습니다.

---

## 4. 포커스 · 접근성

- 전역 `:focus-visible`에 `outline: 2px solid var(--primary)` — 모든 링크·아이콘 버튼에 키보드 포커스 표시.
- `<Button>`은 자체 `focus-visible:ring` 사용(ring-offset 색은 `surface` 토큰 → 다크 대응). 마우스 클릭 시에는 ring 미표시.
- 텍스트 없는 **아이콘 전용 버튼/링크는 `aria-label` 필수**. 토글류는 `aria-pressed`/`aria-expanded`로 상태 노출. 툴팁용 `title`은 병행 가능.

---

## 5. 다크 모드

- 클래스 기반: `<html class="dark">` (`@custom-variant dark`).
- 토글 상태는 `localStorage('n2hub-theme')`에 저장, `index.html`의 anti-FOUC 스크립트가 초기 적용.
- Topbar의 토글 버튼이 `documentElement`의 `.dark`를 제어.
- 콘텐츠는 토큰으로 자동 전환. 단, **서드파티 편집기**(FortuneSheet 그리드, DocxEditor)의 내부 UI는 자체 CSS라 토큰을 따르지 않음(알려진 한계).

---

## 6. 공통 컴포넌트 (`src/components/ui`)

`import { Button, Badge, Card, PageHeader, SectionTitle } from '../components/ui'`

### Button
```tsx
<Button onClick={...}>저장</Button>
<Button variant="secondary">취소</Button>
<Button variant="ghost" size="sm">더보기</Button>
<Button variant="danger">삭제</Button>
```
- `variant`: `primary`(기본) | `secondary` | `ghost` | `danger`
- `size`: `md`(기본) | `sm`
- 표준 `<button>` 속성 전달(`disabled`, `type` 등).

### Badge
```tsx
<Badge tone="green">진행중</Badge>
```
- `tone`: `gray`(기본) | `green` | `blue` | `orange` | `purple` | `red`
- 상태색 토큰을 참조(라이트/다크 자동).

### Card
```tsx
<Card className="p-5">…</Card>
```
- `surface` + `border-line` + `rounded-xl` 래퍼. `div` 속성 전달.

### PageHeader
```tsx
<PageHeader
  title="프로젝트"
  description="12개의 프로젝트"
  actions={<Button>새 프로젝트</Button>}
/>
```
- 기본 하단 여백 `mb-6` 내장(수직 리듬 표준). 제목은 24/700/leading-tight.

### SectionTitle
```tsx
<SectionTitle>최근 프로젝트</SectionTitle>
```
- 섹션 헤더 16/600 표준.

---

## 7. 컨벤션

- **색을 하드코딩하지 않습니다.** `bg-white`/`text-gray-*`/`bg-blue-*` 대신 토큰 유틸 사용.
- 예외(의도적 유지): 모달 스크림 `bg-black/40`, 문서 용지 `bg-white`, AI 보라, Google emerald.
- 새 버튼/배지/카드/헤더는 공통 컴포넌트를 우선 사용 — 일회성 마크업 지양.
- 페이지 패딩은 `p-8`로 통일.
- 토큰 추가/변경은 `src/index.css` 한 곳에서.

---

## 8. 검증

```bash
pnpm build   # 타입체크 + 번들 (토큰 유틸 생성 확인)
pnpm lint    # ESLint
```
- 토큰 유틸이 CSS에 생성됐는지 확인하려면 빌드 후 `dist/assets/index-*.css`에서 클래스 검색.
- 코드에서 쓰지만 CSS에 없는 토큰 클래스 = 조용한 무효(오타 주의).
