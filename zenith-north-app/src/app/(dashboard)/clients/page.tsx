'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import { IconSearch, IconPlus, IconArrowUpRight, IconUser } from '@tabler/icons-react'

const STATUS_CONFIG = {
  active:   { pill: 'pill-success pill', label: 'Active' },
  prospect: { pill: 'pill-gold pill',    label: 'Prospect' },
  inactive: { pill: 'pill-ghost pill',   label: 'Inactive' },
  archived: { pill: 'pill-ghost pill',   label: 'Archived' },
} as const

const KYC_CONFIG = {
  verified:      { pill: 'pill-success pill', label: 'Verified' },
  needs_review:  { pill: 'pill-warn pill',    label: 'Needs review' },
  pending:       { pill: 'pill-ghost pill',   label: 'Pending' },
  flagged:       { pill: 'pill-danger pill',  label: 'Flagged' },
} as const

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: clients = [], isLoading } = trpc.clients.list.useQuery({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter as any,
  })

  const FILTERS = ['all', 'active', 'prospect', 'inactive']

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[12px] text-zn-text-3">
            {isLoading ? '—' : clients.length} clients total
          </p>
        </div>
        <button className="btn-gold btn-sm flex items-center gap-1.5">
          <IconPlus size={13} /> Add client
        </button>
      </div>

      {/* Filters + search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zn-text-3" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[12px] font-medium transition-all capitalize',
                statusFilter === f
                  ? 'border-[var(--zn-gold)] bg-[var(--zn-gold-bg)] text-[var(--zn-gold-dark)]'
                  : 'border-zn-border bg-white text-zn-text-2 hover:border-zn-border-2',
              )}
            >
              {f === 'all' ? 'All clients' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {/* Header row */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_80px] gap-4 border-b border-zn-border bg-zn-surface-2 px-5 py-2.5">
          {['Client', 'Contact', 'Status', 'KYC', ''].map(h => (
            <div key={h} className="text-[10px] font-semibold uppercase tracking-[0.07em] text-zn-text-3">{h}</div>
          ))}
        </div>

        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_80px] gap-4 px-5 py-3.5 border-b border-zn-border last:border-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-zn-surface-3 animate-pulse" />
                <div className="h-3 w-32 rounded bg-zn-surface-3 animate-pulse" />
              </div>
              <div className="h-3 w-28 rounded bg-zn-surface-3 animate-pulse self-center" />
              <div className="h-5 w-16 rounded-full bg-zn-surface-3 animate-pulse self-center" />
              <div className="h-5 w-20 rounded-full bg-zn-surface-3 animate-pulse self-center" />
            </div>
          ))
        ) : clients.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-zn-text-3">
            {search ? 'No clients match your search.' : 'No clients yet.'}
          </div>
        ) : (
          (clients as any[]).map((client) => {
            const data = client.data as any
            const status = STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.inactive
            const kyc    = KYC_CONFIG[data.kycStatus as keyof typeof KYC_CONFIG] ?? KYC_CONFIG.pending
            const initials = `${(data.firstName ?? '')[0] ?? ''}${(data.lastName ?? '')[0] ?? ''}`.toUpperCase()
            const name = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim()

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_80px] gap-4 items-center
                           border-b border-zn-border px-5 py-3.5 last:border-0
                           transition-colors hover:bg-zn-surface-2 group"
              >
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}
                  >
                    {initials || <IconUser size={13} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-zn-text-1 truncate">{name}</div>
                    <div className="text-[11px] text-zn-text-3 capitalize">{data.clientType ?? 'individual'}</div>
                  </div>
                </div>

                {/* Contact */}
                <div className="min-w-0">
                  <div className="text-[12px] text-zn-text-2 truncate">{data.email ?? '—'}</div>
                  <div className="text-[11px] text-zn-text-3 truncate">{data.phone ?? ''}</div>
                </div>

                {/* Status */}
                <div><span className={status.pill}>{status.label}</span></div>

                {/* KYC */}
                <div><span className={kyc.pill}>{kyc.label}</span></div>

                {/* Arrow */}
                <div className="flex justify-end">
                  <IconArrowUpRight
                    size={14}
                    className="text-zn-text-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
