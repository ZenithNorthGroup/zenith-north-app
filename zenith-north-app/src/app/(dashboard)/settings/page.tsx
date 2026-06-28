'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import {
  IconBuilding, IconUsers, IconPlug, IconShield, IconBell,
  IconCheck, IconEdit, IconX, IconMail, IconPlus, IconTrash,
  IconLoader2,
} from '@tabler/icons-react'

const TABS = [
  { id: 'firm',          label: 'Firm',          icon: IconBuilding },
  { id: 'team',          label: 'Team',           icon: IconUsers },
  { id: 'channels',      label: 'Channels',       icon: IconPlug },
  { id: 'compliance',    label: 'Compliance',     icon: IconShield },
  { id: 'notifications', label: 'Notifications',  icon: IconBell },
] as const
type Tab = typeof TABS[number]['id']

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  owner:      { label: 'Owner / Principal', color: '#C9A96E' },
  cco:        { label: 'CCO',               color: '#DC2626' },
  advisor:    { label: 'Advisor',            color: '#059669' },
  operations: { label: 'Operations',         color: '#3B82F6' },
  associate:  { label: 'Associate',          color: '#6B7280' },
}

// ── Firm tab ───────────────────────────────────────────────

function FirmTab() {
  const { data: config, isLoading, refetch } = trpc.settings.getFirmConfig.useQuery()
  const updateMutation = trpc.settings.updateFirmConfig.useMutation({
    onSuccess: () => { refetch(); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 3000) }
  })

  const [editing, setEditing] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [form,    setForm]    = useState<Record<string, string>>({})

  function startEdit() {
    setForm({
      name:        config?.name        ?? '',
      crd:         config?.crd         ?? '',
      ccoName:     config?.ccoName     ?? '',
      ccoTitle:    config?.ccoTitle    ?? '',
      ccoEmail:    config?.ccoEmail    ?? '',
      firmAddress: config?.firmAddress ?? '',
      aum:         config?.aum         ?? '',
    })
    setEditing(true)
  }

  function save() {
    updateMutation.mutate(form as any)
  }

  const fields = [
    { key: 'name',        label: 'Firm legal name',   value: config?.name        ?? '' },
    { key: 'crd',         label: 'SEC CRD number',    value: config?.crd         ?? '' },
    { key: 'firmAddress', label: 'Business address',  value: config?.firmAddress ?? '' },
    { key: 'aum',         label: 'AUM range',         value: config?.aum         ?? '' },
    { key: 'ccoName',     label: 'CCO name',          value: config?.ccoName     ?? '' },
    { key: 'ccoTitle',    label: 'CCO title',         value: config?.ccoTitle    ?? '' },
    { key: 'ccoEmail',    label: 'CCO email',         value: config?.ccoEmail    ?? '' },
  ]

  if (isLoading) return <div className="card p-8 text-center text-[12px] text-zn-text-3">Loading firm settings...</div>

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Firm information</span>
          {saved ? (
            <span className="flex items-center gap-1 text-[12px] text-zn-success"><IconCheck size={12} /> Saved</span>
          ) : editing ? (
            <div className="flex gap-2">
              <button onClick={save} disabled={updateMutation.isPending} className="btn-gold btn-sm flex items-center gap-1.5">
                {updateMutation.isPending ? <IconLoader2 size={12} className="animate-spin" /> : <IconCheck size={12} />}
                Save
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost btn-sm"><IconX size={12} /></button>
            </div>
          ) : (
            <button onClick={startEdit} className="btn-ghost btn-sm flex items-center gap-1.5">
              <IconEdit size={12} /> Edit
            </button>
          )}
        </div>

        {fields.map(f => (
          <div key={f.key} className="flex items-center gap-4 border-b border-zn-border px-5 py-3.5 last:border-0">
            <div className="w-44 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zn-text-3">
              {f.label}
            </div>
            {editing ? (
              <input
                value={form[f.key] ?? f.value}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="field-input flex-1 text-[13px]"
              />
            ) : (
              <div className="flex-1 text-[13px] text-zn-text-1">
                {f.value || <span className="text-zn-text-3 italic">Not set</span>}
              </div>
            )}
          </div>
        ))}

        {/* Journal email — read only */}
        <div className="flex items-center gap-4 border-b border-zn-border px-5 py-3.5 last:border-0">
          <div className="w-44 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zn-text-3">
            Email journal address
          </div>
          <div className="flex-1 font-mono text-[12px] text-zn-text-2">
            ingest-{config?.slug}@mail.zenith-north.com
          </div>
          <span className="pill-ghost pill text-[10px]">Read only</span>
        </div>
      </div>

      {/* Regulatory */}
      <div className="card">
        <div className="card-header"><span className="card-title">Regulatory status</span></div>
        {[
          { label: 'DEO Undertaking',           value: config?.deoSignedAt ? `Signed ${new Date(config.deoSignedAt).toLocaleDateString()}` : 'Not signed', ok: !!config?.deoSignedAt },
          { label: 'WSP (Written Supervisory Procedures)', value: config?.wspSignedAt ? `Signed ${new Date(config.wspSignedAt).toLocaleDateString()}` : 'Not signed', ok: !!config?.wspSignedAt },
          { label: 'Plan',                       value: config?.plan ?? '—', ok: true },
          { label: 'Account status',             value: config?.status ?? '—', ok: config?.status === 'active' },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-4 border-b border-zn-border px-5 py-3.5 last:border-0">
            <div className="flex-1 text-[13px] text-zn-text-1">{r.label}</div>
            <div className="text-[12px] text-zn-text-3">{r.value}</div>
            <span className={r.ok ? 'pill-success pill' : 'pill-warn pill'}>
              {r.ok ? 'OK' : 'Action needed'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Team tab ───────────────────────────────────────────────

function TeamTab() {
  const { data: team = [], isLoading, refetch } = trpc.users.list.useQuery()
  const { data: me } = trpc.me.getMe.useQuery()

  const inviteMutation = trpc.users.invite.useMutation({ onSuccess: () => { refetch(); setShowInvite(false); setInviteForm({ email: '', fullName: '', role: 'advisor', title: '', isCco: false, clientScope: 'all' }) } })
  const updateMutation = trpc.users.update.useMutation({ onSuccess: () => refetch() })
  const removeMutation = trpc.users.remove.useMutation({ onSuccess: () => refetch() })

  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '', fullName: '', role: 'advisor' as const,
    title: '', isCco: false, clientScope: 'all' as const,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm,  setEditForm]  = useState<Record<string, any>>({})

  function startEditMember(member: any) {
    setEditingId(member.id)
    setEditForm({ role: member.role, title: member.title ?? '', isCco: member.is_cco, clientScope: member.client_scope })
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ userId: id, ...editForm })
    setEditingId(null)
  }

  if (isLoading) return <div className="card p-8 text-center text-[12px] text-zn-text-3">Loading team...</div>

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Team members ({(team as any[]).length})</span>
          <button onClick={() => setShowInvite(true)} className="btn-gold btn-sm flex items-center gap-1.5">
            <IconPlus size={12} /> Invite member
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="border-b border-zn-border bg-zn-surface-2 px-5 py-4">
            <div className="mb-3 text-[13px] font-semibold text-zn-text-1">Invite team member</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="field-label">Full name</label>
                <input value={inviteForm.fullName} onChange={e => setInviteForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Sarah Chen" className="field-input" />
              </div>
              <div>
                <label className="field-label">Work email</label>
                <input value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="sarah@firm.com" className="field-input" />
              </div>
              <div>
                <label className="field-label">Title</label>
                <input value={inviteForm.title} onChange={e => setInviteForm(f => ({ ...f, title: e.target.value }))} placeholder="Senior Advisor" className="field-input" />
              </div>
              <div>
                <label className="field-label">Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as any }))} className="field-select">
                  {Object.entries(ROLE_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Client scope</label>
                <select value={inviteForm.clientScope} onChange={e => setInviteForm(f => ({ ...f, clientScope: e.target.value as any }))} className="field-select">
                  <option value="all">All clients</option>
                  <option value="own">Own clients only</option>
                  <option value="assigned">Assigned clients only</option>
                </select>
              </div>
              <div className="flex items-center gap-2 self-end pb-2">
                <input type="checkbox" id="isCco" checked={inviteForm.isCco} onChange={e => setInviteForm(f => ({ ...f, isCco: e.target.checked }))} />
                <label htmlFor="isCco" className="text-[13px] text-zn-text-1 cursor-pointer">Designate as CCO</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => inviteMutation.mutate(inviteForm)}
                disabled={!inviteForm.email || !inviteForm.fullName || inviteMutation.isPending}
                className="btn-gold btn-sm flex items-center gap-1.5"
              >
                {inviteMutation.isPending ? <IconLoader2 size={12} className="animate-spin" /> : <IconMail size={12} />}
                Send invite
              </button>
              <button onClick={() => setShowInvite(false)} className="btn-ghost btn-sm">Cancel</button>
            </div>
            {inviteMutation.error && (
              <div className="mt-2 text-[12px] text-zn-danger">{inviteMutation.error.message}</div>
            )}
          </div>
        )}

        {/* Team list */}
        {(team as any[]).length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-zn-text-3">No team members yet.</div>
        ) : (
          (team as any[]).map(member => {
            const roleCfg = ROLE_CONFIG[member.role] ?? { label: member.role, color: '#888' }
            const isEditing = editingId === member.id
            const isMe = member.id === me?.id

            return (
              <div key={member.id} className="border-b border-zn-border px-5 py-4 last:border-0">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ background: roleCfg.color + '15', color: roleCfg.color }}>
                    {member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-zn-text-1">{member.full_name}</span>
                      {member.is_cco && <span className="pill-danger pill text-[10px]">CCO</span>}
                      {isMe && <span className="pill-ghost pill text-[10px]">You</span>}
                    </div>
                    <div className="text-[11px] text-zn-text-3">
                      {member.email}
                      {member.title ? ` · ${member.title}` : ''}
                      {member.last_seen_at ? ` · Last seen ${new Date(member.last_seen_at).toLocaleDateString()}` : ' · Never signed in'}
                    </div>
                  </div>

                  {/* Role badge */}
                  {!isEditing && (
                    <span className="pill text-[11px] font-medium flex-shrink-0"
                      style={{ background: roleCfg.color + '12', borderColor: roleCfg.color + '30', color: roleCfg.color }}>
                      {roleCfg.label}
                    </span>
                  )}

                  {/* Client count */}
                  {member.client_count > 0 && !isEditing && (
                    <span className="pill-ghost pill text-[10px] flex-shrink-0">
                      {member.client_count} client{member.client_count !== 1 ? 's' : ''}
                    </span>
                  )}

                  {/* Actions */}
                  {!isMe && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(member.id)} className="btn-gold btn-sm flex items-center gap-1">
                            <IconCheck size={11} /> Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="btn-ghost btn-sm"><IconX size={11} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditMember(member)} className="btn-ghost btn-sm">Edit</button>
                          <button
                            onClick={() => { if (confirm(`Remove ${member.full_name}?`)) removeMutation.mutate({ userId: member.id }) }}
                            className="btn-ghost btn-sm text-zn-danger hover:bg-red-50"
                          >
                            <IconTrash size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="mt-3 grid grid-cols-3 gap-3 pl-12">
                    <div>
                      <label className="field-label">Role</label>
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="field-select">
                        {Object.entries(ROLE_CONFIG).map(([val, cfg]) => (
                          <option key={val} value={val}>{cfg.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Title</label>
                      <input value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="field-input" />
                    </div>
                    <div>
                      <label className="field-label">Client scope</label>
                      <select value={editForm.clientScope} onChange={e => setEditForm(f => ({ ...f, clientScope: e.target.value }))} className="field-select">
                        <option value="all">All clients</option>
                        <option value="own">Own clients only</option>
                        <option value="assigned">Assigned clients only</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 col-span-3">
                      <input type="checkbox" id={`cco-${member.id}`} checked={editForm.isCco} onChange={e => setEditForm(f => ({ ...f, isCco: e.target.checked }))} />
                      <label htmlFor={`cco-${member.id}`} className="text-[13px] text-zn-text-1 cursor-pointer">
                        Designate as CCO (will remove CCO from current holder)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Channels tab ───────────────────────────────────────────

function ChannelsTab() {
  const { data: channels, isLoading } = trpc.settings.getChannelStatus.useQuery()

  if (isLoading) return <div className="card p-8 text-center text-[12px] text-zn-text-3">Loading...</div>

  const CHANNEL_DEFS = [
    {
      key: 'platform', label: 'Platform messaging', desc: 'Built-in secure messaging — always on',
      status: 'active', comingSoon: false,
    },
    {
      key: 'email', label: `Email (${channels?.email.provider ?? 'Not configured'})`,
      desc: channels?.email.enabled
        ? `Journaling to ${channels.email.journalAddress}`
        : 'Configure your email provider to enable archiving',
      status: channels?.email.enabled ? 'active' : 'inactive',
      comingSoon: false,
    },
    {
      key: 'sms', label: 'SMS (Twilio)',
      desc: channels?.sms.enabled
        ? `Number: ${channels.sms.phoneNumber}`
        : 'Add Twilio credentials in integrations to enable',
      status: channels?.sms.enabled ? 'active' : 'inactive',
      comingSoon: false,
    },
    {
      key: 'zoom', label: 'Zoom recordings',
      desc: channels?.zoom.enabled ? 'Recording webhook active' : 'Add Zoom webhook secret to enable',
      status: channels?.zoom.enabled ? 'active' : 'inactive',
      comingSoon: false,
    },
    {
      key: 'slack', label: 'Slack',
      desc: 'Requires Slack Enterprise Grid',
      status: channels?.slack.enabled ? 'active' : 'inactive',
      comingSoon: false,
    },
    { key: 'linkedin', label: 'LinkedIn', desc: 'Phase 2 — Q3 2026', status: 'coming', comingSoon: true },
    { key: 'teams',    label: 'Microsoft Teams', desc: 'Phase 2 — Q3 2026', status: 'coming', comingSoon: true },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Communication channels</span>
        <span className="text-[11px] text-zn-text-3">All active channels are AI-monitored per SEC Rule 204-2</span>
      </div>
      {CHANNEL_DEFS.map(ch => (
        <div key={ch.key} className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0">
          <div className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full',
            ch.status === 'active'   ? 'bg-zn-success' :
            ch.status === 'coming'   ? 'bg-zn-warning' : 'bg-zn-border-2'
          )} />
          <div className="flex-1">
            <div className="text-[13px] font-medium text-zn-text-1">{ch.label}</div>
            <div className="text-[11px] text-zn-text-3 mt-0.5">{ch.desc}</div>
          </div>
          <span className={cn('pill',
            ch.status === 'active' ? 'pill-success' :
            ch.status === 'coming' ? 'pill-warn' : 'pill-ghost'
          )}>
            {ch.status === 'active' ? 'Active' : ch.status === 'coming' ? 'Coming soon' : 'Not connected'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Compliance tab ─────────────────────────────────────────

function ComplianceTab() {
  const { data: policies = [], isLoading } = trpc.settings.getRetentionPolicies.useQuery()

  const DEFAULT_POLICIES = [
    { record_type: 'communication',  retain_years: 5, immediate_access_years: 2 },
    { record_type: 'agreement',      retain_years: 5, immediate_access_years: 2 },
    { record_type: 'audit_log',      retain_years: 99, immediate_access_years: 5 },
    { record_type: 'meeting_recording', retain_years: 3, immediate_access_years: 1 },
  ]

  const displayPolicies = (policies as any[]).length > 0 ? policies : DEFAULT_POLICIES

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header"><span className="card-title">Retention policies</span></div>
        {(displayPolicies as any[]).map((r: any) => (
          <div key={r.record_type} className="flex items-center gap-4 border-b border-zn-border px-5 py-3.5 last:border-0">
            <div className="flex-1">
              <div className="text-[13px] font-medium text-zn-text-1 capitalize">
                {r.record_type.replace(/_/g, ' ')}
              </div>
              <div className="text-[11px] text-zn-text-3 mt-0.5">SEC Rule 204-2</div>
            </div>
            <div className="text-center min-w-[80px]">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zn-text-3">Total</div>
              <div className="text-[13px] font-semibold text-zn-text-1">
                {r.retain_years >= 99 ? 'Permanent' : `${r.retain_years} years`}
              </div>
            </div>
            <div className="text-center min-w-[100px]">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zn-text-3">Immediate access</div>
              <div className="text-[13px] font-semibold text-zn-text-1">{r.immediate_access_years} years</div>
            </div>
            <span className="pill-success pill">Active</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Compliance engine</span></div>
        <div className="px-5 py-4 space-y-4">
          {[
            { label: 'Daily compliance check', desc: 'Runs at 2:00 AM UTC — checks all 6 compliance rules', status: 'active' },
            { label: 'AI message scanning',    desc: 'Scans all inbound and outbound messages in real time',  status: 'active' },
            { label: 'Annual review tracking', desc: 'Alerts at 60, 30, and 7 days before review due date',  status: 'active' },
            { label: 'SEC filing calendar',    desc: 'Tracks Form ADV, Form PF, and other required filings', status: 'active' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-zn-text-1">{item.label}</div>
                <div className="text-[11px] text-zn-text-3 mt-0.5">{item.desc}</div>
              </div>
              <span className="pill-success pill">Running</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Notifications tab ──────────────────────────────────────

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    compliance_critical: true,
    compliance_warning:  true,
    ai_flag_high:        true,
    ai_flag_medium:      false,
    workflow_stalled:    true,
    annual_review_60d:   true,
    annual_review_30d:   true,
    filing_60d:          true,
  })

  const items = [
    { key: 'compliance_critical', label: 'Critical compliance items',      desc: 'Immediate alert when critical items are created' },
    { key: 'compliance_warning',  label: 'Warning compliance items',       desc: 'Daily digest of new warnings' },
    { key: 'ai_flag_high',        label: 'AI high-severity flags',          desc: 'Immediate alert for high-severity message flags' },
    { key: 'ai_flag_medium',      label: 'AI medium-severity flags',        desc: 'Daily digest of medium-severity flags' },
    { key: 'workflow_stalled',    label: 'Stalled onboarding workflows',    desc: 'Alert when workflow has no activity for 7+ days' },
    { key: 'annual_review_60d',   label: 'Annual reviews — 60-day notice',  desc: 'Alert 60 days before annual review is due' },
    { key: 'annual_review_30d',   label: 'Annual reviews — 30-day notice',  desc: 'Alert 30 days before annual review is due' },
    { key: 'filing_60d',          label: 'SEC filings — 60-day notice',     desc: 'Alert 60 days before a required filing is due' },
  ]

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Notification preferences</span></div>
      {items.map(item => (
        <div key={item.key} className="flex items-center gap-4 border-b border-zn-border px-5 py-3.5 last:border-0">
          <div className="flex-1">
            <div className="text-[13px] font-medium text-zn-text-1">{item.label}</div>
            <div className="text-[11px] text-zn-text-3 mt-0.5">{item.desc}</div>
          </div>
          <button
            onClick={() => setPrefs(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
          >
            <div className="relative h-5 w-9 rounded-full transition-colors"
              style={{ background: prefs[item.key as keyof typeof prefs] ? 'var(--zn-gold)' : 'var(--zn-border-2)' }}>
              <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                style={{ left: prefs[item.key as keyof typeof prefs] ? '17px' : '2px' }} />
            </div>
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('firm')

  return (
    <div className="animate-fade-in">
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
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'firm'          && <FirmTab />}
      {tab === 'team'          && <TeamTab />}
      {tab === 'channels'      && <ChannelsTab />}
      {tab === 'compliance'    && <ComplianceTab />}
      {tab === 'notifications' && <NotificationsTab />}
    </div>
  )
}
