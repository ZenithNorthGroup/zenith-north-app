'use client'

import { useState } from 'react'

// ── Permission definitions (mirrored from app) ─────────────

const ALL_PERMISSIONS = {
  clients: {
    label: 'Clients',
    icon: '👤',
    permissions: {
      'clients.view':       { label: 'View clients',         desc: 'See the client list' },
      'clients.view_all':   { label: 'View all clients',     desc: 'See all clients, not just assigned' },
      'clients.create':     { label: 'Add clients',          desc: 'Create new client records' },
      'clients.edit':       { label: 'Edit clients',         desc: 'Update client information' },
      'clients.archive':    { label: 'Archive clients',      desc: 'Archive client records' },
      'clients.view_360':   { label: 'Client 360 view',      desc: 'Full history, notes, timeline' },
    },
  },
  compliance: {
    label: 'Compliance',
    icon: '🛡️',
    permissions: {
      'compliance.view':        { label: 'View compliance',       desc: 'See the compliance queue' },
      'compliance.resolve':     { label: 'Resolve items',         desc: 'Mark items as resolved' },
      'compliance.snooze':      { label: 'Snooze items',          desc: 'Snooze compliance items' },
      'compliance.run_engine':  { label: 'Run engine',            desc: 'Trigger compliance checks manually' },
    },
  },
  messages: {
    label: 'Communications',
    icon: '💬',
    permissions: {
      'messages.view':          { label: 'View messages',         desc: 'See all message threads' },
      'messages.send':          { label: 'Send messages',         desc: 'Send messages to clients' },
      'messages.view_flagged':  { label: 'View AI flags',         desc: 'See AI-flagged communications' },
      'messages.review_flag':   { label: 'Review AI flags',       desc: 'Mark flagged messages as reviewed' },
    },
  },
  audit: {
    label: 'Audit center',
    icon: '📋',
    permissions: {
      'audit.view':    { label: 'View audit log',      desc: 'See the immutable audit trail' },
      'audit.export':  { label: 'Export exam package', desc: 'Generate SEC exam packages' },
    },
  },
  workflows: {
    label: 'Workflows',
    icon: '⚡',
    permissions: {
      'workflows.view':     { label: 'View workflows',    desc: 'See onboarding pipeline' },
      'workflows.create':   { label: 'Start workflows',   desc: 'Initiate new onboarding' },
      'workflows.advance':  { label: 'Advance steps',     desc: 'Complete workflow steps' },
      'workflows.approve':  { label: 'Approve workflows', desc: 'CCO approval on steps' },
    },
  },
  documents: {
    label: 'Documents',
    icon: '📄',
    permissions: {
      'documents.view':    { label: 'View documents',    desc: 'See the document library' },
      'documents.upload':  { label: 'Upload documents',  desc: 'Add new documents' },
      'documents.delete':  { label: 'Archive documents', desc: 'Archive documents' },
    },
  },
  ai: {
    label: 'AI assistant',
    icon: '✨',
    permissions: {
      'ai.ask':       { label: 'Use AI assistant',     desc: 'Ask questions via the AI' },
      'ai.view_scan': { label: 'View AI scan results', desc: 'See compliance scan results' },
    },
  },
  reports: {
    label: 'Reports',
    icon: '📊',
    permissions: {
      'reports.view':   { label: 'View reports',   desc: 'See analytics and reports' },
      'reports.export': { label: 'Export reports', desc: 'Download report data' },
    },
  },
  settings: {
    label: 'Settings',
    icon: '⚙️',
    permissions: {
      'settings.view':                { label: 'View settings',          desc: 'See firm settings' },
      'settings.edit':                { label: 'Edit settings',          desc: 'Change firm configuration' },
      'settings.manage_team':         { label: 'Manage team',            desc: 'Add/edit/remove team members' },
      'settings.manage_integrations': { label: 'Manage integrations',    desc: 'Connect channels and tools' },
    },
  },
  calendar: {
    label: 'Calendar & tasks',
    icon: '📅',
    permissions: {
      'calendar.view':   { label: 'View calendar',  desc: 'See deadlines and events' },
      'calendar.edit':   { label: 'Edit calendar',  desc: 'Add and manage events' },
      'tasks.view':      { label: 'View tasks',     desc: 'See the task list' },
      'tasks.create':    { label: 'Create tasks',   desc: 'Add new tasks' },
      'tasks.complete':  { label: 'Complete tasks', desc: 'Mark tasks as done' },
    },
  },
}

// ── Preset roles (starting points) ────────────────────────

