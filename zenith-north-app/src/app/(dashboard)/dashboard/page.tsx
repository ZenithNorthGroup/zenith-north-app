'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  IconAlertTriangle, IconCheck, IconClock,
  IconArrowUpRight, IconShield, IconLoader2,
} from '@tabler/icons-react'

// ── Shared ─────────────────────────────────────────────────

function StatCard({ label, value, delta, accent, href }: {
  label: string; value: string | number; delta?: string
  accent?: string; href?: string
}) {
  const card = (
    <div className="stat-card group relative overflow-hidden cursor-pointer">
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

function LoadingCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="h-3 w-32 rounded bg-zn-surface-3 animate-pulse" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-zn-border px-5 py-3.5 last:border-0">
          <div className="h-2 w-2 rounded-full bg-zn-surface-3 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-48 rounded bg-zn-surface-3 animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-zn-surface-3 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Owner dashboard ────────────────────────────────────────

function OwnerDashboard() {
  const { data: complianceData, isLoading: cLoading } = trpc.compliance.dashboard.useQuery()
  const { data: workflowData,   isLoading: wLoading } = trpc.workflows.listRuns.useQuery({ filter: 'active', limit: 3 })
  const { data: taskSummary }                          = trpc.tasks.summary.useQuery()

  const stats   = complianceData?.stats
  const items   = complianceData?.items ?? []
  const runs    = workflowData ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active clients"    value={cLoading ? '—' : (complianceData?.activeClients ?? 0)} accent="var(--zn-gold-dark)" href="/clients" />
        <StatCard label="Compliance items"  value={cLoading ? '—' : (stats?.critical ?? 0) + (stats?.warning ?? 0)}
          delta={`${stats?.critical ?? 0} critical · ${stats?.warning ?? 0} warning`}
          accent="var(--zn-danger)" href="/compliance" />
        <StatCard label="Active onboardings" value={wLoading ? '—' : (runs as any[]).length}
          delta={(runs as any[]).filter((r: any) => r.status === 'awaiting_approval').length + ' awaiting approval'}
          accent="var(--zn-warning)" href="/workflows" />
        <StatCard label="Open tasks" value={taskSummary?.open ?? '—'}
          delta={`${taskSummary?.overdue ?? 0} overdue`}
          accent="var(--zn-success)" href="/tasks" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cLoading ? <LoadingCard /> : (
          <SectionCard title="Compliance queue" action="View all" actionHref="/compliance">
            {items.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--zn-success-bg)' }}>
                  <IconCheck size={16} style={{ color: 'var(--zn-success)' }} />
                </div>
                <div className="text-[13px] font-medium text-zn-text-1">All clear — firm is compliant</div>
              </div>
            ) : (
              (items.slice(0, 4) as any[]).map((item: any) => (
                <Link key={item.id} href="/compliance"
                  className="flex items-start gap-3 border-b border-zn-border px-5 py-3.5 last:border-0 hover:bg-zn-surface-2 transition-colors">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: item.severity === 'critical' ? 'var(--zn-danger)' : 'var(--zn-warning)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zn-text-1 truncate">{item.title}</div>
                    <div className="mt-0.5 text-[11px] text-zn-text-3">
                      {item.dueAt ? `Due ${formatDate(item.dueAt)}` : item.description ?? ''}
                    </div>
                  </div>
                  <span className={item.severity === 'critical' ? 'pill-danger pill' : 'pill-warn pill'}>
                    {item.severity === 'critical' ? 'Critical' : 'Warning'}
                  </span>
                </Link>
              ))
            )}
          </SectionCard>
        )}

        {wLoading ? <LoadingCard rows={2} /> : (
          <SectionCard title="Active onboardings" action="View all" actionHref="/workflows">
            {(runs as any[]).length === 0 ? (
              <div className="px-5 py-5 text-[13px] text-zn-text-3">No active onboardings</div>
            ) : (
              (runs as any[]).slice(0, 3).map((run: any) => (
                <Link key={run.id} href={`/workflows`}
                  className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0 hover:bg-zn-surface-2 transition-colors">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
                    {(run.clientName ?? 'CL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zn-text-1">{run.clientName ?? 'Client'}</div>
                    <div className="mt-0.5 text-[11px] text-zn-text-3">
                      Step {run.completedCount + 1} of {run.totalSteps} · {run.status.replace(/_/g, ' ')}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-zn-surface-3">
                      <div className="h-full rounded-full"
                        style={{ width: `${run.progressPct}%`, background: run.status === 'awaiting_client' ? 'var(--zn-warning)' : 'var(--zn-gold)' }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zn-text-3 flex-shrink-0">{run.progressPct}%</span>
                </Link>
              ))
            )}
          </SectionCard>
        )}
      </div>
    </div>
  )
}

// ── CCO dashboard ──────────────────────────────────────────

function CCODashboard() {
  const { data: complianceData, isLoading } = trpc.compliance.dashboard.useQuery()
  const { data: flagged = [] } = trpc.messages.listFlagged?.useQuery?.() ?? { data: [] }

  const stats    = complianceData?.stats
  const items    = complianceData?.items ?? []
  const filings  = complianceData?.filings ?? []
  const critical = items.filter((i: any) => i.severity === 'critical')
  const warning  = items.filter((i: any) => i.severity === 'warning')
  const examScore = Math.max(0, 100 - (critical.length * 20) - (warning.length * 5))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-5 flex items-center gap-5"
        style={{
          background:   examScore >= 80 ? 'var(--zn-success-bg)' : examScore >= 50 ? 'rgba(217,119,6,0.06)' : 'rgba(220,38,38,0.06)',
          borderColor:  examScore >= 80 ? 'var(--zn-success-border)' : examScore >= 50 ? 'var(--zn-warning-border)' : 'var(--zn-danger-border)',
        }}>
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold bg-white"
          style={{ color: examScore >= 80 ? 'var(--zn-success)' : examScore >= 50 ? 'var(--zn-warning)' : 'var(--zn-danger)' }}>
          {isLoading ? <IconLoader2 size={20} className="animate-spin" /> : examScore}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-zn-text-1">Exam readiness score</div>
          <div className="text-[12px] text-zn-text-3 mt-0.5">
            {examScore >= 80 ? 'Firm is well-positioned for an SEC examination.'
              : examScore >= 50 ? 'Some items need attention before an examination.'
              : 'Critical gaps — address immediately before any exam.'}
          </div>
        </div>
        <Link href="/audit" className="btn-ghost btn-sm flex items-center gap-1.5">
          Audit center <IconArrowUpRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Critical items"       value={isLoading ? '—' : critical.length}  accent="var(--zn-danger)"    href="/compliance" />
        <StatCard label="Warning items"        value={isLoading ? '—' : warning.length}   accent="var(--zn-warning)"   href="/compliance" />
        <StatCard label="Upcoming filings"     value={isLoading ? '—' : filings.length}   accent="var(--zn-gold-dark)" href="/calendar" />
        <StatCard label="AI flags unreviewed"  value={isLoading ? '—' : (flagged as any[]).length} accent="#3B82F6" href="/messages" />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {isLoading ? <LoadingCard rows={5} /> : (
          <SectionCard title="Open compliance items" action="Manage all" actionHref="/compliance">
            {items.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5">
                <IconShield size={20} style={{ color: 'var(--zn-success)' }} />
                <div className="text-[13px] text-zn-text-1">No open compliance items</div>
              </div>
            ) : (
              (items as any[]).map((item: any) => (
                <Link key={item.id} href="/compliance"
                  className="flex items-start gap-3 border-b border-zn-border px-5 py-3.5 last:border-0 hover:bg-zn-surface-2 transition-colors">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: item.severity === 'critical' ? 'var(--zn-danger)' : 'var(--zn-warning)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zn-text-1 truncate">{item.title}</div>
                    <div className="text-[11px] text-zn-text-3 mt-0.5">
                      {item.dueAt ? `Due ${formatDate(item.dueAt)}` : item.description ?? ''}
                    </div>
                  </div>
                  <span className={item.severity === 'critical' ? 'pill-danger pill' : 'pill-warn pill'}>
                    {item.severity === 'critical' ? 'Critical' : 'Warning'}
                  </span>
                </Link>
              ))
            )}
          </SectionCard>
        )}

        <div className="space-y-3">
          <SectionCard title="Upcoming SEC filings">
            {filings.slice(0, 4).map((event: any) => (
              <div key={event.id} className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0">
                <div className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg"
                  style={{ background: 'var(--zn-gold-bg)' }}>
                  <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--zn-gold-dark)' }}>
                    {new Date(event.dueAt).toLocaleString('en-US', { month: 'short' })}
                  </div>
                  <div className="text-[14px] font-semibold leading-none" style={{ color: 'var(--zn-gold-dark)' }}>
                    {new Date(event.dueAt).getDate()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-zn-text-1 truncate">{event.title}</div>
                  <div className="text-[11px] text-zn-text-3">{new Date(event.dueAt).getFullYear()}</div>
                </div>
              </div>
            ))}
            {filings.length === 0 && <div className="px-4 py-4 text-[12px] text-zn-text-3">No upcoming filings</div>}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

// ── Advisor dashboard ──────────────────────────────────────

function AdvisorDashboard() {
  const { data: clients = [], isLoading: cLoading }  = trpc.clients.list.useQuery({ limit: 50 })
  const { data: runs = [],    isLoading: wLoading }  = trpc.workflows.listRuns.useQuery({ filter: 'active', limit: 4 })
  const { data: tasks,        isLoading: tLoading }  = trpc.tasks.summary.useQuery()

  const activeClients = (clients as any[]).filter((c: any) => c.data?.status === 'active')
  const overdueReviews = (clients as any[]).filter((c: any) => {
    if (!c.data?.annualReviewDue) return false
    return new Date(c.data.annualReviewDue) < new Date()
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="My clients"           value={cLoading ? '—' : activeClients.length}    accent="var(--zn-gold-dark)" href="/clients" />
        <StatCard label="My onboardings"       value={wLoading ? '—' : (runs as any[]).length}  accent="var(--zn-warning)"   href="/workflows" />
        <StatCard label="Reviews overdue"      value={cLoading ? '—' : overdueReviews.length}   accent="var(--zn-danger)"    href="/compliance" />
        <StatCard label="Open tasks"           value={tLoading ? '—' : (tasks?.open ?? 0)}      accent="#3B82F6"             href="/tasks" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {wLoading ? <LoadingCard rows={2} /> : (
          <SectionCard title="My onboardings" action="View all" actionHref="/workflows">
            {(runs as any[]).length === 0 ? (
              <div className="px-5 py-5 text-[13px] text-zn-text-3">No active onboardings</div>
            ) : (
              (runs as any[]).map((run: any) => (
                <Link key={run.id} href="/workflows"
                  className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0 hover:bg-zn-surface-2 transition-colors">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
                    {(run.clientName ?? 'CL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zn-text-1">{run.clientName ?? 'Client'}</div>
                    <div className="text-[11px] text-zn-text-3">Step {run.completedCount + 1} of {run.totalSteps}</div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-zn-surface-3">
                      <div className="h-full rounded-full"
                        style={{ width: `${run.progressPct}%`, background: 'var(--zn-gold)' }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zn-text-3">{run.progressPct}%</span>
                </Link>
              ))
            )}
          </SectionCard>
        )}

        {cLoading ? <LoadingCard rows={3} /> : (
          <SectionCard title="Annual reviews due" action="View calendar" actionHref="/calendar">
            {overdueReviews.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5">
                <IconCheck size={16} style={{ color: 'var(--zn-success)' }} />
                <div className="text-[13px] text-zn-text-1">All reviews are current</div>
              </div>
            ) : (
              overdueReviews.slice(0, 5).map((client: any) => {
                const days = Math.abs(Math.ceil((new Date(client.data.annualReviewDue).getTime() - Date.now()) / 86400000))
                return (
                  <Link key={client.id} href={`/clients/${client.id}`}
                    className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0 hover:bg-zn-surface-2 transition-colors">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
                      {`${(client.data.firstName ?? '')[0] ?? ''}${(client.data.lastName ?? '')[0] ?? ''}`}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-zn-text-1">
                        {client.data.firstName} {client.data.lastName}
                      </div>
                      <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--zn-danger)' }}>
                        <IconClock size={11} />{days} days overdue
                      </div>
                    </div>
                    <span className="pill-danger pill">Overdue</span>
                  </Link>
                )
              })
            )}
          </SectionCard>
        )}
      </div>
    </div>
  )
}

// ── Operations dashboard ───────────────────────────────────

function OperationsDashboard() {
  const { data: tasks,    isLoading: tLoading } = trpc.tasks.summary.useQuery()
  const { data: runs = [], isLoading: wLoading } = trpc.workflows.listRuns.useQuery({ filter: 'active', limit: 5 })
  const { data: docs,      isLoading: dLoading } = trpc.documents.summary.useQuery()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Open tasks"          value={tLoading ? '—' : (tasks?.open ?? 0)}     delta={`${tasks?.overdue ?? 0} overdue`} accent="var(--zn-gold-dark)" href="/tasks" />
        <StatCard label="Active onboardings"  value={wLoading ? '—' : (runs as any[]).length} accent="var(--zn-warning)"  href="/workflows" />
        <StatCard label="Documents total"     value={dLoading ? '—' : (docs?.total ?? 0)}     accent="var(--zn-success)"  href="/documents" />
        <StatCard label="Pending signatures"  value={dLoading ? '—' : (docs?.unsigned ?? 0)}  accent="var(--zn-danger)"   href="/documents" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {wLoading ? <LoadingCard rows={3} /> : (
          <SectionCard title="Workflow pipeline" action="View all" actionHref="/workflows">
            {(runs as any[]).length === 0 ? (
              <div className="px-5 py-5 text-[13px] text-zn-text-3">No active workflows</div>
            ) : (
              (runs as any[]).map((run: any) => (
                <Link key={run.id} href="/workflows"
                  className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0 hover:bg-zn-surface-2 transition-colors">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
                    {(run.clientName ?? 'CL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zn-text-1">{run.clientName ?? 'Client'}</div>
                    <div className="text-[11px] text-zn-text-3">{run.status.replace(/_/g, ' ')}</div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-zn-surface-3">
                      <div className="h-full rounded-full"
                        style={{ width: `${run.progressPct}%`, background: run.status === 'awaiting_client' ? 'var(--zn-warning)' : 'var(--zn-gold)' }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zn-text-3">{run.progressPct}%</span>
                </Link>
              ))
            )}
          </SectionCard>
        )}

        {tLoading ? <LoadingCard rows={3} /> : (
          <SectionCard title="Task summary" action="View all" actionHref="/tasks">
            {[
              { label: 'Open tasks',   value: tasks?.open    ?? 0, accent: 'var(--zn-gold-dark)' },
              { label: 'Overdue',      value: tasks?.overdue ?? 0, accent: 'var(--zn-danger)' },
              { label: 'Due today',    value: tasks?.today   ?? 0, accent: 'var(--zn-warning)' },
              { label: 'Completed',    value: tasks?.done    ?? 0, accent: 'var(--zn-success)' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between border-b border-zn-border px-5 py-3.5 last:border-0">
                <span className="text-[13px] text-zn-text-1">{item.label}</span>
                <span className="text-[18px] font-semibold" style={{ color: item.accent }}>{item.value}</span>
              </div>
            ))}
          </SectionCard>
        )}
      </div>
    </div>
  )
}

// ── Associate dashboard ────────────────────────────────────

function AssociateDashboard() {
  const { data: clients = [], isLoading: cLoading } = trpc.clients.list.useQuery({ limit: 20 })
  const { data: tasks,        isLoading: tLoading } = trpc.tasks.summary.useQuery()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="My clients"       value={cLoading ? '—' : (clients as any[]).length} accent="var(--zn-gold-dark)" href="/clients" />
        <StatCard label="Pending tasks"    value={tLoading ? '—' : (tasks?.open ?? 0)}        accent="var(--zn-warning)"   href="/tasks" />
        <StatCard label="Tasks overdue"    value={tLoading ? '—' : (tasks?.overdue ?? 0)}     accent="var(--zn-danger)"    href="/tasks" />
      </div>

      {cLoading ? <LoadingCard rows={4} /> : (
        <SectionCard title="My assigned clients" action="View all" actionHref="/clients">
          {(clients as any[]).length === 0 ? (
            <div className="px-5 py-5 text-[13px] text-zn-text-3">No clients assigned yet</div>
          ) : (
            (clients as any[]).slice(0, 6).map((client: any) => (
              <Link key={client.id} href={`/clients/${client.id}`}
                className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0 hover:bg-zn-surface-2 transition-colors">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
                  {`${(client.data?.firstName ?? '')[0] ?? ''}${(client.data?.lastName ?? '')[0] ?? ''}`}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-zn-text-1">
                    {client.data?.firstName} {client.data?.lastName}
                  </div>
                  <div className="text-[11px] text-zn-text-3 capitalize">{client.data?.clientType ?? 'individual'}</div>
                </div>
                <span className={cn('pill',
                  client.data?.status === 'active'   ? 'pill-success' :
                  client.data?.status === 'prospect'  ? 'pill-gold'    : 'pill-ghost'
                )}>
                  {client.data?.status ?? 'unknown'}
                </span>
              </Link>
            ))
          )}
        </SectionCard>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: me } = trpc.me.getMe.useQuery()

  const role     = (me?.role ?? 'owner') as string
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = me?.fullName?.split(' ')[0] ?? ''

  const roleLabel = {
    owner:      'Owner · Full access',
    cco:        'Chief Compliance Officer',
    advisor:    'Advisor',
    operations: 'Operations',
    associate:  'Associate Advisor',
  }[role] ?? 'Team member'

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-[22px] font-light tracking-tight text-zn-text-1">
          {greeting}{firstName ? ', ' : ''}{' '}
          {firstName && (
            <span className="font-semibold" style={{ color: 'var(--zn-gold-dark)' }}>{firstName}.</span>
          )}
        </h1>
        <p className="mt-1 text-[12px] text-zn-text-3">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
            {roleLabel}
          </span>
        </p>
      </div>

      {role === 'owner'      && <OwnerDashboard />}
      {role === 'cco'        && <CCODashboard />}
      {role === 'advisor'    && <AdvisorDashboard />}
      {role === 'operations' && <OperationsDashboard />}
      {role === 'associate'  && <AssociateDashboard />}
      {!['owner','cco','advisor','operations','associate'].includes(role) && <OwnerDashboard />}
    </div>
  )
}
