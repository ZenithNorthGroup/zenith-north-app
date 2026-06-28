'use client'

import { useState, useRef, useEffect } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn, formatDateTime } from '@/lib/utils'
import {
  IconSend, IconAlertTriangle, IconShield,
  IconSearch, IconMessage, IconDeviceMobile, IconPhone,
} from '@tabler/icons-react'

const CHANNELS = {
  platform:  { icon: IconMessage,      label: 'Platform', color: 'var(--zn-gold-dark)' },
  sms:       { icon: IconDeviceMobile, label: 'SMS',      color: '#6B7280' },
  phone_log: { icon: IconPhone,        label: 'Log call', color: '#6B7280' },
} as const
type ChannelKey = keyof typeof CHANNELS

function FlagBanner({ message, onReview }: { message: any; onReview: (id: string) => void }) {
  const isHigh = message.aiSeverity === 'high'
  return (
    <div
      className="mx-4 my-2 rounded-lg border px-3 py-3"
      style={{
        background: isHigh ? 'rgba(220,38,38,0.05)' : 'rgba(217,119,6,0.05)',
        borderColor: isHigh ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <IconAlertTriangle size={13} className="mt-0.5 flex-shrink-0"
            style={{ color: isHigh ? 'var(--zn-danger)' : 'var(--zn-warning)' }} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: isHigh ? 'var(--zn-danger)' : 'var(--zn-warning)' }}>
              AI compliance flag · {(message.aiSeverity ?? 'low').toUpperCase()} severity
            </div>
            <div className="mt-1 text-[12px] text-zn-text-2">{message.aiReason}</div>
            {message.aiExcerpt && (
              <div className="mt-1.5 rounded border border-zn-border bg-white px-2 py-1 text-[11px] text-zn-text-3 font-mono italic">
                "{message.aiExcerpt}"
              </div>
            )}
          </div>
        </div>
        {!message.reviewedAt && (
          <button
            onClick={() => onReview(message.id)}
            className="btn-ghost btn-sm flex-shrink-0"
          >
            Mark reviewed
          </button>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: any }) {
  const isOut = message.direction === 'outbound'
  const ch = CHANNELS[message.channel as ChannelKey] ?? CHANNELS.platform
  const Icon = ch.icon

  return (
    <div className={cn('flex flex-col gap-1', isOut && 'items-end')}>
      <div className={cn('flex items-center gap-1.5 text-[11px] text-zn-text-3', isOut && 'flex-row-reverse')}>
        <Icon size={10} style={{ color: ch.color }} />
        <span>{ch.label} · {isOut ? 'You' : 'Client'} · {formatDateTime(message.createdAt)}</span>
        {message.aiFlagged && !message.reviewedAt && (
          <span className="text-[var(--zn-warning)] font-medium">· Flagged</span>
        )}
      </div>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed',
          isOut ? 'rounded-br-md' : 'rounded-bl-md',
          message.aiFlagged && !message.reviewedAt ? 'ring-1 ring-[var(--zn-warning)] ring-opacity-40' : '',
        )}
        style={{
          background: isOut ? 'var(--zn-gold-bg)' : 'var(--zn-surface-2)',
          border: isOut
            ? '1px solid var(--zn-gold-border)'
            : '1px solid var(--zn-border)',
          color: 'var(--zn-text-1)',
        }}
      >
        {message.body}
      </div>
    </div>
  )
}

