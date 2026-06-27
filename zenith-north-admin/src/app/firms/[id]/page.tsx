'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { adminAPI, type TenantSummary } from '@/lib/api'

// ── Setup step ─────────────────────────────────────────────

function SetupStep({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '8px 0',
      borderBottom: '0.5px solid var(--admin-border)',
    }}>
      <div style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? 'rgba(76,175,130,0.15)' : 'var(--admin-surface3)',
        border: `0.5px solid ${done ? 'rgba(76,175,130,0.4)' : 'var(--admin-border)'}`,
        fontSize: 10,
        color: done ? 'var(--admin-success)' : 'var(--admin-text3)',
        marginTop: 1,
      }}>
        {done ? '✓' : '○'}
      </div>
      <div>
        <div style={{ fontSize: 12, color: done ? 'var(--admin-text2)' : 'var(--admin-text1)', fontWeight: done ? 400 : 500 }}>
          {label}
        </div>
        {detail && (
          <div style={{ fontSize: 11, color: 'var(--admin-text3)', marginTop: 2, fontFamily: 'monospace' }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Channel row ────────────────────────────────────────────

function ChannelRow({ name, connected, detail, helpUrl }: {
  name: string; connected: boolean; detail?: string; helpUrl?: string
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '9px 14px',
      borderBottom: '0.5px solid var(--admin-border)',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-text1)' }}>{name}</div>
        {detail && <div style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 1 }}>{detail}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`pill ${connected ? 'pill-success' : 'pill-ghost'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
        {!connected && helpUrl && (
          <a href={helpUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--admin-gold)', fontFamily: 'monospace' }}>
            Setup →
          </a>
        )}
      </div>
    </div>
  )
}

// ── Config field ───────────────────────────────────────────

function ConfigField({ label, value, onSave, type = 'text', options }: {
  label: string
  value: string
  onSave: (val: string) => Promise<void>
  type?: string
  options?: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState(value)
  const [saving,  setSaving]  = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(current)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: 12,
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '0.5px solid var(--admin-border)',
    }}>
      <label className="field-label" style={{ margin: 0 }}>{label}</label>
      {editing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          {options ? (
            <select
              value={current}
              onChange={e => setCurrent(e.target.value)}
              className="field-select"
              style={{ flex: 1 }}
            >
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={type}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              className="field-input"
              style={{ flex: 1 }}
              autoFocus
            />
          )}
          <button onClick={handleSave} disabled={saving} className="btn btn-gold btn-sm">
            {saving ? '...' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setCurrent(value) }} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: value ? 'var(--admin-text1)' : 'var(--admin-text3)',
          }}>
            {value || '—'}
          </span>
          <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm">Edit</button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function FirmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tenant,    setTenant]    = useState<TenantSummary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [token,     setToken]     = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [engineRunning, setEngineRunning] = useState(false)

  useEffect(() => {
    adminAPI.getTenant(id)
      .then(setTenant)
      .finally(() => setLoading(false))
  }, [id])

  async function saveConfig(key: string, value: string) {
    if (!tenant) return
    await adminAPI.updateTenantConfig(tenant.id, { [key]: value })
    setTenant(prev => prev ? {
      ...prev,
      config: { ...prev.config, [key]: value },
    } : prev)
  }

  async function regenerateToken() {
    if (!tenant) return
    setGenerating(true)
    const result = await adminAPI.regenerateToken(tenant.id)
    setToken(result.token)
    setGenerating(false)
  }

  async function runEngineForFirm() {
    if (!tenant) return
    setEngineRunning(true)
    try {
      const result = await adminAPI.runComplianceEngine(tenant.id)
      alert(`Engine complete. ${result.itemsCreated} items created.`)
    } finally {
      setEngineRunning(false)
    }
  }

  function copyToken(t: string) {
    navigator.clipboard.writeText(t)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !tenant) {
    return (
      <div style={{ padding: 32, color: 'var(--admin-text3)', fontFamily: 'monospace', fontSize: 12 }}>
        {loading ? 'LOADING...' : 'FIRM NOT FOUND'}
      </div>
    )
  }

  const journalAddress = `ingest-${tenant.slug}@mail.zenith-north.com`

  return (
    <div style={{ padding: 24 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 11, fontFamily: 'monospace', color: 'var(--admin-text3)' }}>
        <Link href="/firms" style={{ color: 'var(--admin-text3)', textDecoration: 'none' }}>FIRMS</Link>
        {' → '}{tenant.name.toUpperCase()}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--admin-text1)' }}>{tenant.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <span className={`pill ${tenant.plan === 'enterprise' ? 'pill-gold' : tenant.plan === 'professional' ? 'pill-info' : 'pill-ghost'}`}>
              {tenant.plan}
            </span>
            <span className={`pill ${tenant.status === 'active' ? 'pill-success' : 'pill-warning'}`}>
              {tenant.status}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
              {tenant.slug} · CRD: {tenant.config.crd ?? 'not set'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={runEngineForFirm} disabled={engineRunning} className="btn btn-ghost btn-sm">
            {engineRunning ? 'Running...' : '⚡ Run engine'}
          </button>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/dashboard`}
            target="_blank"
            rel="noopener"
            className="btn btn-ghost btn-sm"
          >
            View firm dashboard ↗
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Health score', value: tenant.healthScore, color: tenant.healthScore >= 80 ? 'var(--admin-success)' : tenant.healthScore >= 50 ? 'var(--admin-warning)' : 'var(--admin-danger)' },
          { label: 'Setup %', value: `${tenant.setupProgress.percentComplete}%`, color: 'var(--admin-text1)' },
          { label: 'Clients', value: tenant.stats.clientCount, color: 'var(--admin-gold)' },
          { label: 'Critical items', value: tenant.stats.criticalItems, color: tenant.stats.criticalItems > 0 ? 'var(--admin-danger)' : 'var(--admin-success)' },
          { label: 'Audit entries', value: tenant.stats.totalAuditEntries.toLocaleString(), color: 'var(--admin-text1)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-num" style={{ color: s.color, fontSize: 18 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Setup checklist */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Setup checklist</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-text3)' }}>
                {tenant.setupProgress.completedSteps}/{tenant.setupProgress.totalSteps}
              </span>
            </div>
            <div style={{ padding: '4px 14px' }}>
              <SetupStep done={tenant.setupProgress.firmInfoComplete}    label="Firm information complete"     detail={tenant.config.crd ? `CRD: ${tenant.config.crd}` : 'CRD number required'} />
              <SetupStep done={tenant.setupProgress.deoSigned}           label="DEO undertaking signed"        detail={tenant.config.deoSignedAt ? `Signed ${new Date(tenant.config.deoSignedAt).toLocaleDateString()}` : 'CCO must sign'} />
              <SetupStep done={tenant.setupProgress.wspSigned}           label="Written Supervisory Procedures" detail={tenant.config.wspSignedAt ? `Signed ${new Date(tenant.config.wspSignedAt).toLocaleDateString()}` : 'CCO must sign'} />
              <SetupStep done={tenant.setupProgress.emailConnected}      label="Email journaling connected"    detail={tenant.channelHealth.emailProvider ?? 'Microsoft 365 or Google Workspace'} />
              <SetupStep done={tenant.setupProgress.smsConnected}        label="SMS configured"                detail={tenant.channelHealth.smsNumber ?? 'Twilio phone number needed'} />
              <SetupStep done={tenant.setupProgress.firstClientImported} label="First client imported"         detail={tenant.stats.clientCount > 0 ? `${tenant.stats.clientCount} clients` : 'No clients yet'} />
              <SetupStep done={tenant.setupProgress.firstWorkflowRun}    label="First workflow run started"    detail={tenant.stats.activeWorkflows > 0 ? `${tenant.stats.activeWorkflows} active` : 'No workflows started'} />
            </div>
          </div>

          {/* Channel health */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Communication channels</span>
            </div>
            <ChannelRow
              name="Email — Microsoft 365"
              connected={tenant.channelHealth.email && tenant.channelHealth.emailProvider === 'microsoft365'}
              detail={`Journal: ${journalAddress}`}
              helpUrl="https://compliance.microsoft.com"
            />
            <ChannelRow
              name="Email — Google Workspace"
              connected={tenant.channelHealth.email && tenant.channelHealth.emailProvider === 'google_workspace'}
              detail={`Journal: ${journalAddress}`}
              helpUrl="https://admin.google.com"
            />
            <ChannelRow
              name="SMS (Twilio)"
              connected={tenant.channelHealth.sms}
              detail={tenant.channelHealth.smsNumber ?? 'No number configured'}
            />
            <ChannelRow
              name="Zoom recording capture"
              connected={tenant.channelHealth.zoom}
              helpUrl="https://marketplace.zoom.us"
            />
            <ChannelRow
              name="Slack"
              connected={tenant.channelHealth.slack}
            />
          </div>

          {/* API token */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Integration API token</span>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--admin-text2)', marginBottom: 12, lineHeight: 1.6 }}>
                This token authenticates the firm's email journal address and any third-party integrations.
                Regenerating invalidates the current token immediately.
              </div>

              {tenant.config.integrationToken ? (
                <div style={{ marginBottom: 12 }}>
                  <label className="field-label">Current token</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="code-block" style={{ flex: 1, fontSize: 10 }}>
                      {tenant.config.integrationToken.slice(0, 12)}{'•'.repeat(32)}
                    </div>
                    <button onClick={() => copyToken(tenant.config.integrationToken!)} className="btn btn-ghost btn-sm">
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-text3)', marginBottom: 12 }}>
                  No token generated yet.
                </div>
              )}

              {token && (
                <div style={{ marginBottom: 12 }}>
                  <label className="field-label" style={{ color: 'var(--admin-warning)' }}>New token — copy now, shown once</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="code-block" style={{ flex: 1, fontSize: 10, borderColor: 'rgba(232,168,56,0.3)' }}>
                      {token}
                    </div>
                    <button onClick={() => copyToken(token)} className="btn btn-gold btn-sm">
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <button onClick={regenerateToken} disabled={generating} className="btn btn-ghost btn-sm">
                {generating ? 'Generating...' : '↻ Regenerate token'}
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Firm config */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Firm configuration</span>
            </div>
            <div style={{ padding: '4px 14px 8px' }}>
              <ConfigField label="CRD number"        value={tenant.config.crd ?? ''} onSave={v => saveConfig('crd', v)} />
              <ConfigField label="CCO name"          value={tenant.config.ccoName ?? ''} onSave={v => saveConfig('ccoName', v)} />
              <ConfigField label="CCO email"         value={tenant.config.ccoEmail ?? ''} onSave={v => saveConfig('ccoEmail', v)} type="email" />
              <ConfigField label="Plan"              value={tenant.plan}
                onSave={v => saveConfig('plan', v)}
                options={['starter', 'professional', 'enterprise']}
              />
              <ConfigField label="Registration type" value={tenant.config.registrationType ?? 'SEC'}
                onSave={v => saveConfig('registrationType', v)}
                options={['SEC', 'state']}
              />
              <ConfigField label="Email provider"   value={tenant.config.emailProvider ?? ''}
                onSave={v => saveConfig('emailProvider', v)}
                options={['microsoft365', 'google_workspace', 'both']}
              />
              <ConfigField label="Twilio number"    value={tenant.config.twilioPhoneNumber ?? ''} onSave={v => saveConfig('twilioPhoneNumber', v)} />
              <ConfigField label="Firm address"     value={tenant.config.address ?? ''} onSave={v => saveConfig('address', v)} />
            </div>
          </div>

          {/* Journal address */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Email journal address</span>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--admin-text2)', marginBottom: 10 }}>
                The firm's admin pastes this address into Microsoft Purview (Exchange journaling) and/or Google Workspace (Third-party email archiving).
              </div>
              <div className="code-block">{journalAddress}</div>

              <div style={{ marginTop: 12 }}>
                <div className="field-label">Setup instructions</div>
                <div style={{ fontSize: 11, color: 'var(--admin-text3)', lineHeight: 1.7, fontFamily: 'monospace' }}>
                  M365: compliance.microsoft.com → Exchange → Journal rules<br />
                  Google: admin.google.com → Gmail → Routing → Third-party archiving<br />
                  Paste: {journalAddress}
                </div>
              </div>

              {tenant.channelHealth.emailLastReceived && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--admin-success)', fontFamily: 'monospace' }}>
                  ✓ Last email received: {new Date(tenant.channelHealth.emailLastReceived).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Quick actions</span>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Generate WSP document', href: '#wsp' },
                { label: 'View audit log',        href: `/errors?tenantId=${tenant.id}` },
                { label: 'Run compliance engine', action: runEngineForFirm },
                { label: 'View firm messages',    href: '#' },
              ].map((action, i) => (
                action.href ? (
                  <a key={i} href={action.href} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}>
                    {action.label}
                  </a>
                ) : (
                  <button key={i} onClick={action.action} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}>
                    {action.label}
                  </button>
                )
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
