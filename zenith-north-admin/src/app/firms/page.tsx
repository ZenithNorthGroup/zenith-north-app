'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { adminAPI, type TenantSummary } from '@/lib/api'

export default function FirmsPage() {
  const [tenants,  setTenants]  = useState<TenantSummary[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [planFilter, setPlan]   = useState('')
  const [statusFilter, setStatus] = useState('')

  useEffect(() => {
    adminAPI.listTenants()
      .then(setTenants)
      .finally(() => setLoading(false))
  }, [])

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.includes(search.toLowerCase())
    const matchPlan   = !planFilter   || t.plan === planFilter
    const matchStatus = !statusFilter || t.status === statusFilter
    return matchSearch && matchPlan && matchStatus
  })

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--admin-text1)' }}>Firms</h1>
          <div style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            {tenants.length} TOTAL · {tenants.filter(t => t.status === 'active').length} ACTIVE
          </div>
        </div>
        <Link href="/firms/new" className="btn btn-gold">+ New firm</Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search firms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="field-input"
          style={{ maxWidth: 240 }}
        />
        <select value={planFilter} onChange={e => setPlan(e.target.value)} className="field-select" style={{ maxWidth: 160 }}>
          <option value="">All plans</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="field-select" style={{ maxWidth: 160 }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Firm</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Setup %</th>
              <th>Health</th>
              <th>Clients</th>
              <th>Critical</th>
              <th>Channels</th>
              <th>Last activity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j}>
                      <div style={{ height: 12, background: 'var(--admin-surface3)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--admin-text3)', fontFamily: 'monospace', fontSize: 11 }}>
                  {search ? 'No firms match your search.' : 'No firms yet.'}
                </td>
              </tr>
            ) : filtered.map(t => (
              <tr key={t.id}>
                <td>
                  <div style={{ fontWeight: 500, color: 'var(--admin-text1)', fontSize: 13 }}>{t.name}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>{t.slug}</div>
                  {t.config.crd && (
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
                      CRD: {t.config.crd}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`pill ${t.plan === 'enterprise' ? 'pill-gold' : t.plan === 'professional' ? 'pill-info' : 'pill-ghost'}`}>
                    {t.plan}
                  </span>
                </td>
                <td>
                  <span className={`pill ${t.status === 'active' ? 'pill-success' : t.status === 'trial' ? 'pill-warning' : 'pill-danger'}`}>
                    {t.status}
                  </span>
                </td>
                <td>
                  <span className={`pill ${t.setupProgress.percentComplete === 100 ? 'pill-success' : t.setupProgress.percentComplete >= 50 ? 'pill-warning' : 'pill-danger'}`}>
                    {t.setupProgress.percentComplete}%
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  <span style={{
                    color: t.healthScore >= 80 ? 'var(--admin-success)'
                      : t.healthScore >= 50 ? 'var(--admin-warning)'
                      : 'var(--admin-danger)',
                  }}>
                    {t.healthScore}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.stats.clientCount}</td>
                <td>
                  {t.stats.criticalItems > 0 ? (
                    <span className="pill pill-danger">{t.stats.criticalItems}</span>
                  ) : (
                    <span style={{ color: 'var(--admin-success)', fontFamily: 'monospace', fontSize: 12 }}>✓</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {t.channelHealth.email && <span className="pill pill-success" style={{ fontSize: 9 }}>Email</span>}
                    {t.channelHealth.sms   && <span className="pill pill-success" style={{ fontSize: 9 }}>SMS</span>}
                    {t.channelHealth.zoom  && <span className="pill pill-success" style={{ fontSize: 9 }}>Zoom</span>}
                    {!t.channelHealth.email && !t.channelHealth.sms && (
                      <span className="pill pill-danger" style={{ fontSize: 9 }}>None</span>
                    )}
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
                  {t.stats.lastActivityAt
                    ? new Date(t.stats.lastActivityAt).toLocaleDateString()
                    : '—'
                  }
                </td>
                <td>
                  <Link
                    href={`/firms/${t.id}`}
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
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
