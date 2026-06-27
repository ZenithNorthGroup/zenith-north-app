'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  IconSparkles, IconSend, IconUser,
  IconSearch, IconRefresh,
} from '@tabler/icons-react'

// ── Types ─────────────────────────────────────────────────

interface Message {
  role:    'user' | 'assistant'
  content: string
  loading?: boolean
}

// ── Suggestions ────────────────────────────────────────────

const SUGGESTIONS = [
  'Which clients are overdue for annual reviews?',
  'Show me all flagged communications from the last 30 days',
  'Find clients with missing signed agreements',
  'Which onboardings have been stalled for more than 14 days?',
  'What SEC filings are due in the next 60 days?',
  'Find all clients with KYC needing review',
  'Summarize all open critical compliance items',
  'What happened in the audit log today?',
]

// ── Markdown-ish renderer ──────────────────────────────────

function MessageContent({ content }: { content: string }) {
  // Simple markdown rendering for bold and bullet points
  const lines = content.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-zn-gold flex-shrink-0 mt-0.5">·</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          )
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} className="font-medium text-zn-text-1">{line.slice(2, -2)}</div>
        }
        if (line === '') return <div key={i} className="h-2" />
        return <div key={i}>{renderInline(line)}</div>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-medium text-zn-text-1">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

// ── Message bubble ─────────────────────────────────────────

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[10px]',
        isUser
          ? 'border-zn-border-2 bg-zn-surface-3 text-zn-text-2'
          : 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold',
      )}>
        {isUser ? <IconUser size={13} /> : <IconSparkles size={13} />}
      </div>

      <div className={cn(
        'max-w-[82%] rounded-lg px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'rounded-br bg-zn-surface-2 text-zn-text-1'
          : 'rounded-bl border border-zn-gold/15 bg-zn-gold/6 text-zn-text-1',
      )}>
        {message.loading ? (
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-zn-gold animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
            <span className="font-mono text-[11px] text-zn-text-3 ml-1">Thinking...</span>
          </div>
        ) : isUser ? (
          <span>{message.content}</span>
        ) : (
          <MessageContent content={message.content} />
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role:    'assistant',
      content: 'I have access to your firm\'s live data — clients, compliance items, workflows, communications, and audit log. Ask me anything in plain English.',
    },
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(question?: string) {
    const q = (question ?? input).trim()
    if (!q || loading) return

    setInput('')

    const userMessage:    Message = { role: 'user',      content: q }
    const loadingMessage: Message = { role: 'assistant', content: '', loading: true }

    setMessages(prev => [...prev, userMessage, loadingMessage])
    setLoading(true)

    try {
      // Get conversation history (exclude loading message and system messages)
      const history = messages
        .filter(m => !m.loading)
        .slice(1) // skip the initial greeting
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/ai/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: q, history }),
      })

      if (!response.ok) throw new Error('API error')

      const data = await response.json()

      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: data.answer },
      ])
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Something went wrong connecting to the AI. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleReset() {
    setMessages([{
      role:    'assistant',
      content: 'I have access to your firm\'s live data — clients, compliance items, workflows, communications, and audit log. Ask me anything in plain English.',
    }])
    setInput('')
  }

  const showSuggestions = messages.length <= 1

  return (
    <div className="animate-fade-in flex h-[calc(100vh-50px-40px)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zn-gold/30 bg-zn-gold/10">
            <IconSparkles size={16} className="text-zn-gold" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-zn-text-1">AI assistant</div>
            <div className="font-mono text-[11px] text-zn-text-3">
              LIVE FIRM DATA · CLAUDE SONNET 4.6
            </div>
          </div>
        </div>
        <button onClick={handleReset} className="btn-ghost flex items-center gap-1.5 btn-sm">
          <IconRefresh size={12} /> New conversation
        </button>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto rounded-md border border-zn-border bg-zn-surface p-4 space-y-4">
        {messages.map((msg, i) => <Bubble key={i} message={msg} />)}

        {/* Suggestions */}
        {showSuggestions && (
          <div className="pt-2">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-zn-text-3">
              Try asking
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  disabled={loading}
                  className="rounded border border-zn-border bg-zn-surface-2 px-3 py-2.5 text-left text-sm text-zn-text-2 transition-all hover:border-zn-gold/30 hover:text-zn-text-1 disabled:opacity-50"
                >
                  <IconSearch size={11} className="mb-1 text-zn-text-3" />
                  <div>{s}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about your clients, compliance, or workflows..."
          rows={2}
          className="flex-1 resize-none rounded border border-zn-border bg-zn-surface px-4 py-3 text-sm text-zn-text-1 placeholder:text-zn-text-3 focus:border-zn-gold-dim focus:outline-none"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className={cn(
            'btn-gold self-end flex items-center gap-1.5',
            (!input.trim() || loading) && 'cursor-not-allowed opacity-50',
          )}
        >
          <IconSend size={13} />
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      <div className="mt-2 font-mono text-[10px] text-zn-text-3 text-center">
        AI has access to live firm data · Responses are not legal or financial advice
      </div>
    </div>
  )
}
