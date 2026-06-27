'use client'

import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import { IconDownload, IconTrendingUp } from '@tabler/icons-react'

export default function ReportsPage() {
  const { data: complianceData } = trpc.compliance.dashboard.useQuery()
  const { data: workflowSummary } = trpc.workflows.summary.useQuery()

  const stats = complianceData?.stats

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">Reports</h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            FIRM ANALYTICS · COMPLIANCE SUMMARIES · ADVISOR PRODUCTIVITY
          </p>
        </div>
        <button className="btn-ghost btn-sm flex items-center gap-1.5">
          <IconDownload size={12} /> Export
        </button>
      </div>

      {/* Firm health */}
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        <div className="stat-card">
          <div className="stat-label">Active clients</div>
          <div className="stat-num text-zn-gold">{complianceData?.activeClients ?? '—'}</div>
          <div className="stat-delta">+3 this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Compliance score</div>
          <div className={cn('stat-num', (stats?.critical ?? 0) > 0 ? 'text-zn-danger' : 'text-zn-success')}>
            {(stats?.critical ?? 0) > 0 ? 'Needs work' : 'Clean'}
          </div>
          <div className="stat-delta">
            {(stats?.critical ?? 0)} critical · {(stats?.warning ?? 0)} warnings
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active onboardings</div>
          <div className="stat-num text-zn-gold">{workflowSummary?.total ?? '—'}</div>
          <div className="stat-delta">{workflowSummary?.awaitingApproval ?? 0} need approval</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Audit entries (total)</div>
          <div className="stat-num">—</div>
          <div className="stat-delta">Append-only log</div>
        </div>
      </div>

      {/* Coming soon notice */}
      <div className="rounded border border-zn-gold/20 bg-zn-gold/5 px-6 py-10 text-center">
        <IconTrendingUp size={28} className="mb-3 mx-auto text-zn-gold" />
        <div className="mb-2 text-sm font-medium text-zn-text-1">
          Full reporting coming in Phase 3
        </div>
        <div className="font-mono text-[11px] text-zn-text-3 max-w-sm mx-auto">
          AUM dashboards, client performance reports, compliance trend analysis,
          advisor productivity metrics, and custodian data integration.
          Available with custodian sync add-on.
        </div>
      </div>
    </div>
  )
}