function ThreadItem({ thread, active, onClick }: { thread: any; active: boolean; onClick: () => void }) {
  const ch = CHANNELS[thread.channel as ChannelKey] ?? CHANNELS.platform
  const Icon = ch.icon
  const name = thread.clientName || `Client ${thread.clientId?.slice(0, 8)}`

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer border-b border-zn-border px-4 py-3.5 transition-colors',
        active ? 'bg-[var(--zn-gold-bg)]' : 'hover:bg-zn-surface-2',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {thread.aiFlagged && !thread.reviewedAt && (
            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
          )}
          <span className="text-[13px] font-medium text-zn-text-1 truncate">{name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <Icon size={10} style={{ color: ch.color }} />
          <span className="text-[10px] text-zn-text-3">{formatDateTime(thread.createdAt).split(',')[0]}</span>
        </div>
      </div>
      <div className="truncate text-[11px] text-zn-text-3">
        {thread.direction === 'outbound' ? 'You: ' : ''}{thread.body}
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const [activeThread,     setActiveThread]     = useState<string | null>(null)
  const [activeClientId,   setActiveClientId]   = useState<string | null>(null)
  const [activeClientName, setActiveClientName] = useState<string | null>(null)
  const [body,     setBody]     = useState('')
  const [channel,  setChannel]  = useState<ChannelKey>('platform')
  const [search,   setSearch]   = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: threads = [], isLoading, refetch: refetchThreads } = trpc.messages.listThreads.useQuery()
  const { data: messages = [], refetch: refetchMessages } = trpc.messages.getThread.useQuery(
    { threadId: activeThread! },
    { enabled: !!activeThread, refetchInterval: 5000 }
  )
  const sendMutation   = trpc.messages.send.useMutation({ onSuccess: () => { setBody(''); refetchMessages(); refetchThreads() } })
  const reviewMutation = trpc.messages.reviewFlag.useMutation({ onSuccess: () => refetchMessages() })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const filtered = search
    ? (threads as any[]).filter(t => t.body?.toLowerCase().includes(search.toLowerCase()) || t.clientName?.toLowerCase().includes(search.toLowerCase()))
    : (threads as any[])

  function handleSend() {
    if (!body.trim() || !activeClientId) return
    sendMutation.mutate({ clientId: activeClientId, threadId: activeThread ?? undefined, body: body.trim(), direction: 'outbound', channel })
  }

  return (
    <div
      className="animate-fade-in flex overflow-hidden rounded-xl border border-zn-border"
      style={{ height: 'calc(100vh - 52px - 48px)', background: '#fff' }}
    >
      {/* Thread list */}
      <div className="flex w-[280px] flex-shrink-0 flex-col border-r border-zn-border">
        <div className="border-b border-zn-border p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zn-text-3">
              Communications
            </span>
            <div className="flex items-center gap-1.5">
              <IconShield size={12} style={{ color: 'var(--zn-gold)' }} />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--zn-gold-dark)' }}>AI monitored</span>
            </div>
          </div>
          <div className="relative">
            <IconSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zn-text-3" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="field-input pl-8 text-[12px]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-b border-zn-border p-4">
                  <div className="mb-1.5 h-3 w-28 rounded bg-zn-surface-3 animate-pulse" />
                  <div className="h-2.5 w-40 rounded bg-zn-surface-3 animate-pulse" />
                </div>
              ))
            : filtered.length === 0
            ? <div className="px-4 py-8 text-center text-[12px] text-zn-text-3">No conversations yet</div>
            : filtered.map((t: any) => (
                <ThreadItem
                  key={t.id}
                  thread={t}
                  active={activeThread === t.threadId}
                  onClick={() => { setActiveThread(t.threadId); setActiveClientId(t.clientId); setActiveClientName(t.clientName ?? null) }}
                />
              ))
          }
        </div>
      </div>

      {/* Thread view */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[var(--zn-page)]">
        {!activeThread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'var(--zn-gold-bg)' }}>
              <IconShield size={24} style={{ color: 'var(--zn-gold)' }} />
            </div>
            <div className="text-[14px] font-semibold text-zn-text-1">Select a conversation</div>
            <div className="max-w-xs text-center text-[12px] text-zn-text-3 leading-relaxed">
              All messages are archived permanently and AI-monitored per SEC Rule 204-2. Every message is producible in seconds during an exam.
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between border-b border-zn-border bg-white px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}
                >
                  {(activeClientName ?? 'CL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-zn-text-1">
                    {activeClientName || `Client ${activeClientId?.slice(0, 8)}`}
                  </div>
                  <div className="text-[11px] text-zn-text-3">Archived · SEC Rule 204-2 compliant</div>
                </div>
              </div>
              <span className="pill-gold pill flex items-center gap-1">
                <IconShield size={9} /> AI monitoring on
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 px-5 py-5">
              {(messages as any[]).map(msg => (
                <div key={msg.id}>
                  <MessageBubble message={msg} />
                  {msg.aiFlagged && (
                    <FlagBanner message={msg} onReview={id => reviewMutation.mutate({ messageId: id })} />
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-zn-border bg-white px-5 py-4">
              <div className="mb-2.5 flex items-center gap-1.5">
                {(Object.entries(CHANNELS) as [ChannelKey, typeof CHANNELS[ChannelKey]][]).map(([key, cfg]) => {
                  const CIcon = cfg.icon
                  return (
                    <button
                      key={key}
                      onClick={() => setChannel(key)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-all',
                        channel === key
                          ? 'border-[var(--zn-gold-border)] bg-[var(--zn-gold-bg)] text-[var(--zn-gold-dark)]'
                          : 'border-zn-border bg-white text-zn-text-3 hover:border-zn-border-2 hover:text-zn-text-2',
                      )}
                    >
                      <CIcon size={12} /> {cfg.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-end gap-3">
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() } }}
                  placeholder={channel === 'sms' ? 'Send SMS to client...' : channel === 'phone_log' ? 'Log call notes...' : 'Send platform message...'}
                  rows={2}
                  className="field-input flex-1 resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!body.trim() || sendMutation.isPending}
                  className={cn('btn-gold self-end flex items-center gap-1.5', (!body.trim() || sendMutation.isPending) && 'opacity-50 cursor-not-allowed')}
                >
                  <IconSend size={13} />
                  {sendMutation.isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
