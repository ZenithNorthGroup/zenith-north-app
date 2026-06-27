'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { cn, getInitials, formatDate } from '@/lib/utils'
import {
  IconPlus, IconSettings2, IconChevronDown,
  IconChevronRight, IconCheck, IconLock,
  IconAlertTriangle, IconUser, IconClock,
  IconRefresh,
} from '@tabler/icons-react'

// ── Types ─────────────────────────────────────────────────

type RunStatus =
  | 'in_progress'
  | 'awaiting_client'
  | 'awaiting_advisor'
  | 'awaiting_approval'
  | 'blocked'
  | 'complete'

// ── Status config ──────────────────────────────────────────

const STATUS_CONFIG: Record<RunStatus, {
  label: string
  pillClass: string
  dotColor: string
}> = {
  awaiting_client: {
    label:     'Awaiting client',
    pillClass: 'pill-gold',
    dotColor:  'bg-zn-gold',
  },
  awaiting_advisor: {
    label:     'Awaiting advisor',
    pillClass: 'pill-ghost',
    dotColor:  'bg-zn-text-2',
  },
  awaiting_approval: {
    label:     'Needs approval',
    pillClass: 'pill-warn',
    dotColor:  'bg-zn-warning',
  },
  blocked: {
    label:     'Blocked',
    pillClass: 'pill-danger',
    dotColor:  'bg-zn-danger',
  },
  complete: {
    label:     'Complete',
    pillClass: 'pill-success',
    dotColor:  'bg-zn-success',
  },
  in_progress: {
    label:     'In progress',
    pillClass: 'pill-ghost',
    dotColor:  'bg-zn-text-2',
  },
}

// ── Progress bar ───────────────────────────────────────────

