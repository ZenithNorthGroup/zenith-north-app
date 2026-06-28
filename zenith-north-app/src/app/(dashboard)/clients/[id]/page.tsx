'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, cn } from '@/lib/utils'
import {
  IconArrowLeft, IconEdit, IconCheck, IconX, IconUser,
  IconMail, IconPhone, IconShield, IconMessage,
  IconFileText, IconGitBranch, IconListCheck, IconLoader2,
} from '@tabler/icons-react'

const TABS = [
  { id: 'overview',   label: 'Overview',      icon: IconUser },
  { id: 'compliance', label: 'Compliance',     icon: IconShield },
  { id: 'messages',   label: 'Communications', icon: IconMessage },
  { id: 'documents',  label: 'Documents',      icon: IconFileText },
  { id: 'workflows',  label: 'Workflows',      icon: IconGitBranch },
  { id: 'tasks',      label: 'Tasks',          icon: IconListCheck },
] as const
type Tab = typeof TABS[number]['id']

const STATUS_CONFIG: Record<string, { pill: string; label: string }> = {
  active:   { pill: 'pill-success', label: 'Active' },
  prospect: { pill: 'pill-gold',    label: 'Prospect' },
  inactive: { pill: 'pill-ghost',   label: 'Inactive' },
}

const KYC_CONFIG: Record<string, { pill: string; label: string }> = {
  verified:     { pill: 'pill-success', label: 'Verified' },
  needs_review: { pill: 'pill-warn',    label: 'Needs review' },
  pending:      { pill: 'pill-ghost',   label: 'Pending' },
  flagged:      { pill: 'pill-danger',  label: 'Flagged' },
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const { data, isLoading, error, refetch } = trpc.clients.get360.useQuery({ id })
  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => { refetch(); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 3000) }
  })
  const { data: me } = trpc.me.getMe.useQuery()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <IconLoader2 size={24} className="animate-spin text-zn-text-3" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card px-6 py-10 text-center">
        <div className="text-[14px] font-medium text-zn-text-1 mb-2">Client not found</div>
        <Link href="/clients" className="btn-ghost btn-sm">← Back to clients</Link>
      </div>
    )
  }

  const client     = data.client as any
  const clientData = client?.data as any ?? {}
  const fullName   = `${clientData.firstName ?? ''} ${clientData.lastName ?? ''}`.trim()
  const initials   = `${(clientData.firstName ?? '')[0] ?? ''}${(clientData.lastName ?? '')[0] ?? ''}`.toUpperCase()
  const status     = STATUS_CONFIG[clientData.status] ?? STATUS_CONFIG.active
  const kyc        = KYC_CONFIG[clientData.kycStatus] ?? KYC_CONFIG.pending

  const communications = (data.communications as any[]) ?? []
  const documents      = (data.documents as any[]) ?? []
  const runs           = (data.workflowRuns as any[]) ?? []
  const auditEntries   = (data.auditEntries as any[]) ?? []
  const complianceItems = (data.complianceItems as any[]) ?? []

  function startEdit() {
    setForm({
      firstName:       clientData.firstName ?? '',
      lastName:        clientData.lastName  ?? '',
      email:           clientData.email     ?? '',
      phone:           clientData.phone     ?? '',
      status:          clientData.status    ?? 'active',
      kycStatus:       clientData.kycStatus ?? 'pending',
      clientType:      clientData.clientType ?? 'individual',
      annualReviewDue: clientData.annualReviewDue ?? '',
    })
    setEditing(true)
  }

  function saveEdit() {
    updateMutation.mutate({ id, data: { ...clientData, ...form } })
  }

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-zn-text-3 hover:text-zn-text-1 transition-colors">
        <IconArrowLeft size={13} /> Back to clients
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-semibold"
          style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold-dark)' }}>
          {initials || <IconUser size={20} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[20px] font-semibold tracking-tight text-zn-text-1">{fullName}</h1>
            <span className={cn('pill', status.pill)}>{status.label}</span>
            <span className={cn('pill', kyc.pill)}>{kyc.label}</span>
            {saved && <span className="flex items-center gap-1 text-[12px] text-zn-success"><IconCheck size={12} /> Saved</span>}
          </div>
          <div className="mt-1 flex items-center gap-4 text-[12px] text-zn-text-3">
            {clientData.email && <span className="flex items-center gap-1"><IconMail size={11} />{clientData.email}</span>}
            {clientData.phone && <span className="flex items-center gap-1"><IconPhone size={11} />{clientData.phone}</span>}
            <span className="capitalize">{clientData.clientType ?? 'individual'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={saveEdit} disabled={updateMutation.isPending} className="btn-gold btn-sm flex items-center gap-1.5">
                {updateMutation.isPending ? <IconLoader2 size={12} className="animate-spin" /> : <IconCheck size={12} />} Save
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost btn-sm"><IconX size={12} /></button>
            </>
          ) : (
            <button onClick={startEdit} className="btn-ghost btn-sm flex items-center gap-1.5">
              <IconEdit size={12} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-zn-border">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-all -mb-px',
                tab === t.id
                  ? 'border-[var(--zn-gold)] text-[var(--zn-gold-dark)]'
                  : 'border-transparent text-zn-text-3 hover:text-zn-text-2',
              )}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Client information</span></div>
            {[
              { label: 'First name',        key: 'firstName',       value: clientData.firstName ?? '' },
              { label: 'Last name',         key: 'lastName',        value: clientData.lastName  ?? '' },
              { label: 'Email',             key: 'email',           value: clientData.email     ?? '' },
              { label: 'Phone',             key: 'phone',           value: clientData.phone     ?? '' },
              { label: 'Client type',       key: 'clientType',      value: clientData.clientType ?? 'individual', type: 'select', options: ['individual','trust','entity','foundation'] },
              { label: 'Status',            key: 'status',          value: clientData.status    ?? 'active', type: 'select', options: ['active','prospect','inactive'] },
              { label: 'KYC status',        key: 'kycStatus',       value: clientData.kycStatus ?? 'pending', type: 'select', options: ['verified','needs_review','pending','flagged'] },
              { label: 'Annual review due', key: 'annualReviewDue', value: clientData.annualReviewDue ? formatDate(clientData.annualReviewDue) : '' },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-3 border-b border-zn-border px-5 py-3 last:border-0">
                <div className="w-40 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zn-text-3">{f.label}</div>
                {editing ? (
                  (f as any).type === 'select' ? (
                    <select value={form[f.key] ?? f.value} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="field-select flex-1 text-[13px]">
                      {(f as any).options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={form[f.key] ?? f.value} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="field-input flex-1 text-[13px]" />
                  )
                ) : (
                  <div className="flex-1 text-[13px] text-zn-text-1">{f.value || <span className="text-zn-text-3 italic">Not set</span>}</div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {/* Quick stats */}
            <div className="card">
              <div className="card-header"><span className="card-title">Activity</span></div>
              {[
                { label: 'Total messages',     value: communications.length },
                { label: 'Documents on file',  value: documents.length },
                { label: 'Workflow runs',      value: runs.length },
                { label: 'Audit entries',      value: auditEntries.length },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between border-b border-zn-border px-5 py-3 last:border-0">
                  <span className="text-[13px] text-zn-text-2">{s.label}</span>
                  <span className="text-[15px] font-semibold" style={{ color: 'var(--zn-gold-dark)' }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Compliance items for this client */}
            {complianceItems.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">Open compliance items</span></div>
                {complianceItems.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3 border-b border-zn-border px-5 py-3 last:border-0">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: item.severity === 'critical' ? 'var(--zn-danger)' : 'var(--zn-warning)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-zn-text-1 truncate">{item.title}</div>
                      {item.due_date && <div className="text-[11px] text-zn-text-3 mt-0.5">Due {formatDate(item.due_date)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Communications tab */}
      {tab === 'messages' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Communications ({communications.length})</span>
            <Link href="/messages" className="card-action">Open in messages →</Link>
          </div>
          {communications.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-zn-text-3">No communications yet</div>
          ) : (
            communications.map((c: any) => (
              <div key={c.id} className="flex items-start gap-3 border-b border-zn-border px-5 py-3.5 last:border-0">
                <div className={cn('mt-0.5 h-2 w-2 flex-shrink-0 rounded-full', c.ai_flagged ? 'bg-zn-danger' : 'bg-zn-border-2')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-zn-text-3">{c.channel}</span>
                    <span className="text-[11px] text-zn-text-3">{c.direction === 'outbound' ? `${me?.fullName ?? 'You'} →` : '← Client'}</span>
                    {c.ai_flagged && <span className="pill-danger pill text-[10px]">AI flagged</span>}
                  </div>
                  <div className="text-[13px] text-zn-text-1 line-clamp-2">{c.body}</div>
                  <div className="text-[11px] text-zn-text-3 mt-1">{formatDate(c.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Documents ({documents.length})</span>
            <Link href="/documents" className="card-action">View all →</Link>
          </div>
          {documents.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-zn-text-3">No documents on file</div>
          ) : (
            documents.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 border-b border-zn-border px-5 py-3.5 last:border-0">
                <IconFileText size={16} className="text-zn-text-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zn-text-1 truncate">{d.name}</div>
                  <div className="text-[11px] text-zn-text-3 mt-0.5">{d.doc_type} · {formatDate(d.created_at)}</div>
                </div>
                {d.signed_at ? (
                  <span className="pill-success pill text-[10px]">Signed</span>
                ) : (
                  <span className="pill-warn pill text-[10px]">Unsigned</span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Workflows tab */}
      {tab === 'workflows' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Onboarding workflows ({runs.length})</span>
            <Link href="/workflows" className="card-action">View all →</Link>
          </div>
          {runs.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-zn-text-3">No workflows for this client</div>
          ) : (
            runs.map((run: any) => (
              <Link key={run.id} href={`/workflows/${run.id}/approve`}
                className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0 hover:bg-zn-surface-2 transition-colors">
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-zn-text-1 capitalize">{run.status?.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-zn-text-3 mt-0.5">Started {formatDate(run.started_at)}</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-zn-surface-3">
                    <div className="h-full rounded-full" style={{ width: `${run.progressPct ?? 0}%`, background: 'var(--zn-gold)' }} />
                  </div>
                </div>
                <span className="text-[12px] font-mono text-zn-text-3 flex-shrink-0">{run.progressPct ?? 0}%</span>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Compliance tab */}
      {tab === 'compliance' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Compliance items</span></div>
          {complianceItems.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6">
              <IconCheck size={18} style={{ color: 'var(--zn-success)' }} />
              <div className="text-[13px] text-zn-text-1">No open compliance items for this client</div>
            </div>
          ) : (
            complianceItems.map((item: any) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-zn-border px-5 py-4 last:border-0">
                <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: item.severity === 'critical' ? 'var(--zn-danger)' : 'var(--zn-warning)' }} />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-zn-text-1">{item.title}</div>
                  {item.description && <div className="text-[12px] text-zn-text-3 mt-0.5">{item.description}</div>}
                  {item.due_date && <div className="text-[11px] text-zn-text-3 mt-1 flex items-center gap-1"><IconListCheck size={10} /> Due {formatDate(item.due_date)}</div>}
                </div>
                <span className={item.severity === 'critical' ? 'pill-danger pill' : 'pill-warn pill'}>{item.severity}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Tasks</span></div>
          <div className="px-5 py-8 text-center text-[13px] text-zn-text-3">
            <Link href="/tasks" className="card-action">View all tasks →</Link>
          </div>
        </div>
      )}
    </div>
  )
}
