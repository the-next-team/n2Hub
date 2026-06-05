const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const MODEL   = 'gemini-2.0-flash'
const BASE    = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`

function assertKey() {
  if (!API_KEY) throw new Error('Gemini API 키가 없습니다. .env.local에 VITE_GEMINI_API_KEY를 추가해주세요.')
}

/** 단순 생성 (non-streaming) */
async function generate(prompt: string, maxTokens = 1024): Promise<string> {
  assertKey()
  const res = await fetch(`${BASE}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Gemini 오류 (${res.status})`)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('응답에서 텍스트를 추출할 수 없습니다.')
  return text
}

/** 스트리밍 생성 */
async function generateStream(prompt: string, onChunk: (t: string) => void): Promise<void> {
  assertKey()
  const res = await fetch(`${BASE}:streamGenerateContent?key=${API_KEY}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Gemini 오류 (${res.status})`)
  }
  const reader  = res.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
      try {
        const t = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text
        if (t) onChunk(t)
      } catch { /* SSE 파싱 오류 무시 */ }
    }
  }
}

/* ── 공개 함수 ── */

/** OnlyOffice 파일 내용 요약 */
export async function summarizeDocument(content: string, fileName: string): Promise<string> {
  return generate(
    `다음 문서("${fileName}")의 내용을 분석해주세요.\n\n` +
    `주요 섹션, 핵심 내용, 중요 항목을 포함해서 5~10줄로 요약해주세요.\n\n` +
    `[문서 내용]\n${content}`,
    1024,
  )
}

/** 에디터 문서 버전 변경사항 요약 */
export async function summarizeChanges(prev: string, next: string): Promise<string> {
  return generate(
    `두 버전의 문서를 비교해서 변경 사항을 3~5줄로 요약해주세요.\n\n` +
    `[이전 버전]\n${prev}\n\n[새 버전]\n${next}`,
    512,
  )
}

/** AI 문서 초안 생성 (스트리밍) */
export async function generateDocumentDraft(
  documentType: string,
  projectContext: string,
  onChunk: (text: string) => void,
): Promise<void> {
  await generateStream(
    `당신은 IT 프로젝트 산출물 전문 작성 도우미입니다.\n` +
    `한국 SI 업계 표준에 맞는 전문적인 문서를 Markdown 형식으로 작성합니다.\n\n` +
    `다음 프로젝트의 "${documentType}" 산출물 초안을 작성해주세요.\n\n` +
    `프로젝트 정보:\n${projectContext}`,
    onChunk,
  )
}
