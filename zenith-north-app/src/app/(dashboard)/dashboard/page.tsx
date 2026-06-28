'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, daysUntil } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  IconChevronRight, IconAlertTriangle, IconCheck,
  IconSignature, IconUserPlus, IconClock, IconArrowUpRight,
  IconShield, IconUsers, IconGitBranch, IconChartBar,
  IconMessage, IconListCheck, IconFileText,
} from '@tabler/icons-react'

// ── Shared components ─────────────────────────────────────

function StatCard({ label, value, delta, accent, href }: {
  label: string; value: string | number; delta?: string
  accent?: string; href?: string
}) {
  const card = (
    <div className="stat-card group relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg"
        style={{ background: accent ?? 'var(--zn-gold)' }} />
      <div className="stat-label">{label}</div>
      <div className="stat-num" style={{ color: accent ?? 'var(--zn-gold-dark)' }}>{value}</div>
      {delta && <div className="stat-delta">{delta}</div>}
    </div>
  )
  return href ? <Link href={href}>{card}</Link> : card
}

function SectionCard({ title, action, actionHref, children }: {
  title: string; action?: string; actionHref?: string; children: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        {action && actionHref && (
          <Link href={actionHref} className="card-action flex items-center gap-1">
            {action} <IconArrowUpRight size={11} />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function ComplianceItem({ severity, title, meta }: {
  severity: 'critical' | 'warning'; title: string; meta: string
}) {
  return (
    <Link href="/compliance"
      className="flex items-start gap-3 border-b border-zn-border px-5 py-3.5 last:border-0 hover:bg-zn-surface-2 transition-colors group">
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
        style={{ background: severity === 'critical' ? 'var(--zn-danger)' : 'var(--zn-warning)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-zn-text-1 truncate">{title}</div>
        <div className="mt-0.5 text-[11px] text-zn-text-3">{meta}</div>
      </div>
      <span className={severity === 'critical' ? 'pill-danger pill' : 'pill-warn pill'}>
        {severity === 'critical' ? 'Critical' : 'Warning'}
      </span>
    </Link>
  )
}

function WorkflowRow({ name, step, pct, stalled }: {
  name: string; step: string; pct: number; stalled?: boolean
}) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-zn-text-1">{name}</div>
        <div className="mt-0.5 text-[11px] text-zn-text-3">{step}</div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-zn-surface-3">
          <div className="h-full rounded-full"
            style={{ width: `${pct}%`, background: stalled ? 'var(--zn-warning)' : 'var(--zn-gold)' }} />
        </div>
      </div>
      <span className="text-[11px] font-mono text-zn-text-3 flex-shrink-0">{pct}%</span>
    </div>
  )
}

function ActivityRow({ icon: Icon, color, text, time }: {
  icon: any; color: string; text: React.ReactNode; time: string
}) {
  return (
    <div className="flex items-start gap-3 border-b border-zn-border px-5 py-3.5 last:border-0">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg mt-0.5"
        style={{ background: color + '18', color }}>
        <Icon size={13} />
      </div>
      <div className="flex-1">
        <div className="text-[13px] text-zn-text-2 leading-snug">{text}</div>
        <div className="mt-1 text-[11px] text-zn-text-3">{time}</div>
      </div>
    </div>
  )
}

// ── Role dashboards ───────────────────────────────────────

function OwnerDashboard({ data, isLoading }: { data: any; isLoading: boolean }) {
  const stats  = data?.stats
  const items  = data?.items ?? []
  const filings = data?.filings ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active clients"      value={isLoading ? '—' : (data?.activeClients ?? '—')} delta="+2 this quarter"          accent="var(--zn-gold-dark)"   href="/clients" />
        <StatCard label="Compliance items"    value={isLoading ? '—' : (stats?.critical ?? 0) + (stats?.warning ?? 0)} delta={`${stats?.critical ?? 0} critical`} accent="var(--zn-danger)" href="/compliance" />
        <StatCard label="Active onboardings"  value={isLoading ? '—' : 2}  delta="1 awaiting approval"         accent="var(--zn-warning)"     href="/workflows" />
        <StatCard label="Reviews due (60d)"   value={isLoading ? '—' : 3}  delta="2 overdue now"                accent="var(--zn-success)"     href="/compliance" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Compliance queue" action="View all" actionHref="/compliance">
          {(items.slice(0, 4) as any[]).map((item: any) => (
            <ComplianceItem key={item.id} severity={item.severity} title={item.title}
              meta={item.dueAt ? `Due ${formatDate(item.dueAt)}` : item.description ?? ''} />
          ))}
          {items.length === 0 && !isLoading && (
            <div className="flex items-center gap-3 px-5 py-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--zn-success-bg)' }}>
                <IconCheck size={16} style={{ color: 'var(--zn-success)' }} />
              </div>
              <div className="text-[13px] font-medium text-zn-text-1">All clear — firm is compliant</div>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Active onboardings" action="View all" actionHref="/workflows">
          <WorkflowRow name="Sandra Chukwu" step="Step 6 of 7 · Awaiting CCO approval" pct={85} />
          <WorkflowRow name="Marcus Oyelaran" step="Step 3 of 7 · Stalled 16 days" pct={28} stalled />
        </SectionCard>
      </div>
    </div>
  )
}

function CCODashboard({ data, isLoading }: { data: any; isLoading: boolean }) {
  const stats = data?.stats
  const items = data?.items ?? []
  const filings = data?.filings ?? []
  const critical = items.filter((i: any) => i.severity === 'critical')
  const warning  = items.filter((i: any) => i.severity === 'warning')

  // Exam readiness score
  const examScore = Math.max(0, 100 - (critical.length * 20) - (warning.length * 5))

  return (
    <div className="space-y-4">
      {/* Exam readiness banner */}
      <div
        className="rounded-xl border p-5 flex items-center gap-5"
        style={{
          background: examScore >= 80 ? 'var(--zn-success-bg)' : examScore >= 50 ? 'rgba(217,119,6,0.06)' : 'rgba(220,38,38,0.06)',
          borderColor: examScore >= 80 ? 'var(--zn-success-border)' : examScore >= 50 ? 'var(--zn-warning-border)' : 'var(--zn-danger-border)',
        }}
      >
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
          style={{
            background: '#fff',
            color: examScore >= 80 ? 'var(--zn-success)' : examScore >= 50 ? 'var(--zn-warning)' : 'var(--zn-danger)',
          }}
        >
          {examScore}
        </div>
        <div>
          <div className="text-[14px] font-semibold text-zn-text-1">
            Exam readiness score
          </div>
          <div className="text-[12px] text-zn-text-3 mt-0.5">
            {examScore >= 80
              ? 'Firm is well-positioned for an SEC examination.'
              : examScore >= 50
              ? 'Some items need attention before an examination.'
              : 'Critical gaps — address immediately before any exam.'}
          </div>
        </div>
        <Link href="/audit" className="ml-auto btn-ghost btn-sm flex items-center gap-1.5">
          View audit center <IconArrowUpRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Critical items" value={isLoading ? '—' : critical.length} accent="var(--zn-danger)"  href="/compliance" />
        <StatCard label="Warning items"  value={isLoading ? '—' : warning.length}  accent="var(--zn-warning)" href="/compliance" />
        <StatCard label="Upcoming filings" value={isLoading ? '—' : filings.length} accent="var(--zn-gold-dark)" href="/calendar" />
        <StatCard label="AI flags (unreviewed)" value={isLoading ? '—' : 1} accent="#3B82F6" href="/messages" />
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4">
        <SectionCard title="Open compliance items" action="Manage all" actionHref="/compliance">
          {items.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-5">
              <IconShield size={20} style={{ color: 'var(--zn-success)' }} />
              <div className="text-[13px] text-zn-text-1">No open compliance items</div>
            </div>
          ) : (
            (items.slice(0, 6) as any[]).map((item: any) => (
              <ComplianceItem key={item.id} severity={item.severity} title={item.title}
                meta={item.dueAt ? `Due ${formatDate(item.dueAt)}` : item.description ?? ''} />
            ))
          )}
        </SectionCard>

        <div className="space-y-3">
          <SectionCard title="Upcoming SEC filings">
            {filings.slice(0, 4).map((event: any) => (
              <div key={event.id} className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0">
                <div className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg text-center"
                  style={{ background: 'var(--zn-gold-bg)' }}>
                  <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--zn-gold-dark)' }}>
                    {new Date(event.dueAt).toLocaleString('en-US', { month: 'short' })}
                  </div>
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--zn-gold-dark)' }}>
                    {new Date(event.dueAt).getDate()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-zn-text-1 truncate">{event.title}</div>
                  <div className="text-[11px] text-zn-text-3">{new Date(event.dueAt).getFullYear()}</div>
                </div>
              </div>
            ))}
            {filings.length === 0 && (
              <div className="px-4 py-4 text-[12px] text-zn-text-3">No upcoming filings</div>
            )}
          </SectionCard>

          <SectionCard title="Recent audit activity">
            <ActivityRow icon={IconAlertTriangle} color="var(--zn-warning)"
              text={<>AI flagged message to <strong className="text-zn-text-1">David Kim</strong></>}
              time="2 days ago" />
            <ActivityRow icon={IconShield} color="var(--zn-success)"
              text="Compliance engine ran — 5 items generated"
              time="Yesterday" />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function AdvisorDashboard({ data, isLoading, userName }: { data: any; isLoading: boolean; userName: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="My clients"          value={isLoading ? '—' : (data?.activeClients ?? '—')} accent="var(--zn-gold-dark)" href="/clients" />
        <StatCard label="My active onboardings" value={isLoading ? '—' : 2}  delta="1 awaiting your approval" accent="var(--zn-warning)" href="/workflows" />
        <StatCard label="Annual reviews due"   value={isLoading ? '—' : 3}   delta="2 overdue" accent="var(--zn-danger)"  href="/compliance" />
        <StatCard label="Unread messages"      value={isLoading ? '—' : 1}   accent="#3B82F6"  href="/messages" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="My onboardings" action="View all" actionHref="/workflows">
          <WorkflowRow name="Sandra Chukwu" step="Step 6 of 7 · Awaiting your approval" pct={85} />
          <WorkflowRow name="Marcus Oyelaran" step="Step 3 of 7 · Client hasn't responded" pct={28} stalled />
        </SectionCard>

        <SectionCard title="Upcoming client reviews" action="View calendar" actionHref="/calendar">
          {[
            { name: 'Margaret Chen',   daysAway: -160, overdue: true },
            { name: 'Robert Walsh',    daysAway: -99,  overdue: true },
            { name: 'Brian Tran',      daysAway: 14,   overdue: false },
          ].map(r => (
            <div key={r.name} className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
                {r.name.split(' ').map(n => n[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-medium text-zn-text-1">{r.name}</div>
                <div className="text-[11px] flex items-center gap-1 mt-0.5"
                  style={{ color: r.overdue ? 'var(--zn-danger)' : 'var(--zn-text-3)' }}>
                  <IconClock size={11} />
                  {r.overdue ? `${Math.abs(r.daysAway)} days overdue` : `Due in ${r.daysAway} days`}
                </div>
              </div>
              {r.overdue && <span className="pill-danger pill">Overdue</span>}
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  )
}

function OperationsDashboard({ data, isLoading }: { data: any; isLoading: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Open tasks"           value={isLoading ? '—' : 7}  delta="3 due today"          accent="var(--zn-gold-dark)" href="/tasks" />
        <StatCard label="Active onboardings"   value={isLoading ? '—' : 2}  delta="1 needs your action"  accent="var(--zn-warning)"   href="/workflows" />
        <StatCard label="Missing documents"    value={isLoading ? '—' : 3}  delta="Need follow-up"       accent="var(--zn-danger)"    href="/documents" />
        <StatCard label="Upcoming deadlines"   value={isLoading ? '—' : 5}  delta="Next 30 days"         accent="#3B82F6"             href="/calendar" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Workflow pipeline" action="View all" actionHref="/workflows">
          <WorkflowRow name="Sandra Chukwu"   step="Step 6 of 7 · Awaiting CCO approval" pct={85} />
          <WorkflowRow name="Marcus Oyelaran" step="Step 3 of 7 · Client portal pending"  pct={28} stalled />
        </SectionCard>

        <SectionCard title="Open tasks" action="View all" actionHref="/tasks">
          {[
            { title: 'Follow up: onboarding stalled — Marcus Oyelaran', type: 'Workflow', overdue: true },
            { title: 'KYC document needed — Sandra Chukwu',             type: 'Document', overdue: false },
            { title: 'Schedule annual review — Margaret Chen',           type: 'Review',   overdue: true },
          ].map((task, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0">
              <div className="flex h-1.5 w-1.5 flex-shrink-0 rounded-full mt-1.5"
                style={{ background: task.overdue ? 'var(--zn-danger)' : 'var(--zn-warning)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-zn-text-1 truncate">{task.title}</div>
              </div>
              <span className="pill-ghost pill">{task.type}</span>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  )
}

function AssociateDashboard({ data, isLoading }: { data: any; isLoading: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Assigned clients"     value={isLoading ? '—' : 4}  accent="var(--zn-gold-dark)" href="/clients" />
        <StatCard label="Pending review items" value={isLoading ? '—' : 2}  accent="var(--zn-warning)"   href="/tasks" />
        <StatCard label="My open tasks"        value={isLoading ? '—' : 5}  accent="#3B82F6"             href="/tasks" />
      </div>

      <SectionCard title="My assigned clients" action="View all" actionHref="/clients">
        {[
          { name: 'Sandra Chukwu',   status: 'Onboarding',  type: 'Individual' },
          { name: 'Brian Tran',      status: 'Active',       type: 'Individual' },
          { name: 'David Kim',       status: 'Active',       type: 'Individual' },
          { name: 'Margaret Chen',   status: 'Review due',   type: 'Individual' },
        ].map(c => (
          <div key={c.name} className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0 hover:bg-zn-surface-2 cursor-pointer transition-colors">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
              {c.name.split(' ').map(n => n[0]).join('').slice(0,2)}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-zn-text-1">{c.name}</div>
              <div className="text-[11px] text-zn-text-3">{c.type}</div>
            </div>
            <span className={cn('pill',
              c.status === 'Active' ? 'pill-success' :
              c.status === 'Review due' ? 'pill-warn' :
              'pill-gold'
            )}>{c.status}</span>
          </div>
        ))}
      </SectionCard>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: complianceData, isLoading } = trpc.compliance.dashboard.useQuery()
  const { data: me } = trpc.me.getMe.useQuery()

  const role = (me?.role ?? 'owner') as 'owner' | 'cco' | 'advisor' | 'operations' | 'associate'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const roleLabel = {
    owner:      'Owner · Full access',
    cco:        'Chief Compliance Officer',
    advisor:    'Advisor',
    operations: 'Operations',
    associate:  'Associate Advisor',
  }[role] ?? 'Team member'

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
      </div>

      {/* Role-specific dashboard */}
      {role === 'owner'      && <OwnerDashboard      data={complianceData} isLoading={isLoading} />}
      {role === 'cco'        && <CCODashboard        data={complianceData} isLoading={isLoading} />}
      {role === 'advisor'    && <AdvisorDashboard    data={complianceData} isLoading={isLoading} userName="James Wright" />}
      {role === 'operations' && <OperationsDashboard data={complianceData} isLoading={isLoading} />}
      {role === 'associate'  && <AssociateDashboard  data={complianceData} isLoading={isLoading} />}

      {/* If owner — also show owner default */}
      {!['owner','cco','advisor','operations','associate'].includes(role) && (
        <OwnerDashboard data={complianceData} isLoading={isLoading} />
      )}
    </div>
  )
}
