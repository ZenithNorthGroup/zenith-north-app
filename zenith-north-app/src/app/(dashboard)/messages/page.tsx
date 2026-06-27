'use client'

import { useState, useRef, useEffect } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn, formatDateTime } from '@/lib/utils'
import {
  IconSend, IconAlertTriangle,
  IconShield, IconSearch, IconMessage,
  IconDeviceMobile, IconPhone,
} from '@tabler/icons-react'

// ── Channel config ─────────────────────────────────────────

const CHANNELS = {
  platform:  { icon: IconMessage,      label: 'Platform', color: 'text-zn-gold' },
  sms:       { icon: IconDeviceMobile, label: 'SMS',      color: 'text-zn-text-2' },
  phone_log: { icon: IconPhone,        label: 'Log call', color: 'text-zn-text-2' },
} as const

type ChannelKey = keyof typeof CHANNELS

// ── Sub-components ─────────────────────────────────────────

function FlagBanner({ message, onReview }: { message: any; onReview: (id: string) => void }) {
  const severity = message.aiSeverity ?? 'low'
  const cls = severity === 'high'
    ? 'border-zn-danger/30 bg-zn-danger/8 text-zn-danger'
    : severity === 'medium'
    ? 'border-zn-warning/30 bg-zn-warning/8 text-zn-warning'
    : 'border-zn-border bg-zn-surface-3 text-zn-text-2'

  return (
    <div className={cn('mx-4 my-2 rounded border px-3 py-2.5', cls)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <IconAlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-mono text-[10px] font-medium tracking-wide">
              AI FLAG · {severity.toUpperCase()} SEVERITY
            </div>
            <div className="mt-1 text-[12px] leading-snug opacity-90">
              {message.aiReason}
            </div>
            {message.aiExcerpt && (
              <div className="mt-1.5 rounded border border-current/20 bg-current/5 px-2 py-1 font-mono text-[10px] opacity-75">
                "{message.aiExcerpt}"
              </div>
            )}
          </div>
        </div>
        {!message.reviewedAt && (
          <button
            onClick={() => onReview(message.id)}
            className="flex-shrink-0 rounded border border-current/30 px-2 py-1 font-mono text-[10px]"
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
  const ChannelIcon = ch.icon

  return (
    <div className={cn('flex flex-col gap-1', isOut && 'items-end')}>
      <div className={cn(
        'flex items-center gap-1.5 font-mono text-[10px] text-zn-text-3',
        isOut && 'flex-row-reverse',
      )}>
        <ChannelIcon size={10} className={ch.color} />
        <span>
          {ch.label} · {isOut ? 'You' : 'Client'} · {formatDateTime(message.createdAt)}
        </span>
        {message.aiFlagged && !message.reviewedAt && (
          <span className="text-zn-warning">· FLAGGED</span>
        )}
      </div>
      <div className={cn(
        'max-w-[75%] rounded-lg px-3 py-2.5 text-sm leading-relaxed',
        isOut
          ? 'rounded-br border border-zn-gold/15 bg-zn-gold/8 text-zn-text-1'
          : 'rounded-bl border border-zn-border bg-zn-surface-2 text-zn-text-1',
        message.aiFlagged && !message.reviewedAt && 'border-zn-warning/30',
      )}>
        {message.body}
      </div>
    </div>
  )
}

function ThreadItem({
  thread, active, onClick,
}: {
  thread: any; active: boolean; onClick: () => void
}) {
  const ch = CHANNELS[thread.channel as ChannelKey] ?? CHANNELS.platform
  const ChannelIcon = ch.icon

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer border-b border-zn-border px-3 py-3 transition-colors',
        active ? 'bg-zn-gold/8' : 'hover:bg-zn-surface-2',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          {thread.aiFlagged && !thread.reviewedAt && (
            <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zn-danger" />
          )}
          <span className="truncate text-sm font-medium text-zn-text-1">
            {thread.clientName || `Client ${thread.clientId?.slice(0, 8)}`}
          </span>
        </div>
        <div className="ml-2 flex flex-shrink-0 items-center gap-1">
          <ChannelIcon size={10} className={ch.color} />
          <span className="font-mono text-[9px] text-zn-text-3">
            {formatDateTime(thread.createdAt).split(',')[0]}
          </span>
        </div>
      </div>
      <div className="truncate font-mono text-[10px] text-zn-text-3">
        {thread.direction === 'outbound' ? 'You: ' : ''}{thread.body}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function MessagesPage() {
  const [activeThread, setActiveThread]     = useState<string | null>(null)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [activeClientName, setActiveClientName] = useState<string | null>(null)
  const [body, setBody]                     = useState('')
  const [channel, setChannel]               = useState<ChannelKey>('platform')
  const [search, setSearch]                 = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: threads = [], isLoading, refetch: refetchThreads } =
    trpc.messages.listThreads.useQuery()

  const { data: messages = [], refetch: refetchMessages } =
    trpc.messages.getThread.useQuery(
      { threadId: activeThread! },
      { enabled: !!activeThread, refetchInterval: 5000 }
    )

  const sendMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      setBody('')
      refetchMessages()
      refetchThreads()
    },
  })

  const reviewMutation = trpc.messages.reviewFlag.useMutation({
    onSuccess: () => refetchMessages(),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredThreads = search
    ? (threads as any[]).filter(t =>
        t.body?.toLowerCase().includes(search.toLowerCase())
      )
    : (threads as any[])

  function handleSend() {
    if (!body.trim() || !activeClientId) return
    sendMutation.mutate({
      clientId:  activeClientId,
      threadId:  activeThread ?? undefined,
      body:      body.trim(),
      direction: 'outbound',
      channel,
    })
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="animate-fade-in flex h-[calc(100vh-50px-40px)] overflow-hidden rounded-md border border-zn-border">

      {/* Thread list */}
      <div className="flex w-64 flex-shrink-0 flex-col border-r border-zn-border bg-zn-surface">
        <div className="border-b border-zn-border px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zn-text-3">
              Communications
            </span>
            <div className="flex items-center gap-1">
              <IconShield size={11} className="text-zn-gold" />
              <span className="font-mono text-[9px] text-zn-gold">MONITORED</span>
            </div>
          </div>
          <div className="relative">
            <IconSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zn-text-3" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded border border-zn-border bg-zn-surface-2 py-1.5 pl-7 pr-3 font-mono text-[11px] text-zn-text-1 placeholder:text-zn-text-3 focus:border-zn-gold-dim focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-b border-zn-border p-3">
                  <div className="mb-1.5 h-3 w-32 rounded bg-zn-surface-3 animate-pulse" />
                  <div className="h-2 w-40 rounded bg-zn-surface-3 animate-pulse" />
                </div>
              ))
            : filteredThreads.length === 0
            ? (
              <div className="px-4 py-8 text-center font-mono text-[11px] text-zn-text-3">
                No conversations yet
              </div>
            )
            : filteredThreads.map((t: any) => (
              <ThreadItem
                key={t.id}
                thread={t}
                active={activeThread === t.threadId}
                onClick={() => {
                  setActiveThread(t.threadId)
                  setActiveClientId(t.clientId)
                  setActiveClientName(t.clientName ?? null)
                }}
              />
            ))
          }
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col overflow-hidden bg-zn-black">
        {!activeThread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <IconShield size={28} className="text-zn-text-3" />
            <div className="font-mono text-[11px] text-zn-text-3">
              SELECT A CONVERSATION
            </div>
            <div className="max-w-xs text-center font-mono text-[10px] text-zn-text-3 opacity-70">
              All messages archived permanently per SEC Rule 204-2.
              AI monitoring active. Every message is producible in
              seconds during an exam. No third-party archiver needed.
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between border-b border-zn-border bg-zn-surface px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zn-border-2 bg-zn-surface-3 font-mono text-[10px] text-zn-text-2">
                  CL
                </div>
                <div>
                  <div className="text-sm font-medium text-zn-text-1">
                    {activeClientName || `Client ${activeClientId?.slice(0, 8)}`}
                  </div>
                  <div className="font-mono text-[10px] text-zn-text-3">
                    ALL CHANNELS · SEC RULE 204-2 COMPLIANT
                  </div>
                </div>
              </div>
              <span className="pill pill-ghost font-mono text-[9px]">
                <IconShield size={9} className="mr-1 text-zn-gold" />
                AI MONITORING ON
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
              {(messages as any[]).map(msg => (
                <div key={msg.id}>
                  <MessageBubble message={msg} />
                  {msg.aiFlagged && (
                    <FlagBanner
                      message={msg}
                      onReview={id => reviewMutation.mutate({ messageId: id })}
                    />
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-zn-border bg-zn-surface px-4 py-3">
              {/* Channel selector */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {(Object.entries(CHANNELS) as [ChannelKey, typeof CHANNELS[ChannelKey]][]).map(([key, cfg]) => {
                    const CIcon = cfg.icon
                    return (
                      <button
                        key={key}
                        onClick={() => setChannel(key)}
                        className={cn(
                          'flex items-center gap-1 rounded border px-2.5 py-1 font-mono text-[10px] transition-all',
                          channel === key
                            ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
                            : 'border-zn-border text-zn-text-3 hover:border-zn-border-2',
                        )}
                      >
                        <CIcon size={11} /> {cfg.label}
                      </button>
                    )
                  })}
                </div>
                <div className="font-mono text-[9px] text-zn-text-3">
                  <IconShield size={9} className="mr-1 inline text-zn-gold" />
                  Archived · AI monitored · Exam-ready
                </div>
              </div>

              {/* Input */}
              <div className="flex items-end gap-3">
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={
                    channel === 'sms'
                      ? 'Send SMS to client... (⌘↵ to send)'
                      : channel === 'phone_log'
                      ? 'Log phone call notes... (⌘↵ to save)'
                      : 'Send platform message... (⌘↵ to send)'
                  }
                  rows={2}
                  className="flex-1 resize-none rounded border border-zn-border bg-zn-surface-2 px-3 py-2 text-sm text-zn-text-1 placeholder:text-zn-text-3 focus:border-zn-gold-dim focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!body.trim() || sendMutation.isPending}
                  className={cn(
                    'btn-gold self-end flex items-center gap-1.5',
                    (!body.trim() || sendMutation.isPending) && 'cursor-not-allowed opacity-50',
                  )}
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
