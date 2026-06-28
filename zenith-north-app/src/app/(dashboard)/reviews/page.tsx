'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, cn } from '@/lib/utils'
import {
  IconCheck, IconClock, IconCalendar, IconLoader2,
  IconAlertTriangle, IconRefresh,
} from '@tabler/icons-react'

const STATUS_TABS = ['upcoming', 'overdue', 'completed', 'all'] as const
type StatusTab = typeof STATUS_TABS[number]

export default function ReviewsPage() {
  const [tab,        setTab]        = useState<StatusTab>('upcoming')
  const [completing, setCompleting] = useState<string | null>(null)
  const [notes,      setNotes]      = useState('')

  const { data: reviews = [], isLoading, refetch } = trpc.reviews.list.useQuery({ status: tab })
  const { data: summary } = trpc.reviews.summary.useQuery()

  const completeMutation = trpc.reviews.complete.useMutation({ onSuccess: () => { refetch(); setCompleting(null); setNotes('') } })
  const scheduleMutation = trpc.reviews.schedule.useMutation({ onSuccess: () => refetch() })
  const syncMutation     = trpc.reviews.syncFromClients.useMutation({ onSuccess: () => refetch() })

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Overdue',         value: summary?.overdue       ?? '—', accent: 'var(--zn-danger)' },
          { label: 'Due in 30 days',  value: summary?.due30d        ?? '—', accent: 'var(--zn-warning)' },
          { label: 'Due in 60 days',  value: summary?.due60d        ?? '—', accent: 'var(--zn-gold-dark)' },
          { label: 'Completed (90d)', value: summary?.recentCompleted ?? '—', accent: 'var(--zn-success)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-num" style={{ color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + sync */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {STATUS_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[12px] font-medium capitalize transition-all',
                tab === t
                  ? 'border-[var(--zn-gold)] bg-[var(--zn-gold-bg)] text-[var(--zn-gold-dark)]'
                  : 'border-zn-border bg-white text-zn-text-2 hover:border-zn-border-2',
              )}>
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="btn-ghost btn-sm flex items-center gap-1.5"
        >
          {syncMutation.isPending ? <IconLoader2 size={13} className="animate-spin" /> : <IconRefresh size={13} />}
          Sync from clients
        </button>
      </div>

      {/* Complete modal */}
      {completing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-xl border border-zn-border bg-white p-6 shadow-xl">
            <div className="mb-4 text-[15px] font-semibold text-zn-text-1">Mark review complete</div>
            <label className="field-label">Review notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Summary of what was discussed..." rows={4} className="field-input mb-4 resize-none" />
            <div className="flex gap-3">
              <button
                onClick={() => completeMutation.mutate({ id: completing, notes, outcome: 'completed' })}
                disabled={completeMutation.isPending}
                className="btn-gold flex items-center gap-1.5 flex-1 justify-center"
              >
                {completeMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
                Mark complete
              </button>
              <button onClick={() => setCompleting(null)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="card">
        <div className="card-header">
          <span className="card-title capitalize">{tab} reviews ({(reviews as any[]).length})</span>
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0">
              <div className="h-8 w-8 rounded-full bg-zn-surface-3 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 rounded bg-zn-surface-3 animate-pulse" />
                <div className="h-2.5 w-28 rounded bg-zn-surface-3 animate-pulse" />
              </div>
            </div>
          ))
        ) : (reviews as any[]).length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <IconCheck size={24} style={{ color: 'var(--zn-success)' }} />
            <div className="text-[13px] font-medium text-zn-text-1">No {tab} reviews</div>
          </div>
        ) : (
          (reviews as any[]).map((review: any) => {
            const daysUntil = Number(review.days_until_due)
            const isOverdue = !review.completed_at && daysUntil < 0
            const isDueSoon = !review.completed_at && daysUntil >= 0 && daysUntil <= 30

            return (
              <div key={review.id} className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0">
                {/* Avatar */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
                  {(review.client_name ?? 'CL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zn-text-1">{review.client_name ?? 'Unknown client'}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zn-text-3">
                    {review.advisor_name && <span>{review.advisor_name}</span>}
                    <span className="flex items-center gap-1">
                      <IconCalendar size={10} />
                      Due {formatDate(review.due_at)}
                    </span>
                    {review.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <IconClock size={10} />
                        Scheduled {formatDate(review.scheduled_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {review.completed_at ? (
                    <span className="pill-success pill">Completed {formatDate(review.completed_at)}</span>
                  ) : isOverdue ? (
                    <span className="pill-danger pill flex items-center gap-1">
                      <IconAlertTriangle size={10} /> {Math.abs(daysUntil)}d overdue
                    </span>
                  ) : isDueSoon ? (
                    <span className="pill-warn pill">Due in {daysUntil}d</span>
                  ) : (
                    <span className="pill-ghost pill">Due in {daysUntil}d</span>
                  )}
                </div>

                {/* Actions */}
                {!review.completed_at && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setCompleting(review.id)}
                      className="btn-gold btn-sm flex items-center gap-1"
                    >
                      <IconCheck size={11} /> Complete
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
