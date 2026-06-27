'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { adminAPI, type TenantSummary, type SystemHealth } from '@/lib/api'

// ── Health indicator ───────────────────────────────────────

function HealthDot({ status }: { status: 'healthy' | 'degraded' | 'down' }) {
  const color = status === 'healthy' ? 'var(--admin-success)'
    : status === 'degraded' ? 'var(--admin-warning)'
    : 'var(--admin-danger)'
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
        boxShadow: status === 'healthy' ? `0 0 6px ${color}` : 'none',
      }}
    />
  )
}

// ── Firm health bar ────────────────────────────────────────

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--admin-success)'
    : score >= 50 ? 'var(--admin-warning)'
    : 'var(--admin-danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1,
        height: 3,
        background: 'var(--admin-border)',
        borderRadius: 2,
      }}>
        <div style={{
          width: `${score}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.5s',
        }} />
      </div>
      <span style={{
        fontFamily: 'monospace',
        fontSize: 11,
        color,
        minWidth: 28,
      }}>
        {score}
      </span>
    </div>
  )
}

// ── Setup checklist pill ───────────────────────────────────

function SetupPill({ pct }: { pct: number }) {
  const cls = pct === 100 ? 'pill-success' : pct >= 50 ? 'pill-warning' : 'pill-danger'
  return <span className={`pill ${cls}`}>{pct}%</span>
}

// ── Page ──────────────────────────────────────────────────

export default function AdminDashboard() {
  const [tenants, setTenants]   = useState<TenantSummary[]>([])
  const [health,  setHealth]    = useState<SystemHealth | null>(null)
  const [loading, setLoading]   = useState(true)
  const [errors,  setErrors]    = useState<any[]>([])
  const [running, setRunning]   = useState(false)

  useEffect(() => {
    Promise.all([
      adminAPI.listTenants(),
      adminAPI.getSystemHealth(),
      adminAPI.listErrors({ limit: 10 }),
    ]).then(([t, h, e]) => {
      setTenants(t)
      setHealth(h)
      setErrors(e)
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [])

  async function runEngine() {
    setRunning(true)
    try {
      const result = await adminAPI.runComplianceEngine()
      alert(`Engine complete. ${result.itemsCreated} items created.`)
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  // Aggregate stats
  const totalClients   = tenants.reduce((s, t) => s + t.stats.clientCount, 0)
  const totalCritical  = tenants.reduce((s, t) => s + t.stats.criticalItems, 0)
  const totalWorkflows = tenants.reduce((s, t) => s + t.stats.activeWorkflows, 0)
  const avgHealth      = tenants.length
    ? Math.round(tenants.reduce((s, t) => s + t.healthScore, 0) / tenants.length)
    : 0

  const planCounts = tenants.reduce((acc, t) => {
    acc[t.plan] = (acc[t.plan] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--admin-text3)', fontFamily: 'monospace', fontSize: 12 }}>
        LOADING...
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--admin-text1)', margin: 0 }}>
            Overview
          </h1>
          <div style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            {tenants.length} FIRMS · {totalClients} CLIENTS · {new Date().toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={runEngine} disabled={running} className="btn btn-ghost btn-sm">
            {running ? 'Running...' : '⚡ Run compliance engine'}
          </button>
          <Link href="/firms/new" className="btn btn-gold btn-sm">
            + New firm
          </Link>
        </div>
      </div>

      {/* System health */}
      <div style={{ marginBottom: 20 }}>
        <div className="sl" style={{ marginTop: 0 }}>System health</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {[
            { label: 'API',               key: 'api',              status: health?.api.status },
            { label: 'Database',          key: 'database',         status: health?.database.status },
            { label: 'Email ingest',      key: 'email',            status: health?.email.status },
            { label: 'SMS',               key: 'sms',              status: health?.sms.status },
            { label: 'AI scanning',       key: 'ai',               status: health?.ai.status },
          ].map(item => (
            <div key={item.key} className="stat-card">
              <div className="stat-label">{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                <HealthDot status={(item.status as any) ?? 'healthy'} />
                <span style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: item.status === 'healthy' ? 'var(--admin-success)'
                    : item.status === 'degraded' ? 'var(--admin-warning)'
                    : 'var(--admin-danger)',
                  textTransform: 'uppercase',
                }}>
                  {item.status ?? 'healthy'}
                </span>
              </div>
              {item.key === 'api' && health?.api.responseTimeMs && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace' }}>
                  {health.api.responseTimeMs}ms
                </div>
              )}
              {item.key === 'ai' && health?.ai && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace' }}>
                  {health.ai.scansToday} scans · {health.ai.flagsToday} flags today
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Active firms</div>
          <div className="stat-num" style={{ color: 'var(--admin-gold)' }}>{tenants.filter(t => t.status === 'active').length}</div>
          <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            {planCounts.starter ?? 0} starter · {planCounts.professional ?? 0} pro · {planCounts.enterprise ?? 0} ent
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total clients</div>
          <div className="stat-num" style={{ color: 'var(--admin-text1)' }}>{totalClients.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            Across all firms
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical issues</div>
          <div className="stat-num" style={{ color: totalCritical > 0 ? 'var(--admin-danger)' : 'var(--admin-success)' }}>
            {totalCritical}
          </div>
          <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            Open compliance items
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg health score</div>
          <div className="stat-num" style={{ color: avgHealth >= 80 ? 'var(--admin-success)' : avgHealth >= 50 ? 'var(--admin-warning)' : 'var(--admin-danger)' }}>
            {avgHealth}
          </div>
          <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            Across all firms
          </div>
        </div>
      </div>

      {/* Main content — firms + errors side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>

        {/* Firms table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">All firms</span>
            <Link href="/firms" style={{ fontSize: 11, color: 'var(--admin-gold)', textDecoration: 'none', fontFamily: 'monospace' }}>
              View all →
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Firm</th>
                <th>Plan</th>
                <th>Setup</th>
                <th>Health</th>
                <th>Critical</th>
                <th>Clients</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--admin-text3)', padding: '24px 0' }}>
                    No firms yet. Create the first one.
                  </td>
                </tr>
              ) : tenants.map(tenant => (
                <tr key={tenant.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--admin-text1)', fontSize: 13 }}>
                      {tenant.name}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
                      {tenant.slug}
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${tenant.plan === 'enterprise' ? 'pill-gold' : tenant.plan === 'professional' ? 'pill-info' : 'pill-ghost'}`}>
                      {tenant.plan}
                    </span>
                  </td>
                  <td>
                    <SetupPill pct={tenant.setupProgress.percentComplete} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <HealthBar score={tenant.healthScore} />
                  </td>
                  <td>
                    {tenant.stats.criticalItems > 0 ? (
                      <span className="pill pill-danger">{tenant.stats.criticalItems}</span>
                    ) : (
                      <span style={{ color: 'var(--admin-success)', fontFamily: 'monospace', fontSize: 11 }}>✓</span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {tenant.stats.clientCount}
                  </td>
                  <td>
                    <Link
                      href={`/firms/${tenant.id}`}
                      style={{
                        fontSize: 11,
                        color: 'var(--admin-gold)',
                        textDecoration: 'none',
                        fontFamily: 'monospace',
                        padding: '3px 8px',
                        border: '0.5px solid rgba(201,169,110,0.25)',
                        borderRadius: 3,
                      }}
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent errors */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent errors</span>
            <Link href="/errors" style={{ fontSize: 11, color: 'var(--admin-gold)', textDecoration: 'none', fontFamily: 'monospace' }}>
              All errors →
            </Link>
          </div>
          <div>
            {errors.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace' }}>
                NO ERRORS · ALL SYSTEMS NOMINAL
              </div>
            ) : errors.map((err, i) => (
              <div key={err.id ?? i} style={{
                padding: '10px 14px',
                borderBottom: '0.5px solid var(--admin-border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span className={`pill ${err.severity === 'error' ? 'pill-danger' : err.severity === 'warning' ? 'pill-warning' : 'pill-ghost'}`}>
                    {err.source}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', flexShrink: 0 }}>
                    {new Date(err.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--admin-text2)', lineHeight: 1.4 }}>
                  {err.message}
                </div>
                {err.tenantName && (
                  <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
                    {err.tenantName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
