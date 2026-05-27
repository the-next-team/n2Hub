const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, VerticalAlign, PageBreak,
} = require('docx')
const fs = require('fs')

// ─── 공통 스타일 ───────────────────────────────────────────────────────────────
const FONT = 'Malgun Gothic'
const CONTENT_W = 9360  // US Letter, 1인치 마진 기준

const border = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }
const borders = { top: border, bottom: border, left: border, right: border }

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: '1E3A5F' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563EB', space: 4 } },
  })
}
function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: '374151' })],
  })
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: FONT, size: 22, ...opts })],
  })
}
function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360 + level * 280, hanging: 280 },
    children: [
      new TextRun({ text: '• ', font: FONT, size: 22, color: '2563EB' }),
      new TextRun({ text, font: FONT, size: 22 }),
    ],
  })
}
function label(text) {
  return new TextRun({ text, font: FONT, size: 22, bold: true, color: '1E3A5F' })
}
function code(text) {
  return new TextRun({ text, font: 'Consolas', size: 20, color: '374151' })
}
function gap(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun('')] })
  )
}

// ─── 셀 헬퍼 ──────────────────────────────────────────────────────────────────
function cell(text, { w, header = false, color, colspan = 1 } = {}) {
  const bg = header ? { fill: '1E3A5F', type: ShadingType.CLEAR }
           : color  ? { fill: color,  type: ShadingType.CLEAR }
           : undefined
  return new TableCell({
    columnSpan: colspan,
    borders,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: bg,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({
        text, font: FONT, size: header ? 20 : 20,
        bold: header,
        color: header ? 'FFFFFF' : '374151',
      })],
    })],
  })
}

// ─── 화면 목록 테이블 ──────────────────────────────────────────────────────────
function screenTable() {
  const headers = ['ID', '경로', '화면명', '설명', '구현 상태']
  const widths  = [900, 2200, 1600, 2960, 1300]

  const rows = [
    // Auth
    ['AU-01', '/login', '로그인', '이메일/비밀번호 로그인 및 회원가입 전환', '✅ 완료'],
    // Dashboard
    ['DA-01', '/dashboard', '대시보드', '프로젝트 통계 카드, 최근 프로젝트 목록', '✅ 완료'],
    // Project
    ['PJ-01', '/projects', '프로젝트 목록', '카드 그리드, 검색, 새 프로젝트 생성 모달', '✅ 완료'],
    ['PJ-02', '/projects/new', '프로젝트 생성', '프로젝트 목록 내 모달로 처리', '✅ 완료'],
    ['PJ-10', '/projects/:id', '프로젝트 상세', '통계 카드, 산출물/WBS/멤버 메뉴 링크', '✅ 완료'],
    // Documents
    ['DO-01', '/projects/:id/documents', '산출물 목록', '폴더 계층, 파일 업로드/다운로드/삭제', '✅ 완료'],
    ['DO-02', '/projects/:id/view/:fileId', '파일 뷰어/에디터', 'DOCX·XLSX 편집, PDF 뷰어, 기타 다운로드', '✅ 완료'],
    ['DO-03', '/documents/:docId', '문서 에디터', 'TipTap 에디터, AI 초안 생성, 버전 관리', '🔧 스텁'],
    // Tasks
    ['TK-01', '/projects/:id/tasks', 'WBS 작업 관리', 'WBS 가져오기, 담당자별 진행률, 상태 관리', '✅ 완료'],
    // Template
    ['TM-01', '/templates', '템플릿 관리', '분류별 템플릿 카드 (준비 중)', '🔧 스텁'],
    // Settings
    ['AC-01', '/settings', '설정', '계정 정보, 회사 정보, 알림 설정 (준비 중)', '🔧 스텁'],
  ]

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, { w: widths[i], header: true })),
      }),
      ...rows.map((r, idx) => {
        const bg = r[4] === '✅ 완료' ? 'F0FDF4'
                 : r[4] === '🔧 스텁' ? 'FFFBEB' : undefined
        return new TableRow({
          children: r.map((v, i) => cell(v, { w: widths[i], color: idx % 2 === 0 ? undefined : 'F9FAFB' })),
        })
      }),
    ],
  })
}

