// ── Primary: OpenRouter KIMI ──────────────────────────────────────────────
const OR_KEY   = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
const OR_BASE  = 'https://openrouter.ai/api/v1'
const OR_MODEL = 'moonshotai/kimi-k2.6:free'
const OR_EXTRA = { 'HTTP-Referer': 'https://n2hub.app', 'X-Title': 'n2Hub' }

// ── Fallback: Groq ────────────────────────────────────────────────────────
// llama-3.1-8b-instant: 20,000 TPM (qwen3-32b는 6,000 TPM 한도로 대용량 문서 처리 불가)
const GQ_KEY   = import.meta.env.VITE_GROQ_API_KEY as string | undefined
const GQ_BASE  = 'https://api.groq.com/openai/v1'
const GQ_MODEL = 'llama-3.1-8b-instant'

const MAX_CHARS      = 30000   // Primary(KIMI) 한도
const MAX_CHARS_GROQ = 12000   // Groq 폴백 한도 (6000 TPM 버퍼 확보)

// fallback 전환이 필요한 HTTP 상태 코드
const FALLBACK_CODES = new Set([404, 422, 503, 529])

// 한국어 전용 시스템 프롬프트
const SYSTEM = `당신은 한국 IT 프로젝트 산출물 전문 AI 어시스턴트입니다.
반드시 한국어로만 답변하세요.
한자(漢字), 중국어, 일본어는 절대 사용하지 마세요.
LaTeX 수식(\$...\$, \\(...\\), \\[...\\])은 절대 사용하지 마세요.
화살표는 →, 수식 기호는 일반 텍스트로 표기하세요.
모든 답변은 자연스러운 한국어로 작성하세요.`

// <think> 블록 + LaTeX 잔재 제거 후처리
function cleanOutput(text: string): string {
  // Qwen3 chain-of-thought 태그 제거
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  return text
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\$\\to\$/g, '→')
    .replace(/\$\\Rightarrow\$/g, '⇒')
    .replace(/\$\\leftarrow\$/g, '←')
    .replace(/\$\\cdot\$/g, '·')
    .replace(/\$\\times\$/g, '×')
    .replace(/\$\\leq\$/g, '≤')
    .replace(/\$\\geq\$/g, '≥')
    .replace(/\$\\neq\$/g, '≠')
    .replace(/\\\(.*?\\\)/gs, '')   // \(...\) 인라인 수식 제거
    .replace(/\\\[.*?\\\]/gs, '')   // \[...\] 블록 수식 제거
    .replace(/\$\$.*?\$\$/gs, '')   // $$...$$ 제거
    .replace(/\$([^$\n]+)\$/g, '$1') // $...$ 달러 기호 제거 (내용은 유지)
    .trim()
}

function assertKeys() {
  if (!OR_KEY && !GQ_KEY) throw new Error('AI API 키가 없습니다. .env.local에 VITE_OPENROUTER_API_KEY 또는 VITE_GROQ_API_KEY를 추가하세요.')
}

const TIMEOUT_MS = 30_000   // API 호출 최대 30초

