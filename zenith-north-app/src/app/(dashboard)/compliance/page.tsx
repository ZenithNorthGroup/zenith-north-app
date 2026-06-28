'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  IconShield, IconAlertTriangle, IconCheck,
  IconClock, IconBellOff, IconArrowUpRight,
} from '@tabler/icons-react'

const SEVERITY_CONFIG = {
  critical: { pill: 'pill-danger pill', dot: 'var(--zn-danger)',  label: 'Critical' },
  warning:  { pill: 'pill-warn pill',   dot: 'var(--zn-warning)', label: 'Warning' },
  info:     { pill: 'pill-info pill',   dot: '#3B82F6',           label: 'Info' },
} as const

const TYPE_LABELS: Record<string, string> = {
  annual_review_overdue: 'Annual review',
  kyc_expiry:            'KYC / Identity',
  kyc_expired:           'KYC expired',
  sec_filing_due:        'SEC filing',
  filing_deadline:       'Filing deadline',
  communication_flagged: 'Comms flag',
  stalled_workflow:      'Stalled workflow',
  missing_document:      'Missing document',
  missing_signature:     'Missing signature',
}

export default function CompliancePage() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const { data, isLoading, refetch } = trpc.compliance.dashboard.useQuery()
  const resolveMutation = trpc.compliance.resolve.useMutation({ onSuccess: () => refetch() })
  const snoozeMutation  = trpc.compliance.snooze.useMutation({ onSuccess: () => refetch() })

  const items   = data?.items ?? []
  const stats   = data?.stats
  const filings = data?.filings ?? []

  const filtered = filter === 'all' ? items : items.filter(i => i.severity === filter)

  return (
    <div className="animate-fade-in">
      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Critical',  value: stats?.critical ?? '—', accent: 'var(--zn-danger)',  filter: 'critical' },
          { label: 'Warning',   value: stats?.warning  ?? '—', accent: 'var(--zn-warning)', filter: 'warning' },
          { label: 'Info',      value: stats?.info     ?? '—', accent: '#3B82F6',            filter: 'info' },
          { label: 'Upcoming filings', value: filings.length, accent: 'var(--zn-gold-dark)', filter: 'all' },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setFilter(s.filter as typeof filter)}
            className={cn('stat-card cursor-pointer relative', filter === s.filter && 'ring-2 ring-[var(--zn-gold)] ring-opacity-40')}
          >
            <div
              className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg"
              style={{ background: s.accent }}
            />
            <div className="stat-label">{s.label}</div>
            <div className="stat-num" style={{ color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Main list */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {filter === 'all' ? 'All open items' : `${filter} items`}
            </span>
            <div className="flex gap-1.5">
              {(['all', 'critical', 'warning', 'info'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-all',
                    filter === f
                      ? 'text-[var(--zn-gold-dark)] bg-[var(--zn-gold-bg)]'
                      : 'text-zn-text-3 hover:text-zn-text-2',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-4 border-b border-zn-border last:border-0">
                <div className="h-2 w-2 rounded-full bg-zn-surface-3 animate-pulse mt-1.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 rounded bg-zn-surface-3 animate-pulse" />
                  <div className="h-2.5 w-64 rounded bg-zn-surface-3 animate-pulse" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'var(--zn-success-bg)' }}>
                <IconShield size={22} style={{ color: 'var(--zn-success)' }} />
              </div>
              <div className="text-[13px] font-medium text-zn-text-1">All clear</div>
              <div className="text-[12px] text-zn-text-3">No open compliance items in this category.</div>
            </div>
          ) : (
            filtered.map(item => {
              const sev = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-4 border-b border-zn-border px-5 py-4 last:border-0 hover:bg-zn-surface-2 transition-colors group"
                >
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: sev.dot }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[13px] font-medium text-zn-text-1">{item.title}</span>
                      <span className={sev.pill}>{sev.label}</span>
                      {item.itemType && (
                        <span className="pill-ghost pill text-[10px]">
                          {TYPE_LABELS[item.itemType] ?? item.itemType}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <div className="text-[12px] text-zn-text-3 mb-2">{item.description}</div>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-zn-text-3">
                      {item.dueAt && (
                        <span className="flex items-center gap-1">
                          <IconClock size={11} />
                          Due {formatDate(item.dueAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => resolveMutation.mutate({ itemId: item.id })}
                      className="flex items-center gap-1 rounded-md border border-[var(--zn-success-border)] bg-[var(--zn-success-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--zn-success)] hover:opacity-80 transition-opacity"
                    >
                      <IconCheck size={11} /> Resolve
                    </button>
                    <button
                      onClick={() => snoozeMutation.mutate({ itemId: item.id, days: 7 })}
                      className="flex items-center gap-1 rounded-md border border-zn-border bg-white px-2.5 py-1 text-[11px] font-medium text-zn-text-2 hover:bg-zn-surface-2 transition-colors"
                    >
                      <IconBellOff size={11} /> Snooze 7d
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Sidebar — upcoming filings */}
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Upcoming SEC filings</span>
            </div>
            {filings.length === 0 ? (
              <div className="px-5 py-6 text-center text-[12px] text-zn-text-3">No upcoming filings</div>
            ) : (
              filings.slice(0, 5).map(event => (
                <div key={event.id} className="flex items-center gap-3 border-b border-zn-border px-4 py-3.5 last:border-0">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg text-center"
                    style={{ background: 'var(--zn-gold-bg)' }}
                  >
                    <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--zn-gold-dark)' }}>
                      {new Date(event.dueAt).toLocaleString('en-US', { month: 'short' })}
                    </div>
                    <div className="text-[14px] font-semibold leading-none" style={{ color: 'var(--zn-gold-dark)' }}>
                      {new Date(event.dueAt).getDate()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-zn-text-1 truncate">{event.title}</div>
                    <div className="text-[11px] text-zn-text-3">
                      {new Date(event.dueAt).getFullYear()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick stats */}
          <div className="card">
            <div className="card-header"><span className="card-title">By type</span></div>
            {Object.entries(stats?.byType ?? {}).map(([type, count]) => (
              count > 0 ? (
                <div key={type} className="flex items-center justify-between border-b border-zn-border px-4 py-2.5 last:border-0">
                  <span className="text-[12px] text-zn-text-2">
                    {TYPE_LABELS[type] ?? type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[12px] font-semibold text-zn-text-1">{count}</span>
                </div>
              ) : null
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
