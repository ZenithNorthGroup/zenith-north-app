'use client'

import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import { IconDownload, IconShield, IconUsers, IconGitBranch, IconMessage } from '@tabler/icons-react'

export default function ReportsPage() {
  const { data: complianceData, isLoading: cLoading } = trpc.compliance.dashboard.useQuery()
  const { data: workflowSummary, isLoading: wLoading } = trpc.workflows.summary.useQuery()
  const { data: taskSummary,    isLoading: tLoading } = trpc.tasks.summary.useQuery()
  const { data: docSummary,     isLoading: dLoading } = trpc.documents.summary.useQuery()
  const { data: auditSummary,   isLoading: aLoading } = trpc.audit.summary.useQuery()

  const stats = complianceData?.stats
  const critical = stats?.critical ?? 0
  const warning  = stats?.warning  ?? 0
  const examScore = Math.max(0, 100 - (critical * 20) - (warning * 5))

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[12px] text-zn-text-3">Live data from your database — refreshed on load</p>
        <button className="btn-ghost btn-sm flex items-center gap-1.5">
          <IconDownload size={12} /> Export PDF
        </button>
      </div>

      {/* Exam readiness */}
      <div className="mb-4 rounded-xl border p-5 flex items-center gap-5"
        style={{
          background:  examScore >= 80 ? 'var(--zn-success-bg)' : examScore >= 50 ? 'rgba(217,119,6,0.06)' : 'rgba(220,38,38,0.06)',
          borderColor: examScore >= 80 ? 'var(--zn-success-border)' : examScore >= 50 ? 'var(--zn-warning-border)' : 'var(--zn-danger-border)',
        }}>
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white text-[22px] font-bold"
          style={{ color: examScore >= 80 ? 'var(--zn-success)' : examScore >= 50 ? 'var(--zn-warning)' : 'var(--zn-danger)' }}>
          {cLoading ? '—' : examScore}
        </div>
        <div>
          <div className="text-[15px] font-semibold text-zn-text-1">SEC Exam Readiness Score</div>
          <div className="text-[12px] text-zn-text-3 mt-1 max-w-lg">
            {examScore >= 80
              ? 'Firm is well-positioned for an SEC examination. All critical compliance items are resolved.'
              : examScore >= 50
              ? 'Some compliance gaps exist. Resolve open items before scheduling an examination.'
              : 'Critical compliance gaps detected. Address these immediately.'}
          </div>
          <div className="mt-2 text-[11px] text-zn-text-3">
            Score = 100 − (critical × 20) − (warning × 5). Max 100.
          </div>
        </div>
      </div>

      {/* 4-column summary */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="stat-label">Active clients</div>
          <div className="stat-num" style={{ color: 'var(--zn-gold-dark)' }}>
            {cLoading ? '—' : complianceData?.activeClients ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Compliance score</div>
          <div className={cn('stat-num', critical > 0 ? 'text-zn-danger' : 'text-zn-success')}>
            {cLoading ? '—' : examScore + '/100'}
          </div>
          <div className="stat-delta">{critical} critical · {warning} warnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active onboardings</div>
          <div className="stat-num" style={{ color: 'var(--zn-gold-dark)' }}>
            {wLoading ? '—' : workflowSummary?.total ?? 0}
          </div>
          <div className="stat-delta">{workflowSummary?.awaitingApproval ?? 0} need approval</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total audit entries</div>
          <div className="stat-num text-zn-text-1">
            {aLoading ? '—' : auditSummary?.total ?? 0}
          </div>
          <div className="stat-delta">Append-only log</div>
        </div>
      </div>

      {/* Detailed breakdowns */}
      <div className="grid grid-cols-2 gap-4">

        {/* Compliance breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2"><IconShield size={13} /> Compliance breakdown</span>
          </div>
          {[
            { label: 'Critical items',          value: critical,                     accent: 'var(--zn-danger)' },
            { label: 'Warning items',           value: warning,                      accent: 'var(--zn-warning)' },
            { label: 'Info items',              value: stats?.info ?? 0,             accent: '#3B82F6' },
            { label: 'Upcoming SEC filings',    value: complianceData?.filings?.length ?? 0, accent: 'var(--zn-gold-dark)' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between border-b border-zn-border px-5 py-3.5 last:border-0">
              <span className="text-[13px] text-zn-text-2">{row.label}</span>
              <span className="text-[18px] font-semibold" style={{ color: row.accent }}>
                {cLoading ? '—' : row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Workflow breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2"><IconGitBranch size={13} /> Workflow breakdown</span>
          </div>
          {[
            { label: 'Total active runs',       value: workflowSummary?.total ?? 0 },
            { label: 'Awaiting CCO approval',   value: workflowSummary?.awaitingApproval ?? 0 },
            { label: 'Awaiting client action',  value: workflowSummary?.awaitingClient ?? 0 },
            { label: 'Completed (all time)',    value: workflowSummary?.completed ?? 0 },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between border-b border-zn-border px-5 py-3.5 last:border-0">
              <span className="text-[13px] text-zn-text-2">{row.label}</span>
              <span className="text-[18px] font-semibold" style={{ color: 'var(--zn-gold-dark)' }}>
                {wLoading ? '—' : row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Task breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2"><IconUsers size={13} /> Tasks & documents</span>
          </div>
          {[
            { label: 'Open tasks',              value: taskSummary?.open    ?? 0, accent: 'var(--zn-gold-dark)' },
            { label: 'Overdue tasks',           value: taskSummary?.overdue ?? 0, accent: 'var(--zn-danger)' },
            { label: 'Total documents',         value: docSummary?.total    ?? 0, accent: 'var(--zn-text-1)' },
            { label: 'Documents needing signature', value: docSummary?.unsigned ?? 0, accent: 'var(--zn-warning)' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between border-b border-zn-border px-5 py-3.5 last:border-0">
              <span className="text-[13px] text-zn-text-2">{row.label}</span>
              <span className="text-[18px] font-semibold" style={{ color: row.accent }}>
                {(tLoading || dLoading) ? '—' : row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Compliance by type */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2"><IconMessage size={13} /> Compliance by type</span>
          </div>
          {Object.entries(stats?.byType ?? {}).length === 0 ? (
            <div className="px-5 py-6 text-[12px] text-zn-text-3">No open items</div>
          ) : (
            Object.entries(stats?.byType ?? {}).filter(([, v]) => (v as number) > 0).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between border-b border-zn-border px-5 py-3.5 last:border-0">
                <span className="text-[13px] text-zn-text-2 capitalize">{type.replace(/_/g, ' ')}</span>
                <span className="text-[18px] font-semibold text-zn-text-1">{count as number}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
