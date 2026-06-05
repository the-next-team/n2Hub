const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

function assertApiKey() {
  if (!API_KEY) throw new Error('Anthropic API 키가 설정되지 않았습니다. .env.local에 VITE_ANTHROPIC_API_KEY를 추가해주세요.')
}

export async function generateDocumentDraft(
  documentType: string,
  projectContext: string,
  onChunk: (text: string) => void
): Promise<void> {
  assertApiKey()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      stream: true,
      system: `당신은 IT 프로젝트 산출물 전문 작성 도우미입니다.
한국 SI 업계 표준에 맞는 전문적인 문서를 작성합니다.
Markdown 형식으로 작성하되 제목, 소제목, 표, 목록을 적절히 활용하세요.`,
      messages: [{
        role: 'user',
        content: `다음 프로젝트의 "${documentType}" 산출물 초안을 작성해주세요.\n\n프로젝트 정보:\n${projectContext}`,
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API 오류 (${response.status})`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'content_block_delta') {
          onChunk(data.delta.text)
        }
      } catch {
        // SSE 파싱 오류 무시
      }
    }
  }
}

/** OnlyOffice 파일 텍스트 추출 후 AI 요약 */
export async function summarizeDocument(
  content: string,
  fileName: string,
): Promise<string> {
  assertApiKey()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `다음 문서("${fileName}")의 내용을 분석해주세요.\n\n` +
          `주요 섹션, 핵심 내용, 중요 항목을 포함하여 5~10줄로 요약해주세요.\n\n` +
          `[문서 내용]\n${content}`,
      }],
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message ?? `API 오류 (${response.status})`)
  const text = data.content?.[0]?.text
  if (!text) throw new Error('응답에서 텍스트를 추출할 수 없습니다.')
  return text
}

export async function summarizeChanges(
  prevContent: string,
  newContent: string
): Promise<string> {
  assertApiKey()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `두 버전의 산출물을 비교해서 변경 사항을 3~5줄로 요약해주세요.\n\n[이전 버전]\n${prevContent}\n\n[새 버전]\n${newContent}`,
      }],
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message ?? `API 오류 (${response.status})`)
  }
  const text = data.content?.[0]?.text
  if (!text) throw new Error('응답에서 텍스트를 추출할 수 없습니다.')
  return text
}
