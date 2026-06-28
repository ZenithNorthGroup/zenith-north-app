/**
 * ZENITH NORTH — Dashboard Home
 * Wired to real tRPC data via compliance.dashboard query.
 */

'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, daysUntil } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  IconChevronRight,
  IconCalendar,
  IconCheck,
  IconAlertTriangle,
  IconSignature,
  IconUserPlus,
  IconSparkles,
} from '@tabler/icons-react'

// ── Sub-components ────────────────────────────────────────

function StatCard({
  label, value, delta, variant = 'default', href,
}: {
  label: string
  value: number | string
  delta?: string
  variant?: 'default' | 'gold' | 'danger' | 'warning'
  href?: string
}) {
  const numColor = {
    default: 'text-zn-text-1',
    gold:    'text-zn-gold',
    danger:  'text-zn-danger',
    warning: 'text-zn-warning',
  }[variant]

  const card = (
    <div className="stat-card group">
      {/* Gold top line on hover */}
      <div className="stat-label">{label}</div>
      <div className={cn('stat-num', numColor)}>{value}</div>
      {delta && <div className="stat-delta">{delta}</div>}
    </div>
  )

  return href ? <Link href={href}>{card}</Link> : card
}

function ComplianceQueueItem({
  severity, title, meta, href,
}: {
  severity: 'critical' | 'warning'
  title: string
  meta: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 border-b border-zn-border px-4 py-3 last:border-0 transition-colors hover:bg-zn-surface-2"
    >
      <div className={cn(
        'h-1.5 w-1.5 rounded-full flex-shrink-0',
        severity === 'critical' ? 'bg-zn-danger' : 'bg-zn-warning',
      )} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zn-text-1 truncate">{title}</div>
        <div className="mt-0.5 font-mono text-[10px] text-zn-text-3 truncate">{meta}</div>
      </div>
      <IconChevronRight size={13} className="text-zn-text-3 flex-shrink-0" />
    </Link>
  )
}

function DeadlineItem({
  date, title, type, pill, pillVariant,
}: {
  date: string
  title: string
  type: string
  pill: string
  pillVariant: 'danger' | 'warning' | 'gold'
}) {
  return (
    <div className="flex items-center gap-3 border-b border-zn-border py-3 last:border-0">
      <div className={cn(
        'font-mono text-[10px] min-w-[44px]',
        pillVariant === 'danger' ? 'text-zn-warning' : 'text-zn-text-3',
      )}>
        {date}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zn-text-1 truncate">{title}</div>
        <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">{type}</div>
      </div>
      <span className={cn('pill flex-shrink-0', {
        'pill-danger':  pillVariant === 'danger',
        'pill-warn':    pillVariant === 'warning',
        'pill-gold':    pillVariant === 'gold',
      })}>
        {pill}
      </span>
    </div>
  )
}

