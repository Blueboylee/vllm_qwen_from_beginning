const API_BASE = '/v1'

export type Message = { role: 'user' | 'assistant' | 'system'; content: string }

export async function streamChat(
  messages: Message[],
  onDelta: (text: string) => void,
  onDone?: () => void,
  model = 'qwen',
  maxTokens = 1500,
  temperature = 0.5
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API 错误 ${res.status}: ${err}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取流')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue
        try {
          const data = JSON.parse(trimmed.slice(6))
          const content = data.choices?.[0]?.delta?.content
          if (typeof content === 'string') onDelta(content)
        } catch {
          // 忽略单行解析错误
        }
      }
    }
    onDone?.()
  } finally {
    reader.releaseLock()
  }
}
