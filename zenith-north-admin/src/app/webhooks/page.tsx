'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'

const SOURCE_CONFIG: Record<string, { label: string; pill: string }> = {
  email_ingest:      { label: 'Email ingest',      pill: 'pill-info'    },
  sms_inbound:       { label: 'SMS inbound',        pill: 'pill-info'    },
  zoom_recording:    { label: 'Zoom recording',     pill: 'pill-info'    },
  portal_complete:   { label: 'Portal step',        pill: 'pill-ghost'   },
  myrepchat:         { label: 'MyRepChat',          pill: 'pill-ghost'   },
}

export default function WebhooksPage() {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [source,     setSource]     = useState('')
  const [expanded,   setExpanded]   = useState<string | null>(null)

  useEffect(() => {
    adminAPI.listWebhookDeliveries({ limit: 200 })
      .then(setDeliveries)
      .finally(() => setLoading(false))
  }, [])

  const filtered = source ? deliveries.filter(d => d.source === source) : deliveries
  const failed   = deliveries.filter(d => d.status === 'failed')
  const today    = deliveries.filter(d => new Date(d.createdAt) >= new Date(new Date().setHours(0,0,0,0)))

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--admin-text1)' }}>Webhooks</h1>
          <div style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            INBOUND WEBHOOK DELIVERY LOG
          </div>
        </div>
        <button onClick={() => adminAPI.listWebhookDeliveries({ limit: 200 }).then(setDeliveries)} className="btn btn-ghost btn-sm">
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Total deliveries</div>
          <div className="stat-num" style={{ color: 'var(--admin-gold)', fontSize: 20 }}>{deliveries.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-num" style={{ fontSize: 20 }}>{today.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-num" style={{ color: failed.length > 0 ? 'var(--admin-danger)' : 'var(--admin-success)', fontSize: 20 }}>
            {failed.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success rate</div>
          <div className="stat-num" style={{ color: 'var(--admin-success)', fontSize: 20 }}>
            {deliveries.length > 0
              ? `${Math.round(((deliveries.length - failed.length) / deliveries.length) * 100)}%`
              : '—'
            }
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 12 }}>
        <select value={source} onChange={e => setSource(e.target.value)} className="field-select" style={{ maxWidth: 200 }}>
          <option value="">All sources</option>
          {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Tenant</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text3)', fontFamily: 'monospace', fontSize: 11 }}>LOADING...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text3)', fontFamily: 'monospace', fontSize: 11 }}>
                NO WEBHOOK DELIVERIES YET
              </td></tr>
            ) : filtered.map((d, i) => {
              const cfg = SOURCE_CONFIG[d.source] ?? { label: d.source, pill: 'pill-ghost' }
              return (
                <tr key={d.id ?? i} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                  <td style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td><span className={`pill ${cfg.pill}`}>{cfg.label}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--admin-text2)' }}>{d.tenantName ?? '—'}</td>
                  <td>
                    <span className={`pill ${d.status === 'success' ? 'pill-success' : d.status === 'failed' ? 'pill-danger' : 'pill-warning'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--admin-text3)' }}>
                    {d.durationMs ? `${d.durationMs}ms` : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace' }}>
                    {d.statusCode ? `HTTP ${d.statusCode}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
