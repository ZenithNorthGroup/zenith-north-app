'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn, formatDate } from '@/lib/utils'
import {
  IconUpload, IconSearch, IconFileText,
  IconSignature, IconClock, IconDownload,
} from '@tabler/icons-react'

// ── Doc type config ────────────────────────────────────────

const DOC_TYPES = {
  agreement:        { label: 'Agreement',       pill: 'pill-gold'    },
  disclosure:       { label: 'Disclosure',      pill: 'pill-ghost'   },
  id_verification:  { label: 'ID Verification', pill: 'pill-success' },
  statement:        { label: 'Statement',       pill: 'pill-ghost'   },
  risk_profile:     { label: 'Risk Profile',    pill: 'pill-warn'    },
  meeting_note:     { label: 'Meeting Note',    pill: 'pill-ghost'   },
  meeting_recording:{ label: 'Recording',       pill: 'pill-info'    },
  complaint_record: { label: 'Complaint',       pill: 'pill-danger'  },
} as const

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// ── Document row ───────────────────────────────────────────

function DocRow({ doc }: { doc: any }) {
  const typeConfig = DOC_TYPES[doc.docType as keyof typeof DOC_TYPES]
    ?? { label: doc.docType, pill: 'pill-ghost' }

  const retentionExpiring = doc.retainUntil
    ? Math.ceil((new Date(doc.retainUntil).getTime() - Date.now()) / 86400000) < 180
    : false

  return (
    <div className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0 hover:bg-zn-surface-2 cursor-pointer transition-colors">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-zn-border bg-zn-surface-3 text-zn-text-3">
        <IconFileText size={14} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zn-text-1 truncate">{doc.name}</div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-zn-text-3">
          {doc.clientName && <span>{doc.clientName}</span>}
          {doc.clientName && <span>·</span>}
          <span>{formatBytes(doc.sizeBytes)}</span>
          <span>·</span>
          <span>{formatDate(doc.createdAt)}</span>
        </div>
      </div>

      <span className={cn('pill flex-shrink-0', typeConfig.pill)}>
        {typeConfig.label}
      </span>

      <div className="flex-shrink-0">
        {doc.signedAt ? (
          <div className="flex items-center gap-1 font-mono text-[10px] text-zn-success">
            <IconSignature size={11} />
            Signed {formatDate(doc.signedAt)}
          </div>
        ) : doc.docType !== 'meeting_recording' ? (
          <div className="flex items-center gap-1 font-mono text-[10px] text-zn-warning">
            <IconClock size={11} />
            Awaiting signature
          </div>
        ) : null}
      </div>

      {doc.retainUntil && (
        <div className={cn(
          'flex-shrink-0 font-mono text-[10px]',
          retentionExpiring ? 'text-zn-warning' : 'text-zn-text-3',
        )}>
          Until {formatDate(doc.retainUntil)}
        </div>
      )}

      <button className="btn-ghost p-1.5 flex-shrink-0">
        <IconDownload size={13} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

const TYPE_FILTERS = Object.entries(DOC_TYPES).map(([k, v]) => ({ key: k, label: v.label }))

export default function DocumentsPage() {
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>()

  const { data: docs = [], isLoading } = trpc.documents.list.useQuery({
    docType: typeFilter,
    search:  search || undefined,
  })

  const { data: summary } = trpc.documents.summary.useQuery()

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">Documents</h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            VERSIONED STORAGE · RETENTION POLICIES · APPEND-ONLY
          </p>
        </div>
        <button className="btn-gold btn-sm flex items-center gap-1.5">
          <IconUpload size={12} /> Upload
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        {[
          { label: 'Total docs',    value: summary?.total        ?? '—', cls: 'text-zn-gold'    },
          { label: 'Signed',        value: summary?.signed       ?? '—', cls: 'text-zn-success' },
          { label: 'Pending sig',   value: summary?.unsigned     ?? '—', cls: 'text-zn-warning' },
          { label: 'Expiring soon', value: summary?.expiringSoon ?? '—', cls: summary?.expiringSoon ? 'text-zn-danger' : 'text-zn-text-1' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className={cn('stat-num', s.cls)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <IconSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zn-text-3" />
          <input
            type="text"
            placeholder="Search documents or clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input pl-8 w-64"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter(undefined)}
            className={cn(
              'rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-all',
              !typeFilter
                ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
                : 'border-zn-border text-zn-text-3 hover:border-zn-border-2',
            )}
          >
            All
          </button>
          {TYPE_FILTERS.map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(typeFilter === t.key ? undefined : t.key)}
              className={cn(
                'rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-all',
                typeFilter === t.key
                  ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
                  : 'border-zn-border text-zn-text-3 hover:border-zn-border-2',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All documents</span>
          <span className="font-mono text-[10px] text-zn-text-3">
            {isLoading ? '...' : `${docs.length} files`}
          </span>
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-zn-border px-4 py-3">
              <div className="h-8 w-8 rounded border border-zn-border bg-zn-surface-3 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-48 rounded bg-zn-surface-3 animate-pulse" />
                <div className="h-2 w-32 rounded bg-zn-surface-3 animate-pulse" />
              </div>
            </div>
          ))
        ) : docs.length === 0 ? (
          <div className="px-4 py-10 text-center font-mono text-[11px] text-zn-text-3">
            {search || typeFilter ? 'No documents match your filters.' : 'No documents yet. Upload your first document.'}
          </div>
        ) : (
          docs.map((doc: any) => <DocRow key={doc.id} doc={doc} />)
        )}
      </div>
    </div>
  )
}
