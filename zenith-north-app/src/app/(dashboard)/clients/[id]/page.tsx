'use client'

import { use } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { cn, getInitials, formatDate, daysBetween } from '@/lib/utils'
import {
  IconArrowLeft, IconNotes, IconMessage,
  IconPackage, IconCheck, IconAlertTriangle,
  IconSignature, IconFileText,
} from '@tabler/icons-react'
import type { ClientData } from '@/lib/db/schema'

// ── Info cell ─────────────────────────────────────────────

function InfoCell({ label, value, variant = 'default' }: {
  label: string
  value: string
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'gold'
}) {
  const valueColor = {
    default: 'text-zn-text-1',
    success: 'text-zn-success',
    danger:  'text-zn-danger',
    warning: 'text-zn-warning',
    gold:    'text-zn-gold font-mono',
  }[variant]

  return (
    <div className="rounded border border-zn-border bg-zn-surface-2 p-3">
      <div className="field-label">{label}</div>
      <div className={cn('text-sm font-medium', valueColor)}>{value}</div>
    </div>
  )
}

// ── Timeline entry ────────────────────────────────────────

function TimelineEntry({ dot, action, time }: {
  dot: 'success' | 'gold' | 'warn' | 'ghost'
  action: React.ReactNode
  time: string
}) {
  return (
    <div className="flex gap-3 border-b border-zn-border py-3 last:border-0">
      <div className="flex flex-col items-center pt-1">
        <div className={`tl-dot-${dot}`} />
        <div className="mt-1 w-px flex-1 bg-zn-border" />
      </div>
      <div className="flex-1 pb-1">
        <div className="text-sm text-zn-text-2 leading-snug">{action}</div>
        <div className="mt-1 font-mono text-[10px] text-zn-text-3">{time}</div>
      </div>
    </div>
  )
}

// ── Compliance item row ────────────────────────────────────

function ComplianceRow({ item }: { item: any }) {
  return (
    <div className="flex items-center gap-3 border-b border-zn-border py-2.5 last:border-0">
      <div className={cn(
        'h-1.5 w-1.5 rounded-full flex-shrink-0',
        item.severity === 'critical' ? 'bg-zn-danger' : 'bg-zn-warning',
      )} />
      <div className="flex-1 text-sm text-zn-text-1">{item.title}</div>
      <span className={cn('pill', item.severity === 'critical' ? 'pill-danger' : 'pill-warn')}>
        {item.severity}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const { data, isLoading, error } = trpc.clients.get360.useQuery({ id })

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-4 flex items-center gap-2 font-mono text-[11px] text-zn-text-3">
          <IconArrowLeft size={13} />
          <Link href="/clients" className="hover:text-zn-text-2">Back to clients</Link>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-md bg-zn-surface animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="font-mono text-[11px] text-zn-text-3">Client not found.</div>
        <Link href="/clients" className="mt-3 text-sm text-zn-gold hover:underline">
          Back to clients
        </Link>
      </div>
    )
  }

  const { client, documents, communications, workflowRuns, upcomingEvents, complianceItems } = data
  const clientData = client.data as ClientData
  const fullName = `${clientData.firstName} ${clientData.lastName}`

  const reviewOverdueDays = clientData.annualReviewDue
    ? daysBetween(clientData.annualReviewDue)
    : 0
  const isReviewOverdue = reviewOverdueDays > 0

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <Link
        href="/clients"
        className="mb-4 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-zn-text-3 hover:text-zn-text-2"
      >
        <IconArrowLeft size={13} /> Back to clients
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-start gap-3.5 border-b border-zn-border pb-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-zn-gold-dim bg-zn-gold/8 font-mono text-[15px] font-medium text-zn-gold">
          {getInitials(fullName)}
        </div>
        <div className="flex-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zn-text-1">
            {fullName}
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-zn-text-3">
            <span>{clientData.clientType}</span>
            {clientData.aumBand && <><span className="text-zn-border-2">·</span><span>{clientData.aumBand} AUM</span></>}
            {clientData.riskProfileVersion && <><span className="text-zn-border-2">·</span><span>Risk v{clientData.riskProfileVersion}</span></>}
            {isReviewOverdue && (
              <><span className="text-zn-border-2">·</span>
              <span className="text-zn-danger">Review {reviewOverdueDays}d overdue</span></>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm flex items-center gap-1.5">
            <IconNotes size={13} /> Note
          </button>
          <Link href="/messages" className="btn-ghost btn-sm flex items-center gap-1.5">
            <IconMessage size={13} /> Message
          </Link>
          <Link href="/audit" className="btn-gold btn-sm flex items-center gap-1.5">
            <IconPackage size={13} /> Audit package
          </Link>
        </div>
      </div>

      {/* Tabs — static for now, wire with state later */}
      <div className="mb-5 flex border-b border-zn-border">
        {['Overview', 'Documents', 'Notes', 'Communications', 'Workflows'].map((tab, i) => (
          <div
            key={tab}
            className={cn(
              'cursor-pointer border-b-2 px-4 py-2 text-sm transition-colors',
              i === 0
                ? 'border-b-zn-gold font-medium text-zn-gold'
                : 'border-b-transparent text-zn-text-3 hover:text-zn-text-2',
            )}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Info grid */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <InfoCell
          label="KYC Status"
          value={clientData.kycStatus === 'verified'
            ? `Verified · Exp ${clientData.kycExpiresAt ? formatDate(clientData.kycExpiresAt) : '—'}`
            : clientData.kycStatus
          }
          variant={clientData.kycStatus === 'verified' ? 'success' : 'danger'}
        />
        <InfoCell
          label="Annual review"
          value={isReviewOverdue
            ? `${reviewOverdueDays} days overdue`
            : clientData.annualReviewDue
            ? `Due ${formatDate(clientData.annualReviewDue)}`
            : 'Not set'
          }
          variant={isReviewOverdue ? 'danger' : 'default'}
        />
        <InfoCell
          label="Risk profile"
          value={`v${clientData.riskProfileVersion ?? 1} · ${clientData.status}`}
        />
        <InfoCell
          label="Email"
          value={clientData.email}
        />
        <InfoCell
          label="Phone"
          value={clientData.phone ?? '—'}
        />
        <InfoCell
          label="Advisor"
          value="James Wright"
        />
      </div>

      {/* Open compliance items */}
      {complianceItems.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title">Open compliance items</span>
            <Link href="/compliance" className="card-action">View all</Link>
          </div>
          <div className="px-4">
            {complianceItems.map(item => (
              <ComplianceRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Activity timeline</span>
          <Link href="/audit" className="card-action">Full audit log</Link>
        </div>
        <div className="px-4">
          {communications.slice(0, 5).map((comm, i) => (
            <TimelineEntry
              key={comm.id}
              dot={comm.aiFlagged ? 'warn' : 'gold'}
              action={
                <>
                  <strong className="text-zn-text-1">
                    {comm.direction === 'outbound' ? 'James Wright' : fullName}
                  </strong>
                  {' '}
                  {comm.aiFlagged
                    ? <span className="text-zn-warning">sent flagged message via {comm.channel}</span>
                    : `sent message via ${comm.channel}`
                  }
                </>
              }
              time={new Date(comm.createdAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              }).toUpperCase() + ' · ' + comm.skillSlug?.toUpperCase()}
            />
          ))}
          {communications.length === 0 && (
            <TimelineEntry
              dot="ghost"
              action="No activity recorded yet."
              time="—"
            />
          )}
        </div>
      </div>
    </div>
  )
}
