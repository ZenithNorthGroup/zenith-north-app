'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { cn, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  IconArrowLeft, IconCheck, IconX,
  IconShield, IconFileText, IconId,
  IconChartBar,
} from '@tabler/icons-react'

// ── Checklist item ─────────────────────────────────────────

function ChecklistItem({
  label, detail, checked, onToggle,
}: {
  label: string; detail: string; checked: boolean; onToggle: () => void
}) {
  return (
    <div
      className="flex cursor-pointer items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0 transition-colors hover:bg-zn-surface-2"
      onClick={onToggle}
    >
      <div className={cn(
        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all',
        checked
          ? 'border-zn-gold bg-zn-gold text-zn-black'
          : 'border-zn-border-2 bg-zn-surface-3',
      )}>
        {checked && <IconCheck size={11} />}
      </div>
      <div className="flex-1">
        <div className="text-sm text-zn-text-1">{label}</div>
        <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">{detail}</div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function ApprovalPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = use(params)
  const router = useRouter()

  const [outcome, setOutcome] = useState<'approved' | 'approved_with_conditions' | 'rejected' | null>(null)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [conditions, setConditions] = useState('')
  const [reviewedItems, setReviewedItems] = useState<string[]>([])

  const { data, isLoading } = trpc.workflows.getRun.useQuery({ id: runId })
  const approvalMutation = trpc.workflows.processApproval.useMutation({
    onSuccess: () => router.push('/workflows'),
  })

  const REQUIRED_ITEMS = [
    {
      id:     'risk_profile',
      label:  'Risk profile is consistent with proposed investment strategy',
      detail: 'Reviewed questionnaire answers and risk score',
    },
    {
      id:     'signed_agreement',
      label:  'Signed investment advisory agreement on file',
      detail: 'Verified signature date and document version',
    },
    {
      id:     'kyc_status',
      label:  'KYC verified and within expiry window',
      detail: 'Confirmed identity verification status',
    },
    {
      id:     'compliance_flags',
      label:  'No unresolved compliance flags on this client',
      detail: 'Checked compliance dashboard for open items',
    },
  ]

  const allChecked = REQUIRED_ITEMS.every(item => reviewedItems.includes(item.id))
  const canSubmit = outcome !== null && allChecked && (
    outcome === 'rejected' ? reason.length > 0 : true
  )

  function toggleItem(id: string) {
    setReviewedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  function handleSubmit() {
    if (!canSubmit || !data?.nextPendingStep) return

    approvalMutation.mutate({
      runId,
      stepId:     data.nextPendingStep.id,
      outcome:    outcome!,
      notes:      notes || undefined,
      reason:     reason || undefined,
      conditions: conditions
        ? conditions.split('\n').filter(Boolean)
        : undefined,
      reviewedItems,
    })
  }

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-md bg-zn-surface animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data?.run) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="font-mono text-[11px] text-zn-text-3">Workflow run not found.</div>
        <Link href="/workflows" className="mt-3 text-sm text-zn-gold hover:underline">
          Back to workflows
        </Link>
      </div>
    )
  }

  const { run, steps, nextPendingStep } = data

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Back */}
      <Link
        href="/workflows"
        className="mb-5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-zn-text-3 hover:text-zn-text-2"
      >
        <IconArrowLeft size={13} /> Back to workflows
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-zn-gold-dim bg-zn-gold/8">
          <IconShield size={18} className="text-zn-gold" />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-zn-text-1">
            Internal approval required
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            {nextPendingStep?.name?.toUpperCase() ?? 'APPROVAL STEP'}
            {' · '}AWAITING YOUR REVIEW
          </p>
        </div>
      </div>

      {/* Client summary */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Client summary</span>
          <Link href={`/clients/${run.entityId}`} className="card-action">
            View full profile
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4">
          {[
            { icon: IconId,       label: 'KYC Status',    value: 'Verified',          color: 'text-zn-success' },
            { icon: IconChartBar, label: 'Risk profile',  value: 'Moderate · 62/100', color: 'text-zn-text-1' },
            { icon: IconFileText, label: 'Agreement',     value: 'Signed',            color: 'text-zn-success' },
          ].map(item => (
            <div key={item.label} className="rounded border border-zn-border bg-zn-surface-2 p-3">
              <div className="field-label">{item.label}</div>
              <div className={cn('text-sm font-medium', item.color)}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Steps completed so far */}
        <div className="border-t border-zn-border px-4 pb-3 pt-3">
          <div className="field-label mb-2">Steps completed</div>
          <div className="flex flex-col gap-1">
            {steps.map(step => {
              const completion = run.completions?.find((c: any) => c.stepId === step.id)
              const isDone = completion?.status === 'complete'
              const isCurrent = step.id === nextPendingStep?.id

              return (
                <div key={step.id} className={cn(
                  'flex items-center gap-2 font-mono text-[11px]',
                  isDone ? 'text-zn-text-3' : isCurrent ? 'text-zn-gold' : 'text-zn-text-3 opacity-50',
                )}>
                  <div className={cn(
                    'h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0',
                    isDone ? 'bg-zn-success/10 text-zn-success' : isCurrent ? 'bg-zn-gold/10 text-zn-gold' : 'bg-zn-surface-3',
                  )}>
                    {isDone && <IconCheck size={9} />}
                  </div>
                  {step.name}
                  {isDone && completion?.completedAt && (
                    <span className="text-zn-text-3">
                      · {formatDate(completion.completedAt)}
                    </span>
                  )}
                  {isCurrent && <span className="text-zn-gold">← Current</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Required review checklist */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Required review checklist</span>
          <span className="font-mono text-[10px] text-zn-text-3">
            {reviewedItems.length}/{REQUIRED_ITEMS.length} confirmed
          </span>
        </div>
        {REQUIRED_ITEMS.map(item => (
          <ChecklistItem
            key={item.id}
            label={item.label}
            detail={item.detail}
            checked={reviewedItems.includes(item.id)}
            onToggle={() => toggleItem(item.id)}
          />
        ))}
      </div>

      {/* Decision */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Decision</span>
        </div>
        <div className="p-4">
          {/* Outcome buttons */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              { value: 'approved',                label: 'Approve',                 cls: 'border-zn-success/30 bg-zn-success/10 text-zn-success' },
              { value: 'approved_with_conditions', label: 'Approve with conditions', cls: 'border-zn-warning/30 bg-zn-warning/10 text-zn-warning' },
              { value: 'rejected',                label: 'Reject',                  cls: 'border-zn-danger/30 bg-zn-danger/10 text-zn-danger' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setOutcome(opt.value as typeof outcome)}
                className={cn(
                  'rounded border py-2.5 text-sm font-medium transition-all',
                  outcome === opt.value
                    ? opt.cls
                    : 'border-zn-border bg-zn-surface-2 text-zn-text-2 hover:border-zn-border-2',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Conditions input */}
          {outcome === 'approved_with_conditions' && (
            <div className="mb-3">
              <label className="field-label">Conditions (one per line)</label>
              <textarea
                value={conditions}
                onChange={e => setConditions(e.target.value)}
                placeholder="e.g. Limit initial investment to $50k pending full AML review"
                className="field-input min-h-[80px] resize-none"
              />
            </div>
          )}

          {/* Rejection reason */}
          {outcome === 'rejected' && (
            <div className="mb-3">
              <label className="field-label">Reason for rejection (required)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why this onboarding cannot proceed..."
                className="field-input min-h-[80px] resize-none"
              />
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label className="field-label">Notes — visible in audit record</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes for the record..."
              className="field-input min-h-[64px] resize-none"
            />
          </div>

          {/* Submit row */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || approvalMutation.isPending}
              className={cn(
                'btn-gold',
                (!canSubmit || approvalMutation.isPending) && 'cursor-not-allowed opacity-50',
              )}
            >
              {approvalMutation.isPending ? 'Submitting...' : 'Submit decision'}
            </button>
            <Link href="/workflows" className="btn-ghost">
              Cancel
            </Link>
            {!allChecked && (
              <span className="font-mono text-[10px] text-zn-text-3">
                All {REQUIRED_ITEMS.length} checklist items must be confirmed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Audit note */}
      <div className="rounded border border-zn-border bg-zn-surface-2 px-4 py-3">
        <div className="font-mono text-[10px] text-zn-text-3">
          This decision will be permanently recorded in the audit log with your name,
          timestamp, IP address, and the items you confirmed reviewing.
          This record cannot be edited or deleted.
        </div>
      </div>
    </div>
  )
}
