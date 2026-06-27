'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { adminAPI, type TenantSummary } from '@/lib/api'

export default function ChannelsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.listTenants().then(setTenants).finally(() => setLoading(false))
  }, [])

  const CHANNELS = [
    { key: 'email',    label: 'Email (M365/Google)' },
    { key: 'sms',      label: 'SMS (Twilio)'         },
    { key: 'zoom',     label: 'Zoom'                 },
    { key: 'slack',    label: 'Slack'                },
  ] as const

  const channelStats = CHANNELS.map(ch => ({
    ...ch,
    connected: tenants.filter(t => (t.channelHealth as any)[ch.key]).length,
    total:     tenants.length,
  }))

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--admin-text1)' }}>
          Channel health
        </h1>
        <div style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
          COMMUNICATION COMPLIANCE ACROSS ALL FIRMS
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        {channelStats.map(ch => (
          <div key={ch.key} className="stat-card">
            <div className="stat-label">{ch.label}</div>
            <div className="stat-num" style={{
              color: ch.connected === ch.total ? 'var(--admin-success)'
                : ch.connected > 0 ? 'var(--admin-warning)'
                : 'var(--admin-danger)',
              fontSize: 20,
            }}>
              {ch.connected}/{ch.total}
            </div>
            <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
              {ch.total - ch.connected} not connected
            </div>
          </div>
        ))}
      </div>

      {/* Per-firm channel matrix */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Firm channel matrix</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Firm</th>
              <th>Email</th>
              <th>Email provider</th>
              <th>Journal address</th>
              <th>SMS</th>
              <th>SMS number</th>
              <th>Zoom</th>
              <th>Slack</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-text3)' }}>LOADING...</td></tr>
            ) : tenants.map(t => (
              <tr key={t.id}>
                <td>
                  <div style={{ fontWeight: 500, color: 'var(--admin-text1)', fontSize: 13 }}>{t.name}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>{t.slug}</div>
                </td>
                <td>
                  <span className={`pill ${t.channelHealth.email ? 'pill-success' : 'pill-danger'}`}>
                    {t.channelHealth.email ? '✓' : '✗'}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-text2)' }}>
                  {t.channelHealth.emailProvider ?? '—'}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
                  ingest-{t.slug}@mail.zenith-north.com
                </td>
                <td>
                  <span className={`pill ${t.channelHealth.sms ? 'pill-success' : 'pill-warning'}`}>
                    {t.channelHealth.sms ? '✓' : '—'}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-text2)' }}>
                  {t.channelHealth.smsNumber ?? '—'}
                </td>
                <td>
                  <span className={`pill ${t.channelHealth.zoom ? 'pill-success' : 'pill-ghost'}`}>
                    {t.channelHealth.zoom ? '✓' : '—'}
                  </span>
                </td>
                <td>
                  <span className={`pill ${t.channelHealth.slack ? 'pill-success' : 'pill-ghost'}`}>
                    {t.channelHealth.slack ? '✓' : '—'}
                  </span>
                </td>
                <td>
                  <Link href={`/firms/${t.id}`} style={{ fontSize: 11, color: 'var(--admin-gold)', fontFamily: 'monospace', textDecoration: 'none' }}>
                    Configure →
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
