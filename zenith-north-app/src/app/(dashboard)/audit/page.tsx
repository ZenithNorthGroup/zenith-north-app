'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn, formatDateTime } from '@/lib/utils'
import {
  IconPackage, IconSearch, IconDownload,
  IconShield, IconSparkles, IconLock,
  IconChevronDown, IconChevronRight,
  IconRefresh,
} from '@tabler/icons-react'

// ── Skill color map ────────────────────────────────────────

const SKILL_CONFIG: Record<string, { pill: string; dot: string }> = {
  crm:        { pill: 'pill-gold',    dot: 'bg-zn-gold'    },
  compliance: { pill: 'pill-warn',    dot: 'bg-zn-warning' },
  workflows:  { pill: 'pill-ghost',   dot: 'bg-zn-text-2'  },
  messaging:  { pill: 'pill-ghost',   dot: 'bg-zn-text-2'  },
  documents:  { pill: 'pill-success', dot: 'bg-zn-success' },
  audit:      { pill: 'pill-gold',    dot: 'bg-zn-gold'    },
  system:     { pill: 'pill-ghost',   dot: 'bg-zn-text-3'  },
}

// ── Audit row ──────────────────────────────────────────────

function AuditRow({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SKILL_CONFIG[entry.skillSlug] ?? SKILL_CONFIG.system

  return (
    <>
      <div
        className="grid cursor-pointer items-center gap-3 border-b border-zn-border px-4 py-2.5 last:border-0 transition-colors hover:bg-zn-surface-2"
        style={{ gridTemplateColumns: '150px 100px 90px 1fr 120px' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="font-mono text-[10px] text-zn-text-3 truncate">
          {formatDateTime(entry.createdAt)}
        </div>
        <div className="font-mono text-[11px] font-medium text-zn-gold truncate">
          {entry.userId ? entry.userId.slice(0, 8) : 'System'}
        </div>
        <div>
          <span className={cn('pill text-[9px]', cfg.pill)}>
            {entry.skillSlug}
          </span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-zn-text-2">{entry.action}</div>
          {entry.entityId && (
            <div className="font-mono text-[10px] text-zn-text-3 truncate">
              {entry.entityType}/{entry.entityId.slice(0, 8)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-zn-text-3 truncate">
            {entry.ipAddress ?? '—'}
          </span>
          {(entry.prevState || entry.nextState) && (
            expanded
              ? <IconChevronDown size={12} className="text-zn-text-3 flex-shrink-0" />
              : <IconChevronRight size={12} className="text-zn-text-3 flex-shrink-0" />
          )}
        </div>
      </div>

      {expanded && (entry.prevState || entry.nextState || entry.metadata) && (
        <div className="border-b border-zn-border bg-zn-surface-2 px-4 py-3">
          <div className="grid grid-cols-2 gap-4">
            {entry.prevState && (
              <div>
                <div className="field-label mb-1">Previous state</div>
                <pre className="overflow-auto rounded border border-zn-border bg-zn-black p-2 font-mono text-[10px] text-zn-text-2 max-h-32">
                  {JSON.stringify(entry.prevState, null, 2)}
                </pre>
              </div>
            )}
            {entry.nextState && (
              <div>
                <div className="field-label mb-1">Next state</div>
                <pre className="overflow-auto rounded border border-zn-border bg-zn-black p-2 font-mono text-[10px] text-zn-text-2 max-h-32">
                  {JSON.stringify(entry.nextState, null, 2)}
                </pre>
              </div>
            )}
            {entry.metadata && !entry.nextState && (
              <div className="col-span-2">
                <div className="field-label mb-1">Metadata</div>
                <pre className="overflow-auto rounded border border-zn-border bg-zn-black p-2 font-mono text-[10px] text-zn-text-2 max-h-32">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Exam package generator ─────────────────────────────────

function ExamPackagePanel() {
  const [clientId, setClientId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [result,   setResult]   = useState<any>(null)

  const generateMutation = trpc.audit.generateExamPackage.useMutation({
    onSuccess: data => setResult(data),
  })

  function handleGenerate() {
    generateMutation.mutate({
      clientId: clientId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo:   dateTo   || undefined,
    })
  }

  // Download as JSON
  function handleDownload() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `zenith-north-exam-package-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card mb-4">
      <div className="card-header">
        <span className="card-title">Generate examination package</span>
        <div className="flex items-center gap-1.5">
          <IconSparkles size={12} className="text-zn-gold" />
          <span className="font-mono text-[10px] text-zn-gold">ONE CLICK</span>
        </div>
      </div>

      <div className="p-4">
        <p className="mb-4 text-sm text-zn-text-2 leading-relaxed">
          Produce every document, communication, workflow step, and audit entry
          an SEC examiner would request — organized and ready in seconds.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="field-label">Client ID (optional)</label>
            <input
              type="text"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="Leave blank for all clients"
              className="field-input font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="field-label">Date from</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Date to</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="field-input" />
          </div>
        </div>

        {!result ? (
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className={cn('btn-gold flex items-center gap-2', generateMutation.isPending && 'cursor-not-allowed opacity-50')}
          >
            <IconPackage size={14} />
            {generateMutation.isPending ? 'Compiling package...' : 'Generate exam package'}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded border border-zn-success/30 bg-zn-success/8 px-4 py-3">
              <div className="mb-2 font-mono text-[11px] font-medium text-zn-success">
                Package ready — {result.summary.totalAuditEntries} audit entries compiled
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Audit entries',   value: result.summary.totalAuditEntries },
                  { label: 'Communications',  value: result.summary.totalCommunications },
                  { label: 'Documents',       value: result.summary.totalDocuments },
                  { label: 'Flagged comms',   value: result.summary.flaggedCommunications },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="font-mono text-lg font-medium text-zn-success">{s.value}</div>
                    <div className="font-mono text-[9px] text-zn-success/70">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDownload} className="btn-gold flex items-center gap-1.5">
                <IconDownload size={13} /> Download JSON package
              </button>
              <button onClick={() => setResult(null)} className="btn-ghost">
                Generate another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

const SKILLS = ['crm', 'compliance', 'workflows', 'messaging', 'documents', 'audit', 'system']

export default function AuditPage() {
  const [skillFilter, setSkillFilter] = useState<string | undefined>()
  const [search,      setSearch]      = useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [offset,      setOffset]      = useState(0)

  const { data: summary } = trpc.audit.summary.useQuery()

  const { data, isLoading, refetch } = trpc.audit.listEntries.useQuery({
    skillSlug: skillFilter,
    search:    search || undefined,
    dateFrom:  dateFrom || undefined,
    limit:     100,
    offset,
  })

  const entries = data?.entries ?? []
  const total   = data?.total   ?? 0

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
            Audit center
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <IconLock size={11} className="text-zn-gold" />
            <span className="font-mono text-[11px] text-zn-text-3">
              APPEND-ONLY · NEVER EDITABLE · {summary?.totalEntries?.toLocaleString() ?? '—'} TOTAL ENTRIES
            </span>
          </div>
        </div>
        <button onClick={() => refetch()} className="btn-ghost flex items-center gap-1.5">
          <IconRefresh size={13} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        {[
          { label: 'Total entries',   value: summary?.totalEntries?.toLocaleString() ?? '—', cls: 'text-zn-gold' },
          { label: 'Today',           value: summary?.entriesToday  ?? '—',                  cls: 'text-zn-text-1' },
          { label: 'Unreviewed flags',value: summary?.unreviewedFlags ?? '—',                 cls: summary?.unreviewedFlags ? 'text-zn-danger' : 'text-zn-success' },
          { label: 'Top skill',       value: summary?.bySkill?.[0]?.skill ?? '—',             cls: 'text-zn-text-1' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className={cn('stat-num', s.cls)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Exam package */}
      <ExamPackagePanel />

      {/* Immutability notice */}
      <div className="mb-4 flex items-start gap-3 rounded border border-zn-gold/20 bg-zn-gold/5 px-4 py-3">
        <IconShield size={14} className="mt-0.5 flex-shrink-0 text-zn-gold" />
        <div className="font-mono text-[11px] text-zn-text-2 leading-relaxed">
          Every entry is permanent. DELETE and UPDATE are blocked at the database level via row-level security policy.
          Even engineering cannot erase audit records. This is your examination guarantee.
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <IconSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zn-text-3" />
          <input
            type="text"
            placeholder="Search actions..."
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0) }}
            className="field-input pl-8 w-52"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setOffset(0) }}
          className="field-input w-36"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setSkillFilter(undefined); setOffset(0) }}
            className={cn(
              'rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-all',
              !skillFilter
                ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
                : 'border-zn-border text-zn-text-3 hover:border-zn-border-2',
            )}
          >
            All
          </button>
          {SKILLS.map(skill => {
            const count = summary?.bySkill?.find(s => s.skill === skill)?.count
            return (
              <button
                key={skill}
                onClick={() => { setSkillFilter(skillFilter === skill ? undefined : skill); setOffset(0) }}
                className={cn(
                  'rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-all',
                  skillFilter === skill
                    ? 'border-zn-gold/30 bg-zn-gold/10 text-zn-gold'
                    : 'border-zn-border text-zn-text-3 hover:border-zn-border-2',
                )}
              >
                {skill}{count ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Log table */}
      <div className="card overflow-hidden">
        <div
          className="grid border-b border-zn-border bg-zn-surface-2 px-4 py-2"
          style={{ gridTemplateColumns: '150px 100px 90px 1fr 120px' }}
        >
          {['Timestamp', 'User', 'Skill', 'Action', 'IP Address'].map(h => (
            <div key={h} className="font-mono text-[9px] font-medium uppercase tracking-wider text-zn-text-3">
              {h}
            </div>
          ))}
        </div>

        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid gap-3 border-b border-zn-border px-4 py-2.5" style={{ gridTemplateColumns: '150px 100px 90px 1fr 120px' }}>
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-2.5 rounded bg-zn-surface-3 animate-pulse" />
              ))}
            </div>
          ))
        ) : entries.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="font-mono text-[11px] text-zn-text-3">
              {search || skillFilter ? 'No entries match your filters.' : 'No audit entries yet. Every action you take in Zenith North will appear here.'}
            </div>
          </div>
        ) : (
          entries.map(entry => <AuditRow key={entry.id} entry={entry} />)
        )}

        {/* Pagination */}
        {total > 100 && (
          <div className="flex items-center justify-between border-t border-zn-border px-4 py-3">
            <div className="font-mono text-[11px] text-zn-text-3">
              Showing {offset + 1}–{Math.min(offset + 100, total)} of {total.toLocaleString()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - 100))}
                disabled={offset === 0}
                className="btn-ghost btn-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + 100)}
                disabled={offset + 100 >= total}
                className="btn-ghost btn-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
