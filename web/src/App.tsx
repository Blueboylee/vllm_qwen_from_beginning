import { useState, useRef, useEffect } from 'react'
import { streamChat, type Message } from './api'
import Monitor from './Monitor'
import GpuDashboard from './GpuDashboard'
import './App.css'

type ChatMessage = Message & { id: string; streaming?: boolean }

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'monitor' | 'gpu'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', streaming: true }])
    setLoading(true)

    const history: Message[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ]

    try {
      await streamChat(
        history,
        (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + delta } : m
            )
          )
        },
        () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
          )
        }
      )
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      setError(errMsg)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `[错误] ${errMsg}`, streaming: false } : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div>
            <h1 className="title">Qwen AI 推理服务</h1>
            <span className="subtitle">本地 Qwen 2.5 7B GPTQ-Int8 · vLLM · Continuous Batching</span>
          </div>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 对话
            </button>
            <button
              className={`tab ${activeTab === 'monitor' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitor')}
            >
              📊 监控
            </button>
            <button
              className={`tab ${activeTab === 'gpu' ? 'active' : ''}`}
              onClick={() => setActiveTab('gpu')}
            >
              🎮 GPU
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'monitor' && (
        <div className="tab-panel">
          <Monitor />
        </div>
      )}
      {activeTab === 'gpu' && (
        <div className="tab-panel">
          <GpuDashboard />
        </div>
      )}
      {activeTab === 'chat' && (
        <div className="tab-panel chat-panel">
      <div className="list" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p>输入消息开始对话，支持流式输出。</p>
            <p className="empty-hint">请确保 WSL 中模型服务已启动（如 localhost:8000）</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.role}`}
            data-streaming={msg.streaming ?? false}
          >
            <span className="message-role">{msg.role === 'user' ? '你' : 'Qwen'}</span>
            <div className="message-content">
              {msg.content || (msg.streaming ? '▌' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="error-bar">
          {error}
        </div>
      )}

      <div className="input-wrap">
        <textarea
          className="input"
          placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
        />
        <button
          type="button"
          className="send-btn"
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? '生成中…' : '发送'}
        </button>
      </div>
        </div>
      )}
    </div>
  )
}

export default App