// ─── 데이터 모델 테이블 ────────────────────────────────────────────────────────
function modelTable(title, fields) {
  const widths = [2400, 2000, 1200, 3760]
  return [
    heading2(title),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['컬럼명', '설명', '타입', '비고'].map((h, i) => cell(h, { w: widths[i], header: true })),
        }),
        ...fields.map(([col, desc, type, note], idx) =>
          new TableRow({
            children: [col, desc, type, note].map((v, i) =>
              cell(v, { w: widths[i], color: idx % 2 === 0 ? undefined : 'F9FAFB' })
            ),
          })
        ),
      ],
    }),
    ...gap(1),
  ]
}

// ─── 라우팅 코드 블록 ─────────────────────────────────────────────────────────
function routeBlock() {
  const lines = [
    '/login                          [공개 — 미인증 전용]',
    '/',
    '  /dashboard                    대시보드',
    '  /projects                     프로젝트 목록',
    '  /projects/new                 프로젝트 생성 (목록 모달)',
    '  /projects/:id                 프로젝트 상세',
    '  /projects/:id/documents       산출물 파일 관리',
    '  /projects/:id/view/:fileId    파일 뷰어/에디터',
    '  /projects/:id/tasks           WBS 작업 관리',
    '  /documents/:docId             문서 에디터 (TipTap)',
    '  /templates                    템플릿 관리',
    '  /settings                     설정',
  ]
  return lines.map(l =>
    new Paragraph({
      spacing: { before: 20, after: 20 },
      indent: { left: 360 },
      children: [code(l)],
    })
  )
}

// ─── 컴포넌트 계층 ────────────────────────────────────────────────────────────
function compTree() {
  const lines = [
    'App.tsx',
    '  └─ AuthProvider (src/lib/auth.tsx)',
    '  └─ BrowserRouter',
    '      ├─ GuestRoute    → /login → Login',
    '      └─ ProtectedRoute (미인증 시 /login 리다이렉트)',
    '          └─ Layout  (Sidebar + <Outlet>)',
    '              ├─ Sidebar',
    '              │   ├─ n2Hub 로고',
    '              │   ├─ NavLink: 대시보드 / 프로젝트 / 템플릿 / 설정',
    '              │   └─ 하단: 사용자 이메일 + 로그아웃',
    '              └─ <Outlet>',
    '                  ├─ Dashboard',
    '                  ├─ ProjectList  (+ CreateProjectModal)',
    '                  ├─ ProjectDetail',
    '                  ├─ DocumentList (폴더/파일 관리)',
    '                  ├─ FileViewer   (DOCX·XLSX·PDF·기타)',
    '                  │   ├─ DocEditor    (@eigenpal/docx-editor-react)',
    '                  │   └─ SpreadsheetEditor (fortune-sheet + Google Drive)',
    '                  ├─ TaskBoard    (WBS 작업 관리)',
    '                  ├─ DocumentEditor (TipTap — 스텁)',
    '                  ├─ TemplateManager (스텁)',
    '                  └─ Settings    (스텁)',
  ]
  return lines.map(l =>
    new Paragraph({
      spacing: { before: 18, after: 18 },
      indent: { left: 360 },
      children: [code(l)],
    })
  )
}