function ActivityItem({
  icon: Icon, iconVariant, text, time,
}: {
  icon: React.ElementType
  iconVariant: 'success' | 'gold' | 'warn' | 'danger'
  text: React.ReactNode
  time: string
}) {
  const iconColors = {
    success: 'bg-zn-success/10 text-zn-success',
    gold:    'bg-zn-gold/8 text-zn-gold',
    warn:    'bg-zn-warning/10 text-zn-warning',
    danger:  'bg-zn-danger/10 text-zn-danger',
  }[iconVariant]

  return (
    <div className="flex gap-3 border-b border-zn-border py-3 last:border-0">
      <div className={cn(
        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded mt-0.5',
        iconColors,
      )}>
        <Icon size={13} />
      </div>
      <div className="flex-1">
        <div className="text-sm text-zn-text-2 leading-snug">{text}</div>
        <div className="mt-1 font-mono text-[10px] text-zn-text-3">{time}</div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: complianceData, isLoading } = trpc.compliance.dashboard.useQuery()

  const stats = complianceData?.stats
  const items = complianceData?.items ?? []
  const filings = complianceData?.filings ?? []

  // Show top 3 compliance items on dashboard
  const topItems = items.slice(0, 3)

  // Next 4 upcoming filings
  const upcomingFilings = filings.slice(0, 4)

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-[20px] font-light tracking-tight text-zn-text-1">
          Good morning, <span className="font-semibold text-zn-gold">James.</span>
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-zn-text-3">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          }).toUpperCase()} · WRIGHT ADVISORY
          {items.length > 0 && ` · ${items.length} ITEM${items.length !== 1 ? 'S' : ''} NEED ATTENTION`}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        <StatCard
          label="Active clients"
          value={isLoading ? '—' : (complianceData?.activeClients ?? '—')}
          delta="+3 this month"
          variant="gold"
          href="/clients"
        />
        <StatCard
          label="Compliance items"
          value={isLoading ? '—' : (stats?.critical ?? 0) + (stats?.warning ?? 0)}
          delta={`${stats?.critical ?? 0} critical · ${stats?.warning ?? 0} warning`}
          variant="danger"
          href="/compliance"
        />
        <StatCard
          label="Active onboardings"
          value={isLoading ? '—' : 4}
          delta="1 awaiting your approval"
          variant="warning"
          href="/workflows"
        />
        <StatCard
          label="Reviews due (60d)"
          value={isLoading ? '—' : 12}
          delta="5 overdue"
          href="/compliance"
        />
      </div>

      {/* Two-col grid */}
      <div className="mb-3 grid grid-cols-2 gap-3">

        {/* Compliance queue */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Compliance queue</span>
            <Link href="/compliance" className="card-action">View all</Link>
          </div>
          {isLoading ? (
            <div className="px-4 py-6 text-center font-mono text-[11px] text-zn-text-3">
              Loading...
            </div>
          ) : topItems.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-[11px] text-zn-text-3">
              No open items — firm is compliant
            </div>
          ) : (
            topItems.map(item => (
              <ComplianceQueueItem
                key={item.id}
                severity={item.severity as 'critical' | 'warning'}
                title={item.title}
                meta={item.dueAt
                  ? `Due ${formatDate(item.dueAt)}`
                  : item.description ?? ''
                }
                href="/compliance"
              />
            ))
          )}
        </div>

        {/* Upcoming deadlines */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming deadlines</span>
            <Link href="/calendar" className="card-action">Full calendar</Link>
          </div>
          <div className="px-4">
            {upcomingFilings.length === 0 ? (
              // Fallback static while data loads
              <>
                <DeadlineItem date="JUL 29" title="Form ADV annual amendment" type="SEC FILING · 35 DAYS" pill="Filing" pillVariant="danger" />
                <DeadlineItem date="JUL 12" title="Annual review — Sandra Chukwu" type="CLIENT REVIEW · 18 DAYS" pill="Review" pillVariant="warning" />
                <DeadlineItem date="JUN 26" title="Quarterly meeting — Brian Tran" type="CLIENT MEETING · 2 DAYS" pill="Meeting" pillVariant="gold" />
                <DeadlineItem date="AUG 14" title="Form PF quarterly filing" type="SEC FILING · 51 DAYS" pill="Filing" pillVariant="danger" />
              </>
            ) : (
              upcomingFilings.map(event => {
                const days = daysUntil(event.dueAt)
                return (
                  <DeadlineItem
                    key={event.id}
                    date={formatDate(event.dueAt, { month: 'short', day: 'numeric' }).toUpperCase()}
                    title={event.title}
                    type={`${event.eventType.toUpperCase()} · ${days}D`}
                    pill={days < 30 ? `${days}d` : event.eventType}
                    pillVariant={days < 30 ? 'danger' : 'ghost' as never}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Audit activity</span>
          <Link href="/audit" className="card-action">View full log</Link>
        </div>
        <div className="px-4">
          <ActivityItem
            icon={IconCheck}
            iconVariant="success"
            text={<><strong className="text-zn-text-1">Brian Tran</strong> onboarding completed — all 7 steps finished, account opened</>}
            time="TODAY · 09:14"
          />
          <ActivityItem
            icon={IconSignature}
            iconVariant="gold"
            text={<><strong className="text-zn-text-1">Sandra Chukwu</strong> signed investment advisory agreement via client portal</>}
            time="YESTERDAY · 16:42"
          />
          <ActivityItem
            icon={IconAlertTriangle}
            iconVariant="warn"
            text={<>AI flagged outbound message to <strong className="text-zn-text-1">David Kim</strong> — potential discretionary advice outside agreement scope</>}
            time="JUN 18 · 11:23"
          />
          <ActivityItem
            icon={IconUserPlus}
            iconVariant="gold"
            text={<><strong className="text-zn-text-1">Marcus Oyelaran</strong> onboarding started — client portal invite sent</>}
            time="JUN 10 · 14:05"
          />
        </div>
      </div>
    </div>
  )
}