/** 단일 엔드포인트 요청 (타임아웃 포함) */
async function request(
  base: string, key: string, model: string, extra: Record<string, string>,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${base}/chat/completions`, {
      signal: ctrl.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, ...extra },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
    })
  } finally {
    clearTimeout(timer)
  }
}

/** 단순 문자열 프롬프트 → 응답 (외부 사용 가능) */
export async function chatSimple(prompt: string): Promise<string> {
  return chat(prompt)
}

async function chat(userMessage: string, maxTokens = 1024): Promise<string> {
  assertKeys()
  const msgs = [
    { role: 'system', content: SYSTEM },
    { role: 'user',   content: userMessage },
  ]

  // 1️⃣ Primary: OpenRouter KIMI
  if (OR_KEY) {
    try {
      const res  = await request(OR_BASE, OR_KEY, OR_MODEL, OR_EXTRA, msgs, maxTokens)
      const data = await res.json()

      if (res.status === 429) {
        console.warn('[AI] KIMI rate-limited → Groq fallback')
        throw new Error('rate_limited')
      }

      if (res.ok) return cleanOutput(data.choices?.[0]?.message?.content ?? '')

      if (!FALLBACK_CODES.has(res.status)) throw new Error(data.error?.message ?? `오류 (${res.status})`)
      console.warn(`[AI] KIMI 실패(${res.status}) → Groq fallback`)
    } catch (err) {
      if (!GQ_KEY) throw err
      console.warn('[AI] KIMI 오류 → Groq fallback:', (err as Error).message)
    }
  }

  // 2️⃣ Fallback: Groq (llama-3.1-8b-instant, 20,000 TPM)
  // 메시지가 너무 길면 Groq TPM 한도 초과 → MAX_CHARS_GROQ로 잘라서 재구성
  if (!GQ_KEY) throw new Error('사용 가능한 AI API 키가 없습니다.')
  const groqMsg = userMessage.length > MAX_CHARS_GROQ
    ? [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: userMessage.slice(0, MAX_CHARS_GROQ) + '\n\n(내용이 길어 일부만 분석합니다)' },
      ]
    : msgs
  const groqMaxTokens = Math.min(maxTokens, 1500)  // Groq 응답도 제한

  const res  = await request(GQ_BASE, GQ_KEY, GQ_MODEL, {}, groqMsg, groqMaxTokens)
  const data = await res.json()

  if (res.status === 429) {
    const wait = (/in (\d+\.?\d*)s/.exec(data.error?.message ?? '')?.[1] ?? '8')
    await new Promise(r => setTimeout(r, parseFloat(wait) * 1000 + 500))
    const res2  = await request(GQ_BASE, GQ_KEY, GQ_MODEL, {}, groqMsg, groqMaxTokens)
    const data2 = await res2.json()
    if (res2.ok) return cleanOutput(data2.choices?.[0]?.message?.content ?? '')
  }

  if (!res.ok) throw new Error(data.error?.message ?? `Groq 오류 (${res.status})`)
  return cleanOutput(data.choices?.[0]?.message?.content ?? '')
}

async function streamFrom(
  base: string, key: string, model: string, extra: Record<string, string>,
  userMessage: string, onChunk: (t: string) => void,
): Promise<boolean> {
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, ...extra },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMessage }],
      max_tokens: 2048, temperature: 0.7, stream: true,
    }),
  })
  if (!res.ok) return false  // fallback 시도
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
      const raw = line.slice(6)
      if (raw === '[DONE]') return true
      try { const t = JSON.parse(raw).choices?.[0]?.delta?.content; if (t) onChunk(t) } catch { /* 무시 */ }
    }
  }
  return true
}

async function chatStream(userMessage: string, onChunk: (t: string) => void): Promise<void> {
  assertKeys()
  // 1️⃣ Primary: OpenRouter KIMI
  if (OR_KEY) {
    const ok = await streamFrom(OR_BASE, OR_KEY, OR_MODEL, OR_EXTRA, userMessage, onChunk)
    if (ok) return
    console.warn('[AI] KIMI 스트리밍 실패 → Qwen fallback')
  }
  // 2️⃣ Fallback: Groq Qwen
  if (GQ_KEY) {
    await streamFrom(GQ_BASE, GQ_KEY, GQ_MODEL, {}, userMessage, onChunk)
  }
}

/* ── 공개 함수 ── */

export async function summarizeDocument(content: string, fileName: string): Promise<string> {
  const truncated = content.length > MAX_CHARS
  const text      = content.slice(0, MAX_CHARS)
  const note      = truncated ? ` (문서가 길어 앞부분 위주로 분석합니다)` : ''

  return chat(
    `다음 문서("${fileName}")의 내용을 분석해주세요.${note}\n` +
    `주요 섹션, 핵심 내용, 중요 항목을 포함해서 5~10줄로 한국어로 요약해주세요.\n\n` +
    `[문서 내용]\n${text}`,
    800,
  )
}

export async function summarizeChanges(prev: string, next: string): Promise<string> {
  return chat(
    `두 버전의 문서를 비교해서 변경 사항을 3~5줄로 한국어로 요약해주세요.\n\n` +
    `[이전 버전]\n${prev}\n\n[새 버전]\n${next}`,
    512,
  )
}

/** 문서 기반 Q&A */
export async function askQuestion(
  docContent: string,
  docName: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  question: string,
): Promise<string> {
  assertKeys()
  const sysWithDoc =
    `${SYSTEM}\n\n` +
    `당신은 "${docName}" 문서를 기반으로 질문에 답하는 전문 어시스턴트입니다.\n` +
    `문서에 없는 내용은 "문서에서 확인할 수 없습니다"라고 답하세요.\n\n` +
    `[문서 내용]\n${docContent.slice(0, 20000)}`

  const msgs = [{ role: 'system', content: sysWithDoc }, ...history, { role: 'user', content: question }]

  // Primary: KIMI
  if (OR_KEY) {
    try {
      const res  = await request(OR_BASE, OR_KEY, OR_MODEL, OR_EXTRA, msgs, 800)
      const data = await res.json()
      if (res.ok) return cleanOutput(data.choices?.[0]?.message?.content ?? '')
      if (!FALLBACK_CODES.has(res.status)) throw new Error(data.error?.message)
    } catch (err) { if (!GQ_KEY) throw err }
  }
  // Fallback: Qwen
  if (!GQ_KEY) throw new Error('사용 가능한 API 키가 없습니다.')
  const res  = await request(GQ_BASE, GQ_KEY, GQ_MODEL, {}, msgs, 800)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `오류 (${res.status})`)
  return cleanOutput(data.choices?.[0]?.message?.content ?? '')
}

/** 회의록 자동 생성 */
export async function generateMeetingMinutes(
  notes: string,
  info: { date: string; attendees: string; agenda: string },
): Promise<string> {
  return chat(
    `다음 회의 메모를 공식적인 회의록 형식(Markdown)으로 변환해주세요.\n\n` +
    `회의 정보:\n- 일시: ${info.date}\n- 참석자: ${info.attendees}\n- 안건: ${info.agenda}\n\n` +
    `[회의 메모]\n${notes.slice(0, 8000)}\n\n` +
    `아래 구조로 작성하세요:\n` +
    `1. 회의 개요 (일시·장소·참석자)\n` +
    `2. 안건별 논의 내용\n` +
    `3. 결정사항\n` +
    `4. 액션아이템 (담당자·기한)\n` +
    `5. 차기 회의 예정`,
    1500,
  )
}

/** 회의 STT 녹취록 → 구조화된 회의록 */
export async function formatMeetingTranscript(
  transcript: string,
  info: { date: string; attendees: string; title: string },
): Promise<string> {
  if (!transcript.trim()) return ''
  return chat(
    `당신은 전문 회의록 작성자입니다.\n` +
    `아래 회의 녹취록을 바탕으로 정확하고 구조화된 회의록을 작성하세요.\n` +
    `녹취록에 없는 내용은 절대 추가하지 마세요. 추측이나 창작 금지.\n\n` +
    `회의 정보:\n` +
    `- 제목: ${info.title}\n` +
    `- 일시: ${info.date}\n` +
    `- 참석자: ${info.attendees || '미기재'}\n\n` +
    `[원본 녹취록]\n${transcript.slice(0, 14000)}\n\n` +
    `다음 형식으로 작성하세요. 각 항목에서 녹취에 없는 내용은 "없음"으로 표시:\n\n` +
    `# 회의록\n\n` +
    `## 회의 개요\n` +
    `| 항목 | 내용 |\n` +
    `|------|------|\n` +
    `| 회의명 | ${info.title} |\n` +
    `| 일시 | ${info.date} |\n` +
    `| 참석자 | ${info.attendees || '미기재'} |\n\n` +
    `## 회의 요약\n` +
    `(핵심 논의 내용 3~5줄. 녹취 내용 기반)\n\n` +
    `## 주요 논의 내용\n` +
    `(안건/주제별로 구분. 참석자 이름이 녹취에 나오면 "홍길동: ..." 형태로 발언자 표시)\n\n` +
    `## 결정 사항\n` +
    `(녹취에서 확인된 결정 사항만 bullet point로. 없으면 "없음")\n\n` +
    `## 액션 아이템\n` +
    `(녹취에서 언급된 것만. 있으면 아래 표 형식으로, 없으면 이 섹션 생략)\n` +
    `| 담당자 | 내용 | 기한 |\n` +
    `|--------|------|------|\n\n` +
    `## 다음 단계\n` +
    `(다음 회의 일정, 후속 조치 등. 녹취에 없으면 이 섹션 생략)`,
    2500,
  )
}