// ─── 사용자 흐름 ──────────────────────────────────────────────────────────────
function userFlow() {
  const flows = [
    ['미인증 사용자', [
      '모든 경로 접근 → /login 자동 리다이렉트',
      '로그인/회원가입 완료 → /dashboard',
    ]],
    ['대시보드 (/dashboard)', [
      '프로젝트 카드 클릭 → /projects/:id',
      '"전체 보기" 클릭 → /projects',
    ]],
    ['프로젝트 목록 (/projects)', [
      '"새 프로젝트" 클릭 → 모달 → 생성 후 /projects/:id',
      '프로젝트 카드 클릭 → /projects/:id',
      '검색창 → 이름/고객사 필터링',
    ]],
    ['프로젝트 상세 (/projects/:id)', [
      '"산출물 목록" → /projects/:id/documents',
      '"WBS 작업 관리" → /projects/:id/tasks',
    ]],
    ['산출물 목록 (/projects/:id/documents)', [
      '파일 업로드(드래그&드롭 또는 버튼) → Storage 저장 + DB 등록',
      '폴더 생성 → 가상 폴더 (files 테이블 mime_type=folder)',
      '파일 행 클릭 → /projects/:id/view/:fileId',
      '다운로드 버튼 → Supabase Storage 직접 다운로드',
      '삭제 버튼 → Storage + DB 레코드 동시 삭제',
    ]],
    ['파일 뷰어/에디터 (/projects/:id/view/:fileId)', [
      'DOCX → eigenpal 에디터 (인라인 편집 + 저장)',
      'XLSX → FortuneSheet 편집 + "Google Sheets로 편집" (Drive 업로드 + 30초 자동 동기화)',
      'PDF → 브라우저 iframe 뷰어',
      '기타 → 다운로드 안내',
    ]],
    ['WBS 작업 관리 (/projects/:id/tasks)', [
      '"WBS 가져오기" → 업로드된 Excel 선택 → Schedule 시트 파싱 → wbs_tasks 테이블 저장',
      '담당자/상태 필터 → 작업 목록 필터링',
      '작업 행 "수정" → 담당자 입력 + 실적 슬라이더 → 저장',
      'L1/L2 그룹 헤더 클릭 → 접기/펼치기',
    ]],
  ]

  const result = []
  for (const [title, steps] of flows) {
    result.push(new Paragraph({
      spacing: { before: 120, after: 40 },
      children: [label('▶ ' + title)],
    }))
    for (const s of steps) result.push(bullet(s, 0))
  }
  return result
}

// ─── Supabase 정책 테이블 ─────────────────────────────────────────────────────
function rlsTable() {
  const widths = [2000, 1600, 1200, 4560]
  const rows = [
    ['projects', 'SELECT / INSERT / UPDATE / DELETE', '✅', 'created_by = auth.uid()'],
    ['files', 'SELECT / INSERT', '✅', 'project_id 기준 (owner)'],
    ['wbs_tasks', 'SELECT / INSERT / UPDATE / DELETE', '✅', 'project_id 기준 (owner)'],
    ['documents', 'SELECT / INSERT / UPDATE / DELETE', '⬜', '다음 작업 시 추가 예정'],
    ['document_versions', 'SELECT / INSERT', '⬜', '다음 작업 시 추가 예정'],
  ]
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['테이블', '정책', 'RLS', '조건'].map((h, i) => cell(h, { w: widths[i], header: true })),
      }),
      ...rows.map(([t, p, r, c], idx) =>
        new TableRow({
          children: [t, p, r, c].map((v, i) =>
            cell(v, { w: widths[i], color: idx % 2 === 0 ? undefined : 'F9FAFB' })
          ),
        })
      ),
    ],
  })
}

