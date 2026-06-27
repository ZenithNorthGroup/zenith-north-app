'use client'

import Link from 'next/link'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn, formatDate } from '@/lib/utils'
import { IconDownload, IconChevronRight } from '@tabler/icons-react'

// ── Compliance item card ───────────────────────────────────

function ComplianceCard({ item, onResolve, onSnooze }: {
  item: any
  onResolve: (id: string) => void
  onSnooze:  (id: string, days: number) => void
}) {
  const isCritical = item.severity === 'critical'

  return (
    <div className={cn(
      'flex items-start gap-3 border-b border-zn-border px-4 py-4 last:border-0',
      'transition-colors hover:bg-zn-surface-2',
    )}>
      {/* Severity stripe */}
      <div className={cn(
        'mt-0.5 w-[3px] self-stretch rounded-full flex-shrink-0',
        isCritical ? 'bg-zn-danger' : 'bg-zn-warning',
      )} />

      <div className="flex-1 min-w-0">
        <div className="mb-1 text-sm font-medium text-zn-text-1">
          {item.title}
        </div>
        <div className="mb-3 font-mono text-[10px] text-zn-text-3">
          {item.dueAt
            ? `DUE ${formatDate(item.dueAt).toUpperCase()}`
            : item.description?.toUpperCase() ?? ''
          }
          {' · '}
          {item.itemType.replace(/_/g, ' ').toUpperCase()}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onResolve(item.id)}
            className="btn-gold btn-sm"
          >
            Resolve
          </button>
          <button
            onClick={() => onSnooze(item.id, 7)}
            className="btn-ghost btn-sm"
          >
            Snooze 7d
          </button>
          {item.clientId && (
            <Link
              href={`/clients/${item.clientId}`}
              className="btn-ghost btn-sm"
            >
              View client
            </Link>
          )}
        </div>
      </div>

      <span className={cn('pill flex-shrink-0', isCritical ? 'pill-danger' : 'pill-warn')}>
        {item.severity}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function CompliancePage() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all')

  const { data, isLoading, refetch } = trpc.compliance.dashboard.useQuery()
  const resolveMutation = trpc.compliance.resolve.useMutation({
    onSuccess: () => refetch(),
  })
  const snoozeMutation  = trpc.compliance.snooze.useMutation({
    onSuccess: () => refetch(),
  })

  const stats   = data?.stats
  const allItems = data?.items ?? []
  const filings  = data?.filings ?? []

  const filtered = filter === 'all'
    ? allItems
    : allItems.filter(i => i.severity === filter)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
            Compliance
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            {isLoading
              ? 'Loading...'
              : `${stats?.critical ?? 0} CRITICAL · ${stats?.warning ?? 0} WARNING · SCANNED RECENTLY`
            }
          </p>
        </div>
        <button className="btn-ghost flex items-center gap-1.5">
          <IconDownload size={13} /> Export report
        </button>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <button
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
          className={cn('stat-card text-left', filter === 'critical' && 'border-zn-danger/40')}
        >
          <div className="stat-label">Critical</div>
          <div className="stat-num text-zn-danger">{stats?.critical ?? 0}</div>
          <div className="stat-delta">Require immediate action</div>
        </button>
        <button
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          className={cn('stat-card text-left', filter === 'warning' && 'border-zn-warning/40')}
        >
          <div className="stat-label">Warnings</div>
          <div className="stat-num text-zn-warning">{stats?.warning ?? 0}</div>
          <div className="stat-delta">Review within 7 days</div>
        </button>
        <div className="stat-card">
          <div className="stat-label">Reviews overdue</div>
          <div className="stat-num text-zn-warning">
            {stats?.byType.annualReview ?? 0}
          </div>
          <div className="stat-delta">Of all active clients</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-3 flex items-center gap-1.5">
        {(['all', 'critical', 'warning'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wide transition-all',
              filter === f
                ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
                : 'border-zn-border bg-transparent text-zn-text-3 hover:border-zn-border-2',
            )}
          >
            {f === 'all' ? `All (${allItems.length})` : `${f} (${allItems.filter(i => i.severity === f).length})`}
          </button>
        ))}
      </div>

      {/* Action queue */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Action queue</span>
          <span className="font-mono text-[10px] text-zn-text-3">
            {filtered.length} open item{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-b border-zn-border p-4 last:border-0">
                <div className="mb-2 h-3 w-2/3 rounded bg-zn-surface-3 animate-pulse" />
                <div className="h-2 w-1/3 rounded bg-zn-surface-3 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="font-mono text-[11px] text-zn-text-3">
              {filter === 'all' ? '✓ No open compliance items.' : `No ${filter} items.`}
            </div>
          </div>
        ) : (
          filtered.map(item => (
            <ComplianceCard
              key={item.id}
              item={item}
              onResolve={id => resolveMutation.mutate({ id })}
              onSnooze={(id, days) => snoozeMutation.mutate({ id, days, reason: 'Deferred by CCO' })}
            />
          ))
        )}
      </div>

      {/* Filing calendar */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">SEC filing calendar</span>
          <Link href="/calendar" className="card-action">View calendar</Link>
        </div>
        <div className="px-4">
          {filings.length === 0 ? (
            // Static fallback
            [
              { date: 'JUL 29', title: 'Form ADV annual amendment', meta: 'SEC FILING · 35 DAYS', soon: true },
              { date: 'AUG 14', title: 'Form PF quarterly filing',  meta: 'SEC FILING · 51 DAYS', soon: false },
              { date: 'SEP 1',  title: 'Annual compliance review',   meta: 'INTERNAL · 69 DAYS',  soon: false },
            ].map(f => (
              <div key={f.date} className="flex items-center gap-3 border-b border-zn-border py-3 last:border-0">
                <div className={cn('min-w-[48px] font-mono text-[10px]', f.soon ? 'text-zn-warning' : 'text-zn-text-3')}>
                  {f.date}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-zn-text-1">{f.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">{f.meta}</div>
                </div>
                <span className={cn('pill', f.soon ? 'pill-danger' : 'pill-ghost')}>
                  {f.soon ? '35d' : '51d+'}
                </span>
              </div>
            ))
          ) : (
            filings.map(event => (
              <div key={event.id} className="flex items-center gap-3 border-b border-zn-border py-3 last:border-0">
                <div className="min-w-[48px] font-mono text-[10px] text-zn-text-3">
                  {formatDate(event.dueAt, { month: 'short', day: 'numeric' }).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-zn-text-1">{event.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">
                    SEC FILING
                  </div>
                </div>
                <span className="pill pill-ghost">
                  {Math.ceil((new Date(event.dueAt).getTime() - Date.now()) / 86400000)}d
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
