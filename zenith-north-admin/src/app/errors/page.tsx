'use client'

import { useState, useEffect } from 'react'
import { adminAPI, type ErrorLogEntry } from '@/lib/api'

const SOURCE_COLORS: Record<string, string> = {
  email_ingest:  'pill-warning',
  sms_webhook:   'pill-info',
  zoom_webhook:  'pill-info',
  ai_scan:       'pill-ghost',
  compliance_engine: 'pill-ghost',
  portal:        'pill-ghost',
  auth:          'pill-danger',
  database:      'pill-danger',
}

export default function ErrorsPage() {
  const [errors,   setErrors]   = useState<ErrorLogEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [source,   setSource]   = useState('')
  const [severity, setSeverity] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => {
    adminAPI.listErrors({ limit: 200 })
      .then(setErrors)
      .finally(() => setLoading(false))
  }, [])

  async function handleResolve(id: string) {
    setResolving(id)
    await adminAPI.resolveError(id)
    setErrors(prev => prev.map(e => e.id === id ? { ...e, resolvedAt: new Date().toISOString() } : e))
    setResolving(null)
  }

  const filtered = errors.filter(e => {
    const matchSource   = !source   || e.source   === source
    const matchSeverity = !severity || e.severity === severity
    return matchSource && matchSeverity
  })

  const unresolved = errors.filter(e => !e.resolvedAt)
  const bySource   = errors.reduce((acc, e) => { acc[e.source] = (acc[e.source] ?? 0) + 1; return acc }, {} as Record<string, number>)
  const sources    = Object.keys(bySource)

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--admin-text1)' }}>Error log</h1>
          <div style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            {unresolved.length} UNRESOLVED · {errors.length} TOTAL
          </div>
        </div>
        <button
          onClick={() => adminAPI.listErrors({ limit: 200 }).then(setErrors)}
          className="btn btn-ghost btn-sm"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Unresolved',    value: unresolved.length, color: unresolved.length > 0 ? 'var(--admin-danger)' : 'var(--admin-success)' },
          { label: 'Errors',        value: errors.filter(e => e.severity === 'error').length, color: 'var(--admin-danger)' },
          { label: 'Warnings',      value: errors.filter(e => e.severity === 'warning').length, color: 'var(--admin-warning)' },
          { label: 'Info',          value: errors.filter(e => e.severity === 'info').length, color: 'var(--admin-text3)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-num" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={source} onChange={e => setSource(e.target.value)} className="field-select" style={{ maxWidth: 200 }}>
          <option value="">All sources</option>
          {sources.map(s => (
            <option key={s} value={s}>{s} ({bySource[s]})</option>
          ))}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} className="field-select" style={{ maxWidth: 160 }}>
          <option value="">All severities</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Error list */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--admin-text3)', fontFamily: 'monospace', fontSize: 11 }}>
            LOADING...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-success)', fontFamily: 'monospace', fontSize: 12 }}>
            ✓ NO ERRORS · ALL SYSTEMS NOMINAL
          </div>
        ) : filtered.map(err => (
          <div key={err.id} style={{
            borderBottom: '0.5px solid var(--admin-border)',
            opacity: err.resolvedAt ? 0.4 : 1,
          }}>
            {/* Main row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 90px 90px 1fr 130px 90px',
                gap: 12,
                alignItems: 'center',
                padding: '10px 14px',
                cursor: err.stack || err.metadata ? 'pointer' : 'default',
              }}
              onClick={() => setExpanded(expanded === err.id ? null : err.id)}
            >
              {/* Timestamp */}
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
                {new Date(err.createdAt).toLocaleString()}
              </div>

              {/* Severity */}
              <div>
                <span className={`pill ${err.severity === 'error' ? 'pill-danger' : err.severity === 'warning' ? 'pill-warning' : 'pill-ghost'}`}>
                  {err.severity}
                </span>
              </div>

              {/* Source */}
              <div>
                <span className={`pill ${SOURCE_COLORS[err.source] ?? 'pill-ghost'}`}>
                  {err.source}
                </span>
              </div>

              {/* Message */}
              <div style={{ fontSize: 12, color: 'var(--admin-text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {err.message}
              </div>

              {/* Tenant */}
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {err.tenantName ?? '—'}
              </div>

              {/* Actions */}
              <div>
                {!err.resolvedAt ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleResolve(err.id) }}
                    disabled={resolving === err.id}
                    className="btn btn-ghost btn-sm"
                  >
                    {resolving === err.id ? '...' : 'Resolve'}
                  </button>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--admin-success)', fontFamily: 'monospace' }}>resolved</span>
                )}
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === err.id && (err.stack || err.metadata) && (
              <div style={{
                padding: '0 14px 12px',
                background: 'var(--admin-surface2)',
                borderTop: '0.5px solid var(--admin-border)',
              }}>
                {err.message && (
                  <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--admin-text2)' }}>
                    {err.message}
                  </div>
                )}
                {err.stack && (
                  <div>
                    <label className="field-label" style={{ marginTop: 8 }}>Stack trace</label>
                    <div className="code-block" style={{ color: 'var(--admin-danger)', fontSize: 10 }}>
                      {err.stack}
                    </div>
                  </div>
                )}
                {err.metadata && (
                  <div>
                    <label className="field-label" style={{ marginTop: 8 }}>Metadata</label>
                    <div className="code-block" style={{ fontSize: 10 }}>
                      {JSON.stringify(err.metadata, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
