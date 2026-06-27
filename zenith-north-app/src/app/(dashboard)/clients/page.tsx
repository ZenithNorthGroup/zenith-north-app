'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { cn, getInitials } from '@/lib/utils'
import { IconPlus, IconFilter, IconDownload, IconSearch } from '@tabler/icons-react'
import type { ClientData } from '@/lib/db/schema'

// ── Types ─────────────────────────────────────────────────

type ClientStatus = 'prospect' | 'active' | 'inactive' | 'archived'

// ── Status pill ───────────────────────────────────────────

function StatusPill({ status, kycStatus, hasFlag }: {
  status: ClientStatus
  kycStatus: string
  hasFlag?: boolean
}) {
  if (hasFlag) return <span className="pill pill-warn">Flagged</span>
  if (status === 'active') return <span className="pill pill-success">Active</span>
  if (status === 'prospect') return <span className="pill pill-gold">Prospect</span>
  return <span className="pill pill-ghost">{status}</span>
}

// ── Client row ────────────────────────────────────────────

function ClientRow({ client }: { client: any }) {
  const data = client.data as ClientData
  const fullName = `${data.firstName} ${data.lastName}`
  const initials = getInitials(fullName)

  const isOverdue = data.annualReviewDue
    && new Date(data.annualReviewDue) < new Date()
  const isOnboarding = data.status === 'prospect'

  const avatarClass = cn(
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-medium',
    isOverdue
      ? 'border-zn-danger bg-zn-danger/10 text-zn-danger'
      : isOnboarding
      ? 'border-zn-gold/40 bg-zn-gold/8 text-zn-gold'
      : 'border-zn-border-2 bg-zn-surface-3 text-zn-text-2',
  )

  return (
    <Link href={`/clients/${client.id}`} className="table-row">
      <div className={avatarClass}>{initials}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zn-text-1">{fullName}</div>
        <div className="mt-0.5 font-mono text-[10px] text-zn-text-3 truncate">
          {data.clientType.toUpperCase()}
          {data.aumBand ? ` · ${data.aumBand}` : ''}
          {isOverdue ? ' · REVIEW OVERDUE' : ''}
          {isOnboarding ? ' · ONBOARDING' : ''}
        </div>
      </div>
      <StatusPill
        status={data.status as ClientStatus}
        kycStatus={data.kycStatus}
      />
      <div className="min-w-[90px] text-right font-mono text-sm text-zn-text-2">
        {data.aumBand ?? '—'}
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>(undefined)

  const { data, isLoading } = trpc.clients.list.useQuery({
    search: search || undefined,
    status,
    limit: 50,
  })

  const clients = data ?? []

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
            Clients
          </h1>
          <p className="mt-0.5 text-sm text-zn-text-3">
            {isLoading ? 'Loading...' : `${clients.length} clients`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm flex items-center gap-1.5">
            <IconFilter size={13} /> Filter
          </button>
          <button className="btn-ghost btn-sm flex items-center gap-1.5">
            <IconDownload size={13} /> Export
          </button>
          <Link href="/clients/new" className="btn-gold btn-sm flex items-center gap-1.5">
            <IconPlus size={13} /> Add client
          </Link>
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zn-text-3" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['active', 'prospect', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? undefined : s)}
              className={cn(
                'rounded border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wide transition-all',
                status === s
                  ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
                  : 'border-zn-border bg-transparent text-zn-text-3 hover:border-zn-border-2 hover:text-zn-text-2',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All clients</span>
          <span className="font-mono text-[10px] text-zn-text-3">
            {isLoading ? '...' : `${clients.length} results`}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0">
                <div className="h-8 w-8 rounded-full bg-zn-surface-3 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-36 rounded bg-zn-surface-3 animate-pulse" />
                  <div className="h-2 w-48 rounded bg-zn-surface-3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="font-mono text-[11px] text-zn-text-3">
              {search ? 'No clients match your search.' : 'No clients yet.'}
            </div>
            {!search && (
              <Link href="/clients/new" className="btn-gold btn-sm mt-4 inline-flex">
                <IconPlus size={13} /> Add first client
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {clients.map(client => (
              <ClientRow key={`${client.id}-${client.version}`} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
