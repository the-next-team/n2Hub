export async function generateDocumentDraft(
  documentType: string,
  projectContext: string,
  onChunk: (text: string) => void
): Promise<void> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY as string,
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

export async function summarizeChanges(
  prevContent: string,
  newContent: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY as string,
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
  return data.content[0].text
}