const PRESET_ROLES = [
  {
    id: 'owner',
    name: 'Owner / Principal',
    color: '#C9A96E',
    desc: 'Full access to everything',
    permissions: Object.values(ALL_PERMISSIONS).flatMap(g => Object.keys(g.permissions)),
  },
  {
    id: 'cco',
    name: 'CCO',
    color: '#DC2626',
    desc: 'Compliance-first, full compliance access',
    permissions: [
      'clients.view', 'clients.view_all', 'clients.view_360',
      'compliance.view', 'compliance.resolve', 'compliance.snooze', 'compliance.run_engine',
      'messages.view', 'messages.view_flagged', 'messages.review_flag',
      'audit.view', 'audit.export',
      'workflows.view', 'workflows.approve',
      'documents.view', 'documents.upload',
      'ai.ask', 'ai.view_scan',
      'reports.view', 'reports.export',
      'settings.view',
      'calendar.view', 'tasks.view', 'tasks.create', 'tasks.complete',
    ],
  },
  {
    id: 'advisor',
    name: 'Advisor',
    color: '#059669',
    desc: 'Client-focused, own book of business',
    permissions: [
      'clients.view', 'clients.create', 'clients.edit', 'clients.view_360',
      'messages.view', 'messages.send',
      'workflows.view', 'workflows.create', 'workflows.advance',
      'documents.view', 'documents.upload',
      'ai.ask',
      'calendar.view', 'calendar.edit',
      'tasks.view', 'tasks.create', 'tasks.complete',
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    color: '#3B82F6',
    desc: 'Workflow and document management',
    permissions: [
      'clients.view', 'clients.view_all', 'clients.create', 'clients.edit',
      'workflows.view', 'workflows.create', 'workflows.advance',
      'documents.view', 'documents.upload',
      'calendar.view', 'calendar.edit',
      'tasks.view', 'tasks.create', 'tasks.complete',
      'reports.view',
    ],
  },
  {
    id: 'associate',
    name: 'Associate Advisor',
    color: '#6B7280',
    desc: 'Read-only, assigned clients only',
    permissions: [
      'clients.view', 'clients.view_360',
      'messages.view',
      'workflows.view',
      'documents.view',
      'calendar.view',
      'tasks.view', 'tasks.complete',
    ],
  },
]

// ── Types ──────────────────────────────────────────────────

type CustomRole = {
  id:          string
  name:        string
  color:       string
  desc:        string
  permissions: string[]
  isCustom:    boolean
}

// ── Color options ──────────────────────────────────────────

const COLORS = ['#C9A96E', '#DC2626', '#059669', '#3B82F6', '#7C3AED', '#DB2777', '#D97706', '#6B7280', '#0891B2', '#65A30D']

// ── Permission toggle component ────────────────────────────

function PermissionToggle({ perm, label, desc, enabled, onChange }: {
  perm: string; label: string; desc: string; enabled: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
        background: enabled ? 'rgba(201,169,110,0.06)' : 'transparent',
        border: `0.5px solid ${enabled ? 'rgba(201,169,110,0.25)' : 'var(--admin-border)'}`,
        marginBottom: 4, transition: 'all 0.15s',
      }}
      onClick={() => onChange(!enabled)}
    >
      {/* Toggle */}
      <div style={{
        width: 32, height: 18, borderRadius: 9, flexShrink: 0,
        background: enabled ? 'var(--admin-gold)' : 'var(--admin-border-2)',
        position: 'relative', transition: 'background 0.15s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: enabled ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s',
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: enabled ? 'var(--admin-text1)' : 'var(--admin-text2)' }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--admin-text3)', marginTop: 1 }}>{desc}</div>
      </div>

      <code style={{
        fontSize: 9, fontFamily: 'monospace',
        color: 'var(--admin-text3)',
        background: 'var(--admin-surface2)',
        padding: '1px 5px', borderRadius: 3,
      }}>
        {perm}
      </code>
    </div>
  )
}

// ── Role editor panel ──────────────────────────────────────