function ProgressBar({ pct, status }: { pct: number; status: RunStatus }) {
  const fillColor = {
    awaiting_client:   'bg-zn-gold',
    awaiting_advisor:  'bg-zn-text-2',
    awaiting_approval: 'bg-zn-warning',
    blocked:           'bg-zn-danger',
    complete:          'bg-zn-success',
    in_progress:       'bg-zn-text-2',
  }[status]

  return (
    <div className="mt-1.5 h-[2px] w-full rounded-full bg-zn-surface-3">
      <div
        className={cn('h-full rounded-full transition-all', fillColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Step dot ───────────────────────────────────────────────

function StepDot({ stepStatus }: { stepStatus: string }) {
  if (stepStatus === 'complete') {
    return (
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zn-success/10 text-zn-success">
        <IconCheck size={11} />
      </div>
    )
  }
  if (stepStatus === 'blocked') {
    return (
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zn-danger/10 text-zn-danger">
        <IconAlertTriangle size={11} />
      </div>
    )
  }
  if (stepStatus === 'pending') {
    return (
      <div className="h-5 w-5 flex-shrink-0 rounded-full border border-zn-border-2 bg-zn-surface-3" />
    )
  }
  return (
    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zn-gold/10 text-zn-gold">
      <IconClock size={11} />
    </div>
  )
}

// ── Run card ───────────────────────────────────────────────

function RunCard({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false)
  const advanceMutation = trpc.workflows.advanceStep.useMutation()
  const approvalMutation = trpc.workflows.processApproval.useMutation()

  const statusCfg = STATUS_CONFIG[run.status as RunStatus] ?? STATUS_CONFIG.in_progress

  // Get client name from run data
  const initials = run.clientName
    ? run.clientName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'CL'
  const clientName = run.clientName ?? `Client ${run.entityId.slice(0, 8)}`

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(run.startedAt).getTime()) / 86400000
  )

  return (
    <div className="border-b border-zn-border last:border-0">
      {/* Header row */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-zn-surface-2"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-medium',
          run.status === 'blocked'
            ? 'border-zn-danger bg-zn-danger/10 text-zn-danger'
            : run.status === 'awaiting_approval'
            ? 'border-zn-warning bg-zn-warning/10 text-zn-warning'
            : 'border-zn-border-2 bg-zn-surface-3 text-zn-text-2',
        )}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zn-text-1">{clientName}</span>
            {run.status === 'awaiting_approval' && (
              <span className="font-mono text-[9px] text-zn-warning">ACTION REQUIRED</span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">
            STEP {(run.completedCount ?? 0) + 1} OF {run.totalSteps ?? '—'}
            {run.currentStep && ` · ${run.currentStep.name.toUpperCase()}`}
            {` · ${daysSinceStart}D AGO`}
          </div>
          <ProgressBar pct={run.progressPct ?? 0} status={run.status} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {run.status === 'awaiting_approval' ? (
            <button
              className="btn-gold btn-sm"
              onClick={e => {
                e.stopPropagation()
                // Navigate to approval view
              }}
            >
              Approve now
            </button>
          ) : (
            <span className={cn('pill', statusCfg.pillClass)}>
              {statusCfg.label}
            </span>
          )}
          {expanded
            ? <IconChevronDown size={14} className="text-zn-text-3" />
            : <IconChevronRight size={14} className="text-zn-text-3" />
          }
        </div>
      </div>

      {/* Expanded steps */}
      {expanded && (
        <div className="border-t border-zn-border bg-zn-surface-2 px-4 py-3">
          <div className="flex flex-col gap-0">
            {(run.steps ?? []).map((step: any, i: number) => {
              const completion = (run.completions ?? []).find(
                (c: any) => c.stepId === step.id
              )
              const stepStatus = completion?.status ?? 'pending'
              const config = step.config ?? {}
              const isNext = run.currentStep?.id === step.id

              return (
                <div key={step.id} className="flex items-stretch gap-3">
                  {/* Connector */}
                  <div className="flex flex-col items-center">
                    <StepDot stepStatus={stepStatus} />
                    {i < (run.steps?.length ?? 0) - 1 && (
                      <div className="w-px flex-1 bg-zn-border my-1" />
                    )}
                  </div>

                  {/* Step info */}
                  <div className={cn(
                    'flex-1 pb-3 pt-0.5',
                    i === (run.steps?.length ?? 0) - 1 && 'pb-1',
                  )}>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm',
                        stepStatus === 'complete'
                          ? 'text-zn-text-2 line-through'
                          : isNext
                          ? 'font-medium text-zn-text-1'
                          : 'text-zn-text-2',
                      )}>
                        {step.name}
                      </span>

                      {/* Tags */}
                      {config.portal && (
                        <span className="pill pill-gold text-[9px]">
                          <IconUser size={9} className="mr-0.5" />Client
                        </span>
                      )}
                      {config.requires_signature && (
                        <span className="pill pill-success text-[9px]">Signature</span>
                      )}
                      {stepStatus === 'blocked' && (
                        <span className="pill pill-danger text-[9px]">Blocked</span>
                      )}
                    </div>

                    {/* Completion meta */}
                    {completion?.completedAt && (
                      <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">
                        Completed {formatDate(completion.completedAt)}
                      </div>
                    )}

                    {/* Blocker message */}
                    {stepStatus === 'blocked' && (
                      <div className="mt-1 rounded bg-zn-danger/10 px-2 py-1 font-mono text-[10px] text-zn-danger">
                        Policy gate: {
                          config.requires_signature
                            ? 'Signed document required to proceed'
                            : 'Step requirements not met'
                        }
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2 border-t border-zn-border pt-3">
            {run.status === 'awaiting_approval' && (
              <button
                className="btn-gold btn-sm"
                onClick={() => approvalMutation.mutate({
                  runId:         run.id,
                  stepId:        run.currentStep?.id,
                  outcome:       'approved',
                  reviewedItems: [],
                })}
              >
                Approve
              </button>
            )}
            {run.status === 'awaiting_client' && (
              <button className="btn-ghost btn-sm">
                Send reminder
              </button>
            )}
            {run.status === 'blocked' && (
              <button className="btn-gold btn-sm">
                Resolve block
              </button>
            )}
            <Link
              href={`/clients/${run.entityId}`}
              className="btn-ghost btn-sm"
            >
              View client
            </Link>
            <button className="btn-ghost btn-sm ml-auto">
              Generate audit package
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Filter tabs ────────────────────────────────────────────

function FilterTab({
  label, count, active, onClick,
}: {
  label: string; count?: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wide transition-all',
        active
          ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
          : 'border-zn-border bg-transparent text-zn-text-3 hover:border-zn-border-2',
      )}
    >
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [filter, setFilter] = useState<string | undefined>(undefined)

  const { data: runs = [], isLoading, refetch } = trpc.workflows.listRuns.useQuery({
    status: filter,
    limit:  50,
  })

  const { data: summary } = trpc.workflows.summary.useQuery()

  const activeRuns = runs.filter(r => r.status !== 'complete')
  const completedRuns = runs.filter(r => r.status === 'complete')

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
            Workflows
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            {isLoading ? 'LOADING...' : `${activeRuns.length} ACTIVE · ${completedRuns.length} COMPLETE`}
            {summary?.awaitingApproval
              ? ` · ${summary.awaitingApproval} NEED YOUR APPROVAL`
              : ''
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost flex items-center gap-1.5"
            onClick={() => refetch()}
          >
            <IconRefresh size={13} /> Refresh
          </button>
          <Link href="/builder" className="btn-ghost flex items-center gap-1.5">
            <IconSettings2 size={13} /> Configure
          </Link>
          <button className="btn-gold flex items-center gap-1.5">
            <IconPlus size={13} /> New onboarding
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        <div
          className={cn('stat-card cursor-pointer', !filter && 'before:opacity-40')}
          onClick={() => setFilter(undefined)}
        >
          <div className="stat-label">Active onboardings</div>
          <div className="stat-num text-zn-gold">{summary?.total ?? '—'}</div>
          <div className="stat-delta">Across all statuses</div>
        </div>
        <div
          className={cn('stat-card cursor-pointer', filter === 'awaiting_approval' && 'border-zn-warning/40')}
          onClick={() => setFilter('awaiting_approval')}
        >
          <div className="stat-label">Need approval</div>
          <div className="stat-num text-zn-warning">{summary?.awaitingApproval ?? '—'}</div>
          <div className="stat-delta">Waiting on you</div>
        </div>
        <div
          className={cn('stat-card cursor-pointer', filter === 'awaiting_client' && 'border-zn-gold/40')}
          onClick={() => setFilter('awaiting_client')}
        >
          <div className="stat-label">Awaiting client</div>
          <div className="stat-num text-zn-gold">{summary?.awaitingClient ?? '—'}</div>
          <div className="stat-delta">Ball in client's court</div>
        </div>
        <div
          className={cn('stat-card cursor-pointer', filter === 'blocked' && 'border-zn-danger/40')}
          onClick={() => setFilter('blocked')}
        >
          <div className="stat-label">Blocked</div>
          <div className="stat-num text-zn-danger">{summary?.blocked ?? '—'}</div>
          <div className="stat-delta">Policy gate failed</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-2">
        <FilterTab label="All active" active={!filter} onClick={() => setFilter(undefined)} />
        <FilterTab label="Needs approval" count={summary?.awaitingApproval} active={filter === 'awaiting_approval'} onClick={() => setFilter('awaiting_approval')} />
        <FilterTab label="Awaiting client" count={summary?.awaitingClient} active={filter === 'awaiting_client'} onClick={() => setFilter('awaiting_client')} />
        <FilterTab label="Blocked" count={summary?.blocked} active={filter === 'blocked'} onClick={() => setFilter('blocked')} />
        <FilterTab label="Complete" active={filter === 'complete'} onClick={() => setFilter('complete')} />
      </div>

      {/* Run list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {filter ? filter.replace(/_/g, ' ') : 'Active onboardings'}
          </span>
          <span className="font-mono text-[10px] text-zn-text-3">
            {isLoading ? '...' : `${runs.length} runs`}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0">
                <div className="h-8 w-8 rounded-full bg-zn-surface-3 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 rounded bg-zn-surface-3 animate-pulse" />
                  <div className="h-2 w-56 rounded bg-zn-surface-3 animate-pulse" />
                  <div className="h-1 w-full rounded bg-zn-surface-3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="font-mono text-[11px] text-zn-text-3">
              {filter
                ? `No ${filter.replace(/_/g, ' ')} workflows.`
                : 'No active onboardings. Start one to get going.'
              }
            </div>
            {!filter && (
              <button className="btn-gold btn-sm mt-4">
                <IconPlus size={13} /> Start first onboarding
              </button>
            )}
          </div>
        ) : (
          <div>
            {runs.map(run => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
