'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, cn } from '@/lib/utils'
import {
  IconPlus, IconCheck, IconX, IconClock, IconLoader2,
  IconAlertTriangle, IconChevronRight,
} from '@tabler/icons-react'

const SEVERITY_CONFIG = {
  critical: { pill: 'pill-danger',  label: 'Critical', color: 'var(--zn-danger)' },
  high:     { pill: 'pill-danger',  label: 'High',     color: 'var(--zn-danger)' },
  medium:   { pill: 'pill-warn',    label: 'Medium',   color: 'var(--zn-warning)' },
  low:      { pill: 'pill-ghost',   label: 'Low',      color: 'var(--zn-text-3)' },
} as const

const TYPE_LABELS: Record<string, string> = {
  complaint:          'Client complaint',
  regulatory_inquiry: 'Regulatory inquiry',
  data_breach:        'Data breach',
  trading_error:      'Trading error',
  other:              'Other',
}

function NewIncidentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    incidentType: 'complaint', severity: 'medium', title: '', description: '', regulatoryRef: '',
  })
  const createMutation = trpc.incidents.create.useMutation({
    onSuccess: () => { onCreated(); onClose() }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-xl border border-zn-border bg-white shadow-xl">
        <div className="card-header flex items-center justify-between">
          <span className="text-[14px] font-semibold text-zn-text-1">Log incident / complaint</span>
          <button onClick={onClose}><IconX size={16} className="text-zn-text-3" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Type</label>
              <select value={form.incidentType} onChange={e => setForm(f => ({ ...f, incidentType: e.target.value }))} className="field-select">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="field-select">
                {['low','medium','high','critical'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief description of the incident" className="field-input" />
          </div>
          <div>
            <label className="field-label">Full description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed account of what happened, when, and who was involved..." rows={5} className="field-input resize-none" />
          </div>
          <div>
            <label className="field-label">Regulatory reference (optional)</label>
            <input value={form.regulatoryRef} onChange={e => setForm(f => ({ ...f, regulatoryRef: e.target.value }))} placeholder="SEC case number, FINRA tracking #..." className="field-input" />
          </div>
        </div>
        <div className="border-t border-zn-border px-5 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => createMutation.mutate(form as any)}
            disabled={!form.title || !form.description || createMutation.isPending}
            className="btn-gold flex items-center gap-1.5"
          >
            {createMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />}
            Log incident
          </button>
        </div>
      </div>
    </div>
  )
}

function IncidentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: incident, isLoading, refetch } = trpc.incidents.get.useQuery({ id })
  const respondMutation = trpc.incidents.markResponded.useMutation({ onSuccess: () => refetch() })
  const resolveMutation = trpc.incidents.resolve.useMutation({ onSuccess: () => refetch() })
  const timelineMutation = trpc.incidents.addTimelineEntry.useMutation({ onSuccess: () => refetch() })

  const [resolution, setResolution] = useState('')
  const [timelineNote, setTimelineNote] = useState('')

  if (isLoading || !incident) return null

  const sevConfig = SEVERITY_CONFIG[(incident as any).severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.medium
  const hoursLeft = Number((incident as any).hours_until_deadline)
  const deadlinePassed = hoursLeft < 0 && !(incident as any).responded_at

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="h-full w-full max-w-xl border-l border-zn-border bg-white overflow-y-auto">
        <div className="card-header flex items-center justify-between sticky top-0 z-10 bg-white">
          <span className="text-[14px] font-semibold text-zn-text-1 truncate">{(incident as any).title}</span>
          <button onClick={onClose}><IconX size={16} className="text-zn-text-3" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <span className={cn('pill', sevConfig.pill)}>{sevConfig.label}</span>
            <span className="pill-ghost pill">{TYPE_LABELS[(incident as any).incident_type] ?? (incident as any).incident_type}</span>
            {(incident as any).resolved_at ? (
              <span className="pill-success pill">Resolved</span>
            ) : deadlinePassed ? (
              <span className="pill-danger pill flex items-center gap-1"><IconAlertTriangle size={10} /> Response overdue</span>
            ) : (incident as any).responded_at ? (
              <span className="pill-gold pill">Responded</span>
            ) : (
              <span className="pill-warn pill flex items-center gap-1">
                <IconClock size={10} /> {Math.abs(hoursLeft)}h to respond
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="field-label mb-2">Description</div>
            <div className="text-[13px] text-zn-text-1 leading-relaxed whitespace-pre-wrap bg-zn-surface-2 rounded-lg p-3">
              {(incident as any).description}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div><span className="text-zn-text-3">Reported by:</span> <span className="text-zn-text-1 font-medium">{(incident as any).reported_by_name ?? '—'}</span></div>
            <div><span className="text-zn-text-3">Assigned to:</span> <span className="text-zn-text-1 font-medium">{(incident as any).assigned_to_name ?? 'Unassigned'}</span></div>
            <div><span className="text-zn-text-3">Client:</span> <span className="text-zn-text-1 font-medium">{(incident as any).client_name || '—'}</span></div>
            <div><span className="text-zn-text-3">Response deadline:</span> <span className="text-zn-text-1 font-medium">{(incident as any).response_deadline ? formatDate((incident as any).response_deadline) : '—'}</span></div>
            {(incident as any).regulatory_ref && (
              <div className="col-span-2"><span className="text-zn-text-3">Regulatory ref:</span> <span className="text-zn-text-1 font-mono text-[11px]">{(incident as any).regulatory_ref}</span></div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <div className="field-label mb-2">Timeline</div>
            <div className="space-y-2">
              {((incident as any).timeline as any[] ?? []).map((entry: any, i: number) => (
                <div key={i} className="flex gap-3 text-[12px]">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-zn-border-2" />
                  <div>
                    <span className="font-medium text-zn-text-1">{entry.action}</span>
                    {entry.notes && <span className="text-zn-text-3"> — {entry.notes}</span>}
                    <div className="text-zn-text-3 text-[11px]">{entry.by} · {formatDate(entry.at)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add timeline entry */}
            {!(incident as any).resolved_at && (
              <div className="mt-3 flex gap-2">
                <input value={timelineNote} onChange={e => setTimelineNote(e.target.value)} placeholder="Add timeline entry..." className="field-input flex-1 text-[12px]" />
                <button
                  onClick={() => { timelineMutation.mutate({ id, action: timelineNote }); setTimelineNote('') }}
                  disabled={!timelineNote || timelineMutation.isPending}
                  className="btn-ghost btn-sm"
                >Add</button>
              </div>
            )}
          </div>

          {/* Actions */}
          {!(incident as any).resolved_at && (
            <div className="space-y-3">
              {!(incident as any).responded_at && (
                <button
                  onClick={() => respondMutation.mutate({ id })}
                  disabled={respondMutation.isPending}
                  className="btn-gold w-full flex items-center justify-center gap-2"
                >
                  {respondMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
                  Mark initial response sent
                </button>
              )}
              <div>
                <label className="field-label">Resolution notes</label>
                <textarea value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Describe how the incident was resolved..." rows={3} className="field-input resize-none mb-2" />
                <button
                  onClick={() => resolveMutation.mutate({ id, resolution })}
                  disabled={!resolution || resolveMutation.isPending}
                  className="btn-gold w-full flex items-center justify-center gap-2"
                  style={{ background: 'var(--zn-success)' }}
                >
                  {resolveMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
                  Mark resolved
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function IncidentsPage() {
  const [status,     setStatus]     = useState<'open' | 'resolved' | 'all'>('open')
  const [showNew,    setShowNew]    = useState(false)
  const [detailId,   setDetailId]   = useState<string | null>(null)

  const { data: incidents = [], isLoading, refetch } = trpc.incidents.list.useQuery({ status })
  const { data: summary } = trpc.incidents.summary.useQuery()

  return (
    <div className="animate-fade-in">
      {showNew    && <NewIncidentModal onClose={() => setShowNew(false)} onCreated={refetch} />}
      {detailId   && <IncidentDetail id={detailId} onClose={() => setDetailId(null)} />}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Open incidents',   value: summary?.open         ?? '—', accent: 'var(--zn-gold-dark)' },
          { label: 'High priority',    value: summary?.highPriority ?? '—', accent: 'var(--zn-danger)' },
          { label: 'Response overdue', value: summary?.overdue      ?? '—', accent: 'var(--zn-danger)' },
          { label: 'Resolved (30d)',   value: summary?.resolved30d  ?? '—', accent: 'var(--zn-success)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-num" style={{ color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['open','resolved','all'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[12px] font-medium capitalize transition-all',
                status === s
                  ? 'border-[var(--zn-gold)] bg-[var(--zn-gold-bg)] text-[var(--zn-gold-dark)]'
                  : 'border-zn-border bg-white text-zn-text-2 hover:border-zn-border-2',
              )}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)} className="btn-gold btn-sm flex items-center gap-1.5">
          <IconPlus size={13} /> Log incident
        </button>
      </div>

      {/* List */}
      <div className="card">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0">
              <div className="h-2 w-2 rounded-full bg-zn-surface-3 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-52 rounded bg-zn-surface-3 animate-pulse" />
                <div className="h-2.5 w-36 rounded bg-zn-surface-3 animate-pulse" />
              </div>
            </div>
          ))
        ) : (incidents as any[]).length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <IconCheck size={24} style={{ color: 'var(--zn-success)' }} />
            <div className="text-[13px] font-medium text-zn-text-1">No {status} incidents</div>
          </div>
        ) : (
          (incidents as any[]).map((inc: any) => {
            const sevConfig = SEVERITY_CONFIG[inc.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.medium
            const hoursLeft = Number(inc.hours_until_deadline)
            const overdue = hoursLeft < 0 && !inc.responded_at && !inc.resolved_at

            return (
              <div key={inc.id}
                className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0 hover:bg-zn-surface-2 transition-colors cursor-pointer"
                onClick={() => setDetailId(inc.id)}
              >
                <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: sevConfig.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zn-text-1 truncate">{inc.title}</div>
                  <div className="mt-0.5 text-[11px] text-zn-text-3">
                    {TYPE_LABELS[inc.incident_type] ?? inc.incident_type}
                    {inc.client_name ? ` · ${inc.client_name}` : ''}
                    {' · '}{formatDate(inc.created_at)}
                  </div>
                </div>
                <span className={cn('pill', sevConfig.pill)}>{sevConfig.label}</span>
                {overdue && <span className="pill-danger pill text-[10px]">Response overdue</span>}
                {inc.resolved_at ? (
                  <span className="pill-success pill text-[10px]">Resolved</span>
                ) : !inc.responded_at && !overdue ? (
                  <span className="pill-warn pill text-[10px]">
                    <IconClock size={9} className="inline mr-0.5" />{Math.abs(hoursLeft)}h left
                  </span>
                ) : null}
                <IconChevronRight size={14} className="text-zn-text-3 flex-shrink-0" />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