function RoleEditor({ role, onSave, onCancel }: {
  role: Partial<CustomRole>
  onSave: (r: CustomRole) => void
  onCancel: () => void
}) {
  const [name,   setName]   = useState(role.name ?? '')
  const [color,  setColor]  = useState(role.color ?? '#C9A96E')
  const [desc,   setDesc]   = useState(role.desc ?? '')
  const [perms,  setPerms]  = useState<Set<string>>(new Set(role.permissions ?? []))
  const [search, setSearch] = useState('')

  function toggle(perm: string) {
    setPerms(prev => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  function toggleAll(permKeys: string[], on: boolean) {
    setPerms(prev => {
      const next = new Set(prev)
      permKeys.forEach(p => on ? next.add(p) : next.delete(p))
      return next
    })
  }

  const allPermKeys = Object.values(ALL_PERMISSIONS).flatMap(g => Object.keys(g.permissions))
  const enabledCount = allPermKeys.filter(p => perms.has(p)).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 780, maxHeight: '90vh',
        background: 'var(--admin-surface)',
        border: '0.5px solid var(--admin-border)',
        borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Color picker */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', width: 110 }}>
            {COLORS.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 18, height: 18, borderRadius: '50%', background: c,
                  cursor: 'pointer',
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>

          <div style={{ flex: 1 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Role name..."
              style={{ display: 'block', width: '100%', fontSize: 16, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: color, marginBottom: 4 }}
            />
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Short description..."
              style={{ display: 'block', width: '100%', fontSize: 12, border: 'none', outline: 'none', background: 'transparent', color: 'var(--admin-text3)' }}
            />
          </div>

          <div style={{ fontSize: 12, color: 'var(--admin-text3)', fontFamily: 'monospace', textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: color }}>{enabledCount}</div>
            of {allPermKeys.length} permissions
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '10px 20px', borderBottom: '0.5px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--admin-text3)' }}>Quick set:</span>
          {PRESET_ROLES.map(preset => (
            <button
              key={preset.id}
              onClick={() => setPerms(new Set(preset.permissions))}
              style={{ padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${preset.color}40`, background: preset.color + '10', color: preset.color, fontSize: 11, cursor: 'pointer' }}
            >
              {preset.name}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setPerms(new Set(allPermKeys))} style={{ padding: '4px 10px', borderRadius: 20, border: '0.5px solid var(--admin-border-2)', color: 'var(--admin-text2)', fontSize: 11, cursor: 'pointer', background: 'transparent' }}>
              Select all
            </button>
            <button onClick={() => setPerms(new Set())} style={{ padding: '4px 10px', borderRadius: 20, border: '0.5px solid var(--admin-border-2)', color: 'var(--admin-text2)', fontSize: 11, cursor: 'pointer', background: 'transparent' }}>
              Clear all
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 20px', borderBottom: '0.5px solid var(--admin-border)' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search permissions..."
            style={{ width: '100%', padding: '6px 10px', border: '0.5px solid var(--admin-border-2)', borderRadius: 6, background: 'var(--admin-surface2)', color: 'var(--admin-text1)', fontSize: 12, outline: 'none' }}
          />
        </div>

        {/* Permission list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {Object.entries(ALL_PERMISSIONS).map(([moduleKey, module]) => {
            const modulePerms = Object.entries(module.permissions)
            const filteredPerms = search
              ? modulePerms.filter(([k, v]) => v.label.toLowerCase().includes(search.toLowerCase()) || v.desc.toLowerCase().includes(search.toLowerCase()) || k.includes(search.toLowerCase()))
              : modulePerms
            if (filteredPerms.length === 0) return null

            const modulePermKeys = modulePerms.map(([k]) => k)
            const allOn = modulePermKeys.every(k => perms.has(k))
            const someOn = modulePermKeys.some(k => perms.has(k))

            return (
              <div key={moduleKey} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{module.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--admin-text2)' }}>
                      {module.label}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace' }}>
                      {modulePermKeys.filter(k => perms.has(k)).length}/{modulePermKeys.length}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleAll(modulePermKeys, !allOn)}
                    style={{ fontSize: 11, color: allOn ? 'var(--admin-gold)' : 'var(--admin-text3)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 8px' }}
                  >
                    {allOn ? '✓ All on' : someOn ? '— Some on' : 'Enable all'}
                  </button>
                </div>
                {filteredPerms.map(([perm, cfg]) => (
                  <PermissionToggle
                    key={perm}
                    perm={perm}
                    label={cfg.label}
                    desc={cfg.desc}
                    enabled={perms.has(perm)}
                    onChange={() => toggle(perm)}
                  />
                ))}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', border: '0.5px solid var(--admin-border-2)', borderRadius: 6, background: 'transparent', color: 'var(--admin-text2)', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <div style={{ display: 'flex', align: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--admin-text3)', alignSelf: 'center' }}>
              {enabledCount} permissions enabled
            </span>
            <button
              onClick={() => {
                if (!name.trim()) return
                onSave({
                  id: role.id ?? crypto.randomUUID(),
                  name: name.trim(),
                  color,
                  desc: desc.trim(),
                  permissions: Array.from(perms),
                  isCustom: true,
                })
              }}
              disabled={!name.trim()}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 6,
                background: name.trim() ? 'var(--admin-gold)' : 'var(--admin-border)',
                color: name.trim() ? '#0A0A0A' : 'var(--admin-text3)',
                fontSize: 13, fontWeight: 600,
                cursor: name.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Save role
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Role card ──────────────────────────────────────────────

function RoleCard({ role, onEdit, onDelete }: {
  role: CustomRole; onEdit: () => void; onDelete?: () => void
}) {
  const allPerms = Object.values(ALL_PERMISSIONS).flatMap(g => Object.keys(g.permissions))
  const pct = Math.round((role.permissions.length / allPerms.length) * 100)

  // Group permissions by module
  const byModule = Object.entries(ALL_PERMISSIONS).map(([key, module]) => ({
    label: module.label,
    icon: module.icon,
    count: Object.keys(module.permissions).filter(p => role.permissions.includes(p)).length,
    total: Object.keys(module.permissions).length,
  }))

  return (
    <div style={{
      background: 'var(--admin-surface)',
      border: `0.5px solid ${role.color}30`,
      borderTop: `3px solid ${role.color}`,
      borderRadius: 10,
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: role.color + '15', color: role.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
        }}>
          {role.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-text1)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {role.name}
            {!role.isCustom && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: 'var(--admin-surface2)', color: 'var(--admin-text3)', border: '0.5px solid var(--admin-border)', fontFamily: 'monospace' }}>
                PRESET
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--admin-text3)', marginTop: 2 }}>{role.desc}</div>
        </div>
      </div>

      {/* Permission bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: 'var(--admin-text3)' }}>{role.permissions.length} permissions</span>
          <span style={{ fontSize: 10, color: role.color, fontFamily: 'monospace' }}>{pct}% access</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--admin-border)' }}>
          <div style={{ height: '100%', borderRadius: 2, background: role.color, width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Module dots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {byModule.filter(m => m.count > 0).map(m => (
          <div key={m.label} title={`${m.label}: ${m.count}/${m.total}`}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: 'var(--admin-surface2)', border: '0.5px solid var(--admin-border)', fontSize: 10, color: 'var(--admin-text2)' }}>
            <span style={{ fontSize: 11 }}>{m.icon}</span>
            <span>{m.count === m.total ? '✓' : `${m.count}/${m.total}`}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, borderTop: '0.5px solid var(--admin-border)', paddingTop: 12 }}>
        <button
          onClick={onEdit}
          style={{ flex: 1, padding: '7px', borderRadius: 6, border: `0.5px solid ${role.color}40`, background: role.color + '08', color: role.color, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >
          {role.isCustom ? 'Edit role' : 'Customize'}
        </button>
        {role.isCustom && onDelete && (
          <button
            onClick={onDelete}
            style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text3)', fontSize: 12, cursor: 'pointer' }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function RolesPage() {
  const [roles, setRoles] = useState<CustomRole[]>(
    PRESET_ROLES.map(r => ({ ...r, isCustom: false }))
  )
  const [editing, setEditing] = useState<Partial<CustomRole> | null>(null)
  const [saved,   setSaved]   = useState(false)

  function handleSave(role: CustomRole) {
    setRoles(prev => {
      const idx = prev.findIndex(r => r.id === role.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...role, isCustom: true }
        return next
      }
      return [...prev, { ...role, isCustom: true }]
    })
    setEditing(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleDelete(id: string) {
    setRoles(prev => prev.filter(r => r.id !== id))
  }

  const customRoles  = roles.filter(r => r.isCustom)
  const presetRoles  = roles.filter(r => !r.isCustom)

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--admin-text1)', marginBottom: 4 }}>
            Roles & permissions
          </h1>
          <p style={{ fontSize: 13, color: 'var(--admin-text3)' }}>
            Preset roles are starting points. Customize any role or create new ones from scratch.
            {saved && <span style={{ marginLeft: 12, color: 'var(--admin-success)', fontFamily: 'monospace' }}>✓ Saved</span>}
          </p>
        </div>
        <button
          onClick={() => setEditing({ isCustom: true, permissions: [] })}
          style={{ padding: '9px 16px', border: 'none', borderRadius: 6, background: 'var(--admin-gold)', color: '#0A0A0A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Create custom role
        </button>
      </div>

      {/* Custom roles */}
      {customRoles.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)', marginBottom: 12 }}>
            Custom roles ({customRoles.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {customRoles.map(role => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={() => setEditing(role)}
                onDelete={() => handleDelete(role.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Preset roles */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)', marginBottom: 12 }}>
          Preset roles — click "Customize" to modify
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {presetRoles.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={() => setEditing({ ...role, id: crypto.randomUUID(), isCustom: true, name: role.name + ' (custom)' })}
            />
          ))}
        </div>
      </div>

      {/* Permission reference */}
      <div style={{ marginTop: 32, padding: 16, borderRadius: 10, background: 'var(--admin-surface)', border: '0.5px solid var(--admin-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)', marginBottom: 12 }}>
          All {Object.values(ALL_PERMISSIONS).flatMap(g => Object.keys(g.permissions)).length} available permissions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {Object.entries(ALL_PERMISSIONS).map(([, module]) => (
            <div key={module.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{module.icon}</span> {module.label}
              </div>
              {Object.entries(module.permissions).map(([perm, cfg]) => (
                <div key={perm} style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', marginBottom: 2 }}>
                  {perm}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Editor modal */}
      {editing && (
        <RoleEditor
          role={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