// ─── 문서 본문 ────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: 22 } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 32, bold: true, color: '1E3A5F' },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 26, bold: true, color: '374151' },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [
    // ══════════════════════════════════════════════════════
    // 표지
    // ══════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        ...gap(6),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 160 },
          children: [new TextRun({ text: 'n2Hub', font: FONT, size: 72, bold: true, color: '2563EB' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: 'Information Architecture 정의서', font: FONT, size: 40, color: '374151' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 400 },
          children: [new TextRun({ text: 'IT 프로젝트 산출물 통합관리 플랫폼', font: FONT, size: 28, color: '6B7280' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: 'E5E7EB', space: 2 } },
          spacing: { before: 0, after: 320 },
          children: [new TextRun('')],
        }),
        ...gap(1),
        new Table({
          width: { size: 5400, type: WidthType.DXA },
          alignment: AlignmentType.CENTER,
          columnWidths: [2000, 3400],
          rows: [
            ['문서 번호', 'n2Hub-IA-001'],
            ['버전', 'v1.0'],
            ['작성일', '2026-05-27'],
            ['작성자', 'N2SOFT'],
            ['승인자', '—'],
          ].map(([k, v]) =>
            new TableRow({
              children: [
                cell(k, { w: 2000, color: 'F3F4F6' }),
                cell(v, { w: 3400 }),
              ],
            })
          ),
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // ══════════════════════════════════════════════════════
    // 본문
    // ══════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: 'E5E7EB', space: 4 } },
            children: [
              new TextRun({ text: 'n2Hub  IA 정의서  v1.0', font: FONT, size: 18, color: '9CA3AF' }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 3, color: 'E5E7EB', space: 4 } },
            children: [
              new TextRun({ text: '- ', font: FONT, size: 18, color: '9CA3AF' }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '9CA3AF' }),
              new TextRun({ text: ' -', font: FONT, size: 18, color: '9CA3AF' }),
            ],
          })],
        }),
      },
      children: [
        // ── 개정 이력 ──
        heading1('개정 이력'),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [1200, 1800, 2400, 3960],
          rows: [
            new TableRow({
              tableHeader: true,
              children: ['버전', '일자', '작성자', '변경 내용'].map((h, i) =>
                cell(h, { w: [1200,1800,2400,3960][i], header: true })
              ),
            }),
            new TableRow({
              children: [
                cell('v1.0', { w: 1200 }),
                cell('2026-05-27', { w: 1800 }),
                cell('N2SOFT', { w: 2400 }),
                cell('최초 작성 — 현재 구현 기준 전체 IA 정의', { w: 3960 }),
              ],
            }),
          ],
        }),
        ...gap(2),

        // ── 1. 개요 ──
        heading1('1. 서비스 개요'),
        heading2('1.1 서비스 정의'),
        body('n2Hub는 IT 프로젝트의 산출물과 이슈를 한 곳에서 관리하는 협업형 문서 자동화 플랫폼입니다.'),
        body('레퍼런스: Confluence + Jira, Notion, SharePoint'),
        body('핵심 차별점: 로고/표지/회사정보 변경 시 전체 산출물 자동 반영 + AI 초안 생성'),
        ...gap(1),
        heading2('1.2 기술 스택'),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2000, 2000, 5360],
          rows: [
            new TableRow({
              tableHeader: true,
              children: ['구분', '기술', '버전/설명'].map((h, i) =>
                cell(h, { w: [2000,2000,5360][i], header: true })
              ),
            }),
            ...([
              ['프론트엔드', 'React', 'v19.2.6'],
              ['프론트엔드', 'TypeScript', 'v5.9.3'],
              ['프론트엔드', 'Vite', 'v6.4.2'],
              ['프론트엔드', 'Tailwind CSS', 'v4.3 (@import 방식)'],
              ['프론트엔드', 'React Router', 'v7'],
              ['에디터', 'TipTap', 'v2.27.2 (Block 에디터)'],
              ['에디터', '@eigenpal/docx-editor-react', 'v1.0.3 (DOCX 편집)'],
              ['에디터', '@fortune-sheet/react', 'v1.0.4 (XLSX 편집)'],
              ['백엔드', 'Supabase', 'PostgreSQL + Auth + Storage'],
              ['AI', 'Anthropic Claude API', 'claude-sonnet-4-5 (스트리밍)'],
              ['패키지 관리', 'pnpm', 'v11.3.0'],
            ]).map(([cat, tech, ver], idx) =>
              new TableRow({
                children: [cat, tech, ver].map((v, i) =>
                  cell(v, { w: [2000,2000,5360][i], color: idx % 2 === 0 ? undefined : 'F9FAFB' })
                ),
              })
            ),
          ],
        }),
        ...gap(2),

        // ── 2. 라우팅 구조 ──
        heading1('2. 라우팅 구조'),
        body('인증 여부에 따라 GuestRoute / ProtectedRoute 로 분기됩니다.'),
        ...gap(1),
        ...routeBlock(),
        ...gap(2),

        // ── 3. 화면 목록 ──
        heading1('3. 화면 목록 (IA)'),
        body('구현 상태: ✅ 완료 / 🔧 스텁(준비 중)'),
        ...gap(1),
        screenTable(),
        ...gap(2),

        // ── 4. 컴포넌트 계층 ──
        heading1('4. 컴포넌트 계층'),
        ...gap(1),
        ...compTree(),
        ...gap(2),

        // ── 5. 사용자 흐름 ──
        heading1('5. 사용자 흐름'),
        ...gap(1),
        ...userFlow(),
        ...gap(2),

        // ── 6. 데이터 모델 ──
        heading1('6. 데이터 모델 (Supabase)'),

        ...modelTable('6.1 projects', [
          ['id', '프로젝트 PK', 'uuid', 'gen_random_uuid()'],
          ['name', '프로젝트 이름', 'text', 'NOT NULL'],
          ['description', '설명', 'text', ''],
          ['client_name', '고객사명', 'text', ''],
          ['start_date / end_date', '사업 기간', 'date', ''],
          ['status', '상태', 'text', "default 'active'"],
          ['created_by', '생성자 (Auth UID)', 'uuid', 'FK → auth.users'],
          ['created_at', '생성일시', 'timestamptz', 'default now()'],
        ]),

        ...modelTable('6.2 files', [
          ['id', '파일 PK', 'uuid', ''],
          ['project_id', '프로젝트 FK', 'uuid', 'ON DELETE CASCADE'],
          ['original_name', '원본 파일명 (한글 지원)', 'text', ''],
          ['storage_path', 'Storage 경로 (UUID 기반)', 'text', '한글 없음'],
          ['folder_path', '가상 폴더 경로', 'text', "'' = 루트"],
          ['mime_type', 'MIME 타입', 'text', "'folder' = 폴더"],
          ['size', '파일 크기 (bytes)', 'bigint', ''],
          ['version', '버전 태그', 'text', '파일명 자동 파싱'],
          ['uploaded_by', '업로드 사용자', 'uuid', 'FK → auth.users'],
        ]),

        ...modelTable('6.3 wbs_tasks', [
          ['id', '작업 PK', 'uuid', ''],
          ['project_id', '프로젝트 FK', 'uuid', 'ON DELETE CASCADE'],
          ['wbs_code', 'WBS 코드 (예: 1.2.3)', 'text', ''],
          ['wbs_level', '계층 레벨', 'integer', 'CHECK IN (1,2,3)'],
          ['task_name', '작업명', 'text', ''],
          ['start_date / end_date', '시작/완료 예정일', 'date', ''],
          ['planned_progress', '계획 진행률 (0-1)', 'numeric(6,4)', ''],
          ['actual_progress', '실적 진행률 (0-1)', 'numeric(6,4)', ''],
          ['assignee_name', '담당자 이름 (자유 입력)', 'text', ''],
          ['status', '상태', 'text', 'not_started|in_progress|completed|delayed'],
          ['notes', '메모', 'text', ''],
        ]),

        ...modelTable('6.4 documents', [
          ['id', '문서 PK', 'uuid', ''],
          ['project_id', '프로젝트 FK', 'uuid', ''],
          ['title', '문서 제목', 'text', ''],
          ['category', '분류', 'text', ''],
          ['status', '상태', 'text', ''],
          ['assignee_id', '담당자 FK', 'uuid', ''],
          ['current_version', '현재 버전', 'text', ''],
        ]),

        ...modelTable('6.5 document_versions', [
          ['id', '버전 PK', 'uuid', ''],
          ['document_id', '문서 FK', 'uuid', ''],
          ['version', '버전 번호', 'text', ''],
          ['content_json', 'TipTap JSON 콘텐츠', 'jsonb', ''],
          ['change_note', '변경 사유', 'text', ''],
          ['created_by', '저장자', 'uuid', ''],
        ]),

        // ── 7. RLS 정책 ──
        heading1('7. Supabase RLS 정책 현황'),
        ...gap(1),
        rlsTable(),
        ...gap(2),

        // ── 8. 구현 현황 ──
        heading1('8. MVP 구현 현황'),
        heading2('8.1 완료 항목'),
        ...([
          '로그인 / 로그아웃 (Supabase Auth)',
          '프로젝트 목록 생성 · 조회 · 검색',
          '산출물 파일 관리 (폴더/업로드/다운로드/삭제)',
          'DOCX 인라인 편집 (@eigenpal/docx-editor-react)',
          'XLSX 인라인 편집 (FortuneSheet) + Google Sheets 연동 + 30초 자동 동기화',
          'PDF 브라우저 뷰어 (iframe)',
          'WBS Excel 파싱 → 작업 목록 저장 (wbs_tasks)',
          '담당자별 작업 조회 / 진행률 수정 / 상태 관리',
        ]).map(t => bullet(t)),
        ...gap(1),
        heading2('8.2 미완료 항목 (우선순위 순)'),
        ...([
          'TipTap 에디터 완성 + 자동저장 (/documents/:docId)',
          'documents / document_versions RLS 정책 추가',
          'AI 문서 초안 생성 (스트리밍 UI)',
          'AI 버전 변경 요약',
          '표지 설정 (로고 · 회사명 · 문서 제목)',
          '전체 산출물 일괄 로고 교체',
          '멤버 관리 (project_members)',
          'PDF 내보내기 (window.print)',
          'Vercel 배포',
        ]).map(t => bullet(t)),
        ...gap(2),

        // ── 9. 환경변수 ──
        heading1('9. 환경변수 목록'),
        body('파일 위치: .env.local (Git 제외)', { bold: true }),
        ...gap(1),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [3600, 2000, 3760],
          rows: [
            new TableRow({
              tableHeader: true,
              children: ['변수명', '상태', '설명'].map((h, i) =>
                cell(h, { w: [3600,2000,3760][i], header: true })
              ),
            }),
            ...([
              ['VITE_SUPABASE_URL', '✅ 설정됨', 'Supabase 프로젝트 URL'],
              ['VITE_SUPABASE_ANON_KEY', '✅ 설정됨', 'Publishable Key (RLS 적용)'],
              ['VITE_GOOGLE_CLIENT_ID', '✅ 설정됨', 'Google OAuth 2.0 Client ID (Drive 연동)'],
              ['VITE_ANTHROPIC_API_KEY', '⬜ 미설정', 'Claude API 키 (AI 초안 생성 시 필요)'],
            ]).map(([k, s, d], idx) =>
              new TableRow({
                children: [k, s, d].map((v, i) =>
                  cell(v, { w: [3600,2000,3760][i], color: idx % 2 === 0 ? undefined : 'F9FAFB' })
                ),
              })
            ),
          ],
        }),
      ],
    },
  ],
})

// ─── 파일 저장 ─────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buf => {
  const path = require('path')
  const outPath = path.resolve(__dirname, '../docs/n2Hub_IA정의서_v1.0.docx')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buf)
  console.log('✅ 생성 완료:', outPath)
}).catch(e => {
  console.error('❌ 오류:', e.message)
  process.exit(1)
})
