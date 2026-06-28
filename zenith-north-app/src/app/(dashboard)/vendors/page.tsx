'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, cn } from '@/lib/utils'
import {
  IconPlus, IconCheck, IconX, IconLoader2,
  IconBuilding, IconChevronRight, IconAlertTriangle,
} from '@tabler/icons-react'

const VENDOR_TYPES = [
  { value: 'custodian',   label: 'Custodian' },
  { value: 'technology',  label: 'Technology' },
  { value: 'compliance',  label: 'Compliance' },
  { value: 'legal',       label: 'Legal' },
  { value: 'accounting',  label: 'Accounting' },
  { value: 'other',       label: 'Other' },
]

const DD_CONFIG: Record<string, { pill: string; label: string }> = {
  pending:    { pill: 'pill-ghost',   label: 'Pending' },
  in_review:  { pill: 'pill-warn',    label: 'In review' },
  approved:   { pill: 'pill-success', label: 'Approved' },
  rejected:   { pill: 'pill-danger',  label: 'Rejected' },
  expired:    { pill: 'pill-danger',  label: 'Expired' },
}

const RISK_CONFIG: Record<string, { color: string }> = {
  low:    { color: 'var(--zn-success)' },
  medium: { color: 'var(--zn-warning)' },
  high:   { color: 'var(--zn-danger)' },
}

function NewVendorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', vendorType: 'technology', website: '',
    contactName: '', contactEmail: '', riskLevel: 'medium',
    contractStart: '', contractEnd: '', notes: '',
  })
  const createMutation = trpc.vendors.create.useMutation({
    onSuccess: () => { onCreated(); onClose() }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-xl border border-zn-border bg-white shadow-xl">
        <div className="card-header flex items-center justify-between">
          <span className="text-[14px] font-semibold text-zn-text-1">Add vendor</span>
          <button onClick={onClose}><IconX size={16} className="text-zn-text-3" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Vendor name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Schwab Advisor Services" className="field-input" />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select value={form.vendorType} onChange={e => setForm(f => ({ ...f, vendorType: e.target.value }))} className="field-select">
                {VENDOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Website</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." className="field-input" />
            </div>
            <div>
              <label className="field-label">Risk level</label>
              <select value={form.riskLevel} onChange={e => setForm(f => ({ ...f, riskLevel: e.target.value }))} className="field-select">
                {['low','medium','high'].map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Contact name</label>
              <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">Contact email</label>
              <input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">Contract start</label>
              <input type="date" value={form.contractStart} onChange={e => setForm(f => ({ ...f, contractStart: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">Contract end</label>
              <input type="date" value={form.contractEnd} onChange={e => setForm(f => ({ ...f, contractEnd: e.target.value }))} className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="field-input resize-none" />
          </div>
        </div>
        <div className="border-t border-zn-border px-5 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => createMutation.mutate(form as any)}
            disabled={!form.name || createMutation.isPending}
            className="btn-gold flex items-center gap-1.5"
          >
            {createMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />}
            Add vendor
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VendorsPage() {
  const [showNew,   setShowNew]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm,  setEditForm]  = useState<Record<string, string>>({})

  const { data: vendors = [], isLoading, refetch } = trpc.vendors.list.useQuery({})
  const { data: summary } = trpc.vendors.summary.useQuery()
  const updateMutation = trpc.vendors.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null) } })
  const archiveMutation = trpc.vendors.archive.useMutation({ onSuccess: () => refetch() })

  return (
    <div className="animate-fade-in">
      {showNew && <NewVendorModal onClose={() => setShowNew(false)} onCreated={refetch} />}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Total vendors',    value: summary?.total         ?? '—', accent: 'var(--zn-gold-dark)' },
          { label: 'DD approved',      value: summary?.approved      ?? '—', accent: 'var(--zn-success)' },
          { label: 'Pending review',   value: summary?.pendingReview ?? '—', accent: 'var(--zn-warning)' },
          { label: 'Contracts expiring (90d)', value: summary?.expiringSoon ?? '—', accent: 'var(--zn-danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-num" style={{ color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] text-zn-text-3">{(vendors as any[]).length} vendors · due diligence tracking</p>
        <button onClick={() => setShowNew(true)} className="btn-gold btn-sm flex items-center gap-1.5">
          <IconPlus size={13} /> Add vendor
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 border-b border-zn-border bg-zn-surface-2 px-5 py-2.5">
          {['Vendor', 'Type', 'Due diligence', 'Contract', 'Actions'].map(h => (
            <div key={h} className="text-[10px] font-semibold uppercase tracking-[0.07em] text-zn-text-3">{h}</div>
          ))}
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 items-center border-b border-zn-border px-5 py-4 last:border-0">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-3 rounded bg-zn-surface-3 animate-pulse" />
              ))}
            </div>
          ))
        ) : (vendors as any[]).length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <IconBuilding size={24} className="text-zn-text-3" />
            <div className="text-[13px] font-medium text-zn-text-1">No vendors yet</div>
            <div className="text-[12px] text-zn-text-3">Add your custodians, tech providers, and other third parties.</div>
          </div>
        ) : (
          (vendors as any[]).map((vendor: any) => {
            const ddCfg   = DD_CONFIG[vendor.dd_status]   ?? DD_CONFIG.pending
            const riskCfg = RISK_CONFIG[vendor.risk_level ?? 'medium']
            const isEditing = editingId === vendor.id
            const typeLabel = VENDOR_TYPES.find(t => t.value === vendor.vendor_type)?.label ?? vendor.vendor_type
            const contractExpiring = vendor.days_until_contract_end !== null && vendor.days_until_contract_end < 90 && vendor.days_until_contract_end > 0

            return (
              <div key={vendor.id} className="border-b border-zn-border last:border-0">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 items-center px-5 py-4 hover:bg-zn-surface-2 transition-colors">
                  {/* Name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-zn-text-1 truncate">{vendor.name}</span>
                      <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: riskCfg.color }} title={`${vendor.risk_level} risk`} />
                    </div>
                    {vendor.contact_name && (
                      <div className="text-[11px] text-zn-text-3">{vendor.contact_name}</div>
                    )}
                  </div>

                  {/* Type */}
                  <div className="text-[12px] text-zn-text-2">{typeLabel}</div>

                  {/* DD Status */}
                  <div className="flex flex-col gap-1">
                    <span className={cn('pill text-[10px]', ddCfg.pill)}>{ddCfg.label}</span>
                    {vendor.dd_next_review_at && (
                      <span className="text-[10px] text-zn-text-3">
                        Review {formatDate(vendor.dd_next_review_at)}
                      </span>
                    )}
                  </div>

                  {/* Contract */}
                  <div className="text-[12px]">
                    {vendor.contract_end ? (
                      <div>
                        <div className={contractExpiring ? 'text-zn-warning font-medium' : 'text-zn-text-2'}>
                          {formatDate(vendor.contract_end)}
                        </div>
                        {contractExpiring && (
                          <div className="text-[10px] text-zn-warning flex items-center gap-1">
                            <IconAlertTriangle size={9} /> {Math.round(vendor.days_until_contract_end)}d left
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-zn-text-3">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    {vendor.dd_status !== 'approved' && (
                      <button
                        onClick={() => updateMutation.mutate({ id: vendor.id, ddStatus: 'approved' })}
                        className="btn-ghost btn-sm text-[11px] flex items-center gap-1"
                        style={{ color: 'var(--zn-success)', borderColor: 'var(--zn-success-border)' }}
                      >
                        <IconCheck size={10} /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm(`Archive ${vendor.name}?`)) archiveMutation.mutate({ id: vendor.id }) }}
                      className="btn-ghost btn-sm text-[11px]"
                    >
                      <IconX size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