/** AI 문서 검색: 파일 목록에서 쿼리와 관련된 문서 찾기 */
export async function searchDocumentsByAI(
  query: string,
  docs: { id: string; name: string; folderPath?: string }[],
): Promise<{ id: string; score: number; reason: string }[]> {
  if (!docs.length) return []
  const docList = docs.map((d, i) => `${i + 1}. [${d.folderPath ? d.folderPath + '/' : ''}${d.name}]`).join('\n')
  const result = await chat(
    `아래는 프로젝트 문서 목록입니다. 검색어와 관련된 문서를 찾아주세요.\n\n` +
    `검색어: "${query}"\n\n문서 목록:\n${docList}\n\n` +
    `규칙:\n` +
    `- 관련 있는 문서만 선택 (score 3 이상)\n` +
    `- index는 반드시 위 목록의 번호(정수)\n` +
    `- 순수 JSON 배열만 반환, 다른 텍스트 없음\n\n` +
    `형식: [{"index":1,"score":5,"reason":"이유"}]`,
    600,
  )
  try {
    // 코드블록 제거 후 JSON 파싱
    const cleaned = result.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim()
    const jsonMatch = cleaned.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) return []
    const parsed: { index: number; score: number; reason: string }[] = JSON.parse(jsonMatch[0])
    return parsed
      .filter(r => typeof r.index === 'number' && r.index >= 1 && r.index <= docs.length && r.score >= 3)
      .map(r => ({ id: docs[r.index - 1].id, score: r.score, reason: r.reason }))
      .sort((a, b) => b.score - a.score)
  } catch (e) {
    console.error('[AI Search] JSON 파싱 실패:', e, '\n원문:', result)
    return []
  }
}

/** AI 문서 내용 검색: 실제 문서 내용에서 관련 내용 추출 */
export async function analyzeDocumentContent(
  query: string,
  content: string,
  fileName: string,
): Promise<{ relevant: boolean; score: number; excerpt: string }> {
  const result = await chat(
    `문서 "${fileName}"에서 "${query}"와 관련된 내용을 찾아주세요.\n\n` +
    `[문서 내용 일부]\n${content.slice(0, 4000)}\n\n` +
    `JSON으로 응답: {"relevant": true/false, "score": 1~5, "excerpt": "관련 내용 한 줄 요약"}\n` +
    `관련 없으면 relevant: false. 반드시 JSON만 반환하세요.`,
    300,
  )
  try {
    const cleaned  = result.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) return { relevant: false, score: 0, excerpt: '' }
    return JSON.parse(jsonMatch[0])
  } catch { return { relevant: false, score: 0, excerpt: '' } }
}

/** 회의록 텍스트에서 액션 아이템 추출 */
export async function extractActionItems(
  minutesText: string,
): Promise<{ title: string; assigneeName?: string; dueDate?: string }[]> {
  const result = await chat(
    `다음 회의록에서 액션 아이템(해야 할 일)을 모두 추출해주세요.\n\n` +
    `[회의록]\n${minutesText.slice(0, 6000)}\n\n` +
    `JSON 배열로만 반환 (다른 텍스트 없음):\n` +
    `[{"title":"할 일 내용","assigneeName":"담당자 이름 또는 null","dueDate":"YYYY-MM-DD 또는 null"}]`,
    600,
  )
  try {
    const cleaned = result.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim()
    const match   = cleaned.match(/\[[\s\S]*?\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch { return [] }
}

/** 문서 내용 → 마크다운 변환 */
export async function convertToMarkdown(content: string, fileName: string): Promise<string> {
  return chat(
    `다음은 "${fileName}" 파일의 내용입니다.\n\n` +
    `이 내용을 깔끔한 마크다운(Markdown) 형식으로 정리해주세요.\n` +
    `- 표 형태의 데이터는 마크다운 테이블로\n` +
    `- 섹션별로 헤딩(##, ###) 구분\n` +
    `- 핵심 내용만 간결하게 정리\n` +
    `- 한국어로 작성\n\n` +
    `[문서 내용]\n${content.slice(0, 8000)}`,
    2000,
  )
}

export async function generateDocumentDraft(
  documentType: string,
  projectContext: string,
  onChunk: (text: string) => void,
): Promise<void> {
  await chatStream(
    `한국 SI 업계 표준에 맞는 "${documentType}" 산출물 초안을 Markdown 형식으로 작성해주세요.\n` +
    `제목, 소제목, 표, 목록을 적절히 활용하고 모든 내용은 한국어로 작성하세요.\n\n` +
    `프로젝트 정보:\n${projectContext}`,
    onChunk,
  )
}

/** Groq Whisper STT — 오디오 Blob → 텍스트 변환 */
// Whisper 한국어 환각 패턴 (학습 데이터에서 유래한 잡음)
const WHISPER_HALLUCINATION_PATTERNS = [
  /한글\s*자막\s*by\s*\S+/gi,
  /자막\s*by\s*\S+/gi,
  /번역\s*by\s*\S+/gi,
  /편집\s*by\s*\S+/gi,
  /구독과\s*좋아요\s*부탁/gi,
  /좋아요\s*구독\s*알림/gi,
  /이\s*자막은\s*.+\s*작성/gi,
  /동영상\s*(제목|길이|설명)/gi,
  /조회수\s*\d+/gi,
  /업로드\s*일시/gi,
  /MBC|KBS|SBS|JTBC/g,
  // 유튜브 아웃로 환각 패턴
  /다음\s*영상에서\s*만나요/gi,
  /영상\s*봐\s*주셔서\s*감사/gi,
  /시청해\s*주셔서\s*감사/gi,
  /좋아요와\s*구독/gi,
  /구독\s*눌러/gi,
  /알림\s*설정/gi,
]

function removeHallucinations(text: string): string {
  let result = text
  for (const pattern of WHISPER_HALLUCINATION_PATTERNS) {
    result = result.replace(pattern, '')
  }
  // 빈 줄 정리
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!GQ_KEY) throw new Error('Groq API 키가 설정되지 않았습니다.')
  const form = new FormData()
  const ext  = audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('file', audioBlob, `audio.${ext}`)
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'ko')
  form.append('response_format', 'text')

  const res = await fetch(`${GQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GQ_KEY}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Whisper 오류 (${res.status})`)
  }
  const raw = (await res.text()).trim()
  return removeHallucinations(raw)
}

/** 회의 녹취록 → 핵심 요약 (불릿 포인트) */
export async function summarizeMeeting(transcript: string): Promise<string> {
  return chat(
    `다음은 회의 녹취록입니다. 핵심 논의 내용을 불릿 포인트로 간결하게 요약해주세요.\n\n` +
    `[녹취록]\n${transcript.slice(0, 12000)}`
  )
}
