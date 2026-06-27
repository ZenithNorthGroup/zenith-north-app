'use client'

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────

interface EnvVar {
  key:         string
  label:       string
  description: string
  group:       string
  sensitive:   boolean
  required:    boolean
  helpUrl?:    string
  placeholder?: string
}

// ── All environment variables the platform needs ──────────

const ENV_VARS: EnvVar[] = [
  // Database
  { key: 'DATABASE_URL',                    label: 'Database URL',                   group: 'Database',     sensitive: true,  required: true,  helpUrl: 'https://neon.tech',                    description: 'Neon PostgreSQL connection string', placeholder: 'postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require' },

  // Auth
  { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', label: 'Clerk Publishable Key',         group: 'Auth (Clerk)', sensitive: false, required: true,  helpUrl: 'https://dashboard.clerk.com',          description: 'Starts with pk_live_ or pk_test_',  placeholder: 'pk_live_...' },
  { key: 'CLERK_SECRET_KEY',                label: 'Clerk Secret Key',               group: 'Auth (Clerk)', sensitive: true,  required: true,  helpUrl: 'https://dashboard.clerk.com',          description: 'Starts with sk_live_ or sk_test_',  placeholder: 'sk_live_...' },
  { key: 'CLERK_WEBHOOK_SECRET',            label: 'Clerk Webhook Secret',           group: 'Auth (Clerk)', sensitive: true,  required: true,  helpUrl: 'https://dashboard.clerk.com/webhooks',  description: 'Signing secret from Clerk Webhooks page', placeholder: 'whsec_...' },

  // AI
  { key: 'ANTHROPIC_API_KEY',               label: 'Anthropic API Key',              group: 'AI',           sensitive: true,  required: true,  helpUrl: 'https://console.anthropic.com',        description: 'Powers compliance scanning and AI assistant', placeholder: 'sk-ant-...' },

  // SMS
  { key: 'TWILIO_ACCOUNT_SID',              label: 'Twilio Account SID',             group: 'SMS (Twilio)', sensitive: false, required: false, helpUrl: 'https://console.twilio.com',           description: 'From Twilio Console dashboard', placeholder: 'ACxxxxxxxx' },
  { key: 'TWILIO_AUTH_TOKEN',               label: 'Twilio Auth Token',              group: 'SMS (Twilio)', sensitive: true,  required: false, helpUrl: 'https://console.twilio.com',           description: 'From Twilio Console dashboard', placeholder: 'xxxxxxxx' },
  { key: 'TWILIO_PHONE_NUMBER',             label: 'Twilio Phone Number',            group: 'SMS (Twilio)', sensitive: false, required: false, helpUrl: 'https://console.twilio.com',           description: 'Your Twilio SMS number, e.g. +14155550100', placeholder: '+14155550100' },

  // Email
  { key: 'SENDGRID_API_KEY',                label: 'Sendgrid API Key',               group: 'Email (Sendgrid)', sensitive: true, required: false, helpUrl: 'https://sendgrid.com',              description: 'For email ingest and sending. Set up Inbound Parse webhook.', placeholder: 'SG.xxx' },

  // Zoom
  { key: 'ZOOM_WEBHOOK_SECRET',             label: 'Zoom Webhook Secret',            group: 'Zoom',         sensitive: true,  required: false, helpUrl: 'https://marketplace.zoom.us',          description: 'From your Zoom marketplace app → Event Subscriptions', placeholder: 'xxxxxxxx' },
  { key: 'ZOOM_ACCOUNT_ID',                 label: 'Zoom Account ID',                group: 'Zoom',         sensitive: false, required: false, helpUrl: 'https://marketplace.zoom.us',          description: 'From your Zoom OAuth app', placeholder: 'xxxxxxxx' },
  { key: 'ZOOM_CLIENT_ID',                  label: 'Zoom Client ID',                 group: 'Zoom',         sensitive: false, required: false, helpUrl: 'https://marketplace.zoom.us',          description: 'From your Zoom OAuth app', placeholder: 'xxxxxxxx' },
  { key: 'ZOOM_CLIENT_SECRET',              label: 'Zoom Client Secret',             group: 'Zoom',         sensitive: true,  required: false, helpUrl: 'https://marketplace.zoom.us',          description: 'From your Zoom OAuth app', placeholder: 'xxxxxxxx' },

  // Storage
  { key: 'R2_ACCOUNT_ID',                   label: 'Cloudflare R2 Account ID',       group: 'Storage (R2)', sensitive: false, required: false, helpUrl: 'https://dash.cloudflare.com',          description: 'From Cloudflare dashboard → R2', placeholder: 'xxxxxxxx' },
  { key: 'R2_ACCESS_KEY_ID',                label: 'R2 Access Key ID',               group: 'Storage (R2)', sensitive: false, required: false, helpUrl: 'https://dash.cloudflare.com',          description: 'Create in R2 → Manage R2 API Tokens', placeholder: 'xxxxxxxx' },
  { key: 'R2_SECRET_ACCESS_KEY',            label: 'R2 Secret Access Key',           group: 'Storage (R2)', sensitive: true,  required: false, helpUrl: 'https://dash.cloudflare.com',          description: 'Create in R2 → Manage R2 API Tokens', placeholder: 'xxxxxxxx' },
  { key: 'R2_BUCKET_NAME',                  label: 'R2 Bucket Name',                 group: 'Storage (R2)', sensitive: false, required: false, helpUrl: 'https://dash.cloudflare.com',          description: 'The name of your R2 bucket', placeholder: 'zenith-north-recordings' },

  // Internal secrets
  { key: 'CRON_SECRET',                     label: 'Cron Secret',                    group: 'Internal',     sensitive: true,  required: true,  description: 'Protects /api/compliance/engine. Generate: any random 32-char string', placeholder: 'generate-random-string' },
  { key: 'PORTAL_SECRET',                   label: 'Portal Secret',                  group: 'Internal',     sensitive: true,  required: true,  description: 'Signs client portal magic link tokens', placeholder: 'generate-random-string' },
  { key: 'SERVICE_SECRET',                  label: 'Service Secret',                 group: 'Internal',     sensitive: true,  required: true,  description: 'Portal → main app service auth', placeholder: 'generate-random-string' },
  { key: 'ADMIN_SECRET',                    label: 'Admin Secret',                   group: 'Internal',     sensitive: true,  required: true,  description: 'Protects this admin panel from public access', placeholder: 'generate-random-string' },

  // URLs
  { key: 'NEXT_PUBLIC_APP_URL',             label: 'App URL',                        group: 'URLs',         sensitive: false, required: true,  description: 'Your main app URL', placeholder: 'https://app.zenith-north.com' },
  { key: 'PORTAL_URL',                      label: 'Portal URL',                     group: 'URLs',         sensitive: false, required: true,  description: 'Your client portal URL', placeholder: 'https://portal.zenith-north.com' },
  { key: 'MAIN_API_URL',                    label: 'Main API URL',                   group: 'URLs',         sensitive: false, required: true,  description: 'Same as App URL — used by portal to call back', placeholder: 'https://app.zenith-north.com' },
]

const GROUPS = [...new Set(ENV_VARS.map(v => v.group))]

// ── Env var row ────────────────────────────────────────────

function EnvRow({ envVar, currentValue, onSave }: {
  envVar:       EnvVar
  currentValue: string
  onSave:       (key: string, value: string) => Promise<void>
}) {
  const [editing,  setEditing]  = useState(false)
  const [value,    setValue]    = useState(currentValue)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [show,     setShow]     = useState(false)

  const isSet = !!currentValue

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(envVar.key, value.trim())
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  function maskValue(val: string) {
    if (!val) return ''
    if (val.length <= 8) return '•'.repeat(val.length)
    return val.slice(0, 4) + '•'.repeat(Math.min(val.length - 8, 24)) + val.slice(-4)
  }

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--admin-border)',
      background: editing ? 'var(--admin-surface2)' : 'transparent',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px', gap: 16, alignItems: 'start' }}>
        {/* Label + status */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-text1)' }}>
              {envVar.label}
            </span>
            {envVar.required && !isSet && (
              <span className="pill pill-danger" style={{ fontSize: 9 }}>Required</span>
            )}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
            {envVar.key}
          </div>
          {envVar.helpUrl && (
            <a href={envVar.helpUrl} target="_blank" rel="noopener" style={{ fontSize: 10, color: 'var(--admin-gold)', textDecoration: 'none' }}>
              Where to find this ↗
            </a>
          )}
        </div>

        {/* Value / input */}
        <div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type={envVar.sensitive && !show ? 'password' : 'text'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={envVar.placeholder}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
                style={{
                  background:   'var(--admin-surface3)',
                  border:       '0.5px solid var(--admin-gold-dim)',
                  borderRadius: 4,
                  padding:      '6px 10px',
                  fontSize:     12,
                  color:        'var(--admin-text1)',
                  fontFamily:   'monospace',
                  outline:      'none',
                  width:        '100%',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--admin-text3)' }}>{envVar.description}</div>
              {envVar.sensitive && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--admin-text3)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />
                  Show value
                </label>
              )}
            </div>
          ) : (
            <div>
              {isSet ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: 'var(--admin-success)',
                  }}>
                    {envVar.sensitive ? maskValue(currentValue) : currentValue}
                  </span>
                  {saved && <span style={{ fontSize: 10, color: 'var(--admin-success)', fontFamily: 'monospace' }}>✓ Saved</span>}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--admin-text3)', fontStyle: 'italic' }}>
                  Not set — {envVar.description}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !value.trim()}
                style={{
                  background:   'var(--admin-gold)',
                  color:        '#0A0A0A',
                  border:       'none',
                  borderRadius: 4,
                  padding:      '5px 10px',
                  fontSize:     11,
                  fontWeight:   500,
                  cursor:       saving ? 'not-allowed' : 'pointer',
                  opacity:      (saving || !value.trim()) ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setValue(currentValue) }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="btn btn-ghost btn-sm"
            >
              {isSet ? 'Edit' : 'Set'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Generate secret helper ─────────────────────────────────

function generateSecret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Page ──────────────────────────────────────────────────

export default function SystemPage() {
  const [envValues, setEnvValues] = useState<Record<string, string>>({})
  const [loading,   setLoading]   = useState(true)
  const [saveMsg,   setSaveMsg]   = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  useEffect(() => {
    const apiUrl   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const adminKey = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

    fetch(`${apiUrl}/api/admin/system/env`, {
      headers: { 'X-Admin-Secret': adminKey },
    })
      .then(r => r.json())
      .then(data => {
        setEnvValues(data.values ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave(key: string, value: string) {
    const apiUrl   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const adminKey = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

    const response = await fetch(`${apiUrl}/api/admin/system/env`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-Admin-Secret': adminKey,
      },
      body: JSON.stringify({ key, value }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error ?? 'Failed to save')
    }

    setEnvValues(prev => ({ ...prev, [key]: value }))
    setSaveMsg(`✓ ${key} saved`)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const requiredCount  = ENV_VARS.filter(v => v.required).length
  const setCount       = ENV_VARS.filter(v => v.required && envValues[v.key]).length
  const allRequired    = setCount === requiredCount

  const filteredVars = activeGroup
    ? ENV_VARS.filter(v => v.group === activeGroup)
    : ENV_VARS

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--admin-text1)' }}>
            System settings
          </h1>
          <div style={{ fontSize: 11, color: 'var(--admin-text3)', fontFamily: 'monospace', marginTop: 3 }}>
            {setCount}/{requiredCount} REQUIRED KEYS SET
            {saveMsg && <span style={{ marginLeft: 16, color: 'var(--admin-success)' }}>{saveMsg}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const secrets = ['CRON_SECRET', 'PORTAL_SECRET', 'SERVICE_SECRET', 'ADMIN_SECRET']
              secrets.forEach(key => {
                if (!envValues[key]) handleSave(key, generateSecret())
              })
            }}
            className="btn btn-ghost btn-sm"
          >
            Auto-generate secrets
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div style={{
        marginBottom: 20,
        padding: '12px 16px',
        borderRadius: 6,
        border: `0.5px solid ${allRequired ? 'rgba(76,175,130,0.3)' : 'rgba(232,168,56,0.3)'}`,
        background: allRequired ? 'rgba(76,175,130,0.05)' : 'rgba(232,168,56,0.05)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: allRequired ? 'var(--admin-success)' : 'var(--admin-warning)', marginBottom: 4 }}>
          {allRequired ? '✓ All required keys are set — ready to deploy' : `⚠ ${requiredCount - setCount} required keys missing`}
        </div>
        <div style={{ fontSize: 11, color: 'var(--admin-text3)' }}>
          {allRequired
            ? 'Your platform is fully configured. All features are operational.'
            : 'Set the missing keys below before deploying. Required keys are marked.'
          }
        </div>
      </div>

      {/* Deployment guide */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">How environment variables work</span>
        </div>
        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--admin-text2)', lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--admin-text1)' }}>For local development:</strong> Values you set here are saved to your Neon database and loaded at startup. Edit your <code style={{ color: 'var(--admin-gold)', fontFamily: 'monospace' }}>.env.local</code> file directly in your project folder — this page shows you what to put there.<br /><br />
          <strong style={{ color: 'var(--admin-text1)' }}>For Vercel deployment:</strong> Go to your Vercel project → Settings → Environment Variables and add each key. Once set in Vercel, the app picks them up automatically on next deploy.<br /><br />
          <strong style={{ color: 'var(--admin-text1)' }}>Sensitive values</strong> (API keys, secrets) are masked here for security. They are never transmitted to the browser.
        </div>
      </div>

      {/* Group filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => setActiveGroup(null)}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: `0.5px solid ${!activeGroup ? 'rgba(201,169,110,0.4)' : 'var(--admin-border)'}`,
            background: !activeGroup ? 'rgba(201,169,110,0.1)' : 'transparent',
            color: !activeGroup ? 'var(--admin-gold)' : 'var(--admin-text3)',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
          }}
        >
          All
        </button>
        {GROUPS.map(group => {
          const groupVars    = ENV_VARS.filter(v => v.group === group)
          const groupSetReq  = groupVars.filter(v => v.required && envValues[v.key]).length
          const groupReqTotal = groupVars.filter(v => v.required).length
          const groupComplete = groupReqTotal === 0 || groupSetReq === groupReqTotal

          return (
            <button
              key={group}
              onClick={() => setActiveGroup(activeGroup === group ? null : group)}
              style={{
                padding:    '4px 12px',
                borderRadius: 4,
                border: `0.5px solid ${activeGroup === group ? 'rgba(201,169,110,0.4)' : 'var(--admin-border)'}`,
                background: activeGroup === group ? 'rgba(201,169,110,0.1)' : 'transparent',
                color: activeGroup === group ? 'var(--admin-gold)' : 'var(--admin-text3)',
                fontSize: 11,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {group}
              <span style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: groupComplete ? 'var(--admin-success)' : 'var(--admin-warning)',
                display: 'inline-block',
              }} />
            </button>
          )
        })}
      </div>

      {/* Env vars table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{activeGroup ?? 'All environment variables'}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text3)' }}>
            {filteredVars.filter(v => envValues[v.key]).length}/{filteredVars.length} set
          </span>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr 120px',
          gap: 16,
          padding: '8px 16px',
          borderBottom: '0.5px solid var(--admin-border)',
          background: 'var(--admin-surface2)',
        }}>
          {['Variable', 'Value', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--admin-text3)', fontFamily: 'monospace' }}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--admin-text3)', fontFamily: 'monospace', fontSize: 11 }}>
            LOADING...
          </div>
        ) : (
          filteredVars.map(envVar => (
            <EnvRow
              key={envVar.key}
              envVar={envVar}
              currentValue={envValues[envVar.key] ?? ''}
              onSave={handleSave}
            />
          ))
        )}
      </div>

      {/* .env.local copy helper */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">.env.local file contents</span>
          <button
            onClick={() => {
              const content = ENV_VARS
                .map(v => `${v.key}=${envValues[v.key] ?? ''}`)
                .join('\n')
              navigator.clipboard.writeText(content)
            }}
            className="btn btn-ghost btn-sm"
          >
            Copy all
          </button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{
            background: '#0D0D0D',
            border: '0.5px solid var(--admin-border)',
            borderRadius: 4,
            padding: '12px 14px',
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'var(--admin-text2)',
            lineHeight: 1.8,
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            {GROUPS.map(group => (
              <div key={group}>
                <div style={{ color: 'var(--admin-text3)', marginTop: 8 }}># {group}</div>
                {ENV_VARS.filter(v => v.group === group).map(v => (
                  <div key={v.key}>
                    <span style={{ color: 'var(--admin-gold)' }}>{v.key}</span>
                    <span style={{ color: 'var(--admin-text3)' }}>=</span>
                    <span style={{ color: envValues[v.key] ? 'var(--admin-success)' : 'var(--admin-text3)' }}>
                      {v.sensitive && envValues[v.key] ? '[set]' : (envValues[v.key] || '')}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--admin-text3)' }}>
            Copy this into <code style={{ color: 'var(--admin-gold)' }}>zenith-north-app/.env.local</code> for local development.
            For production, add each variable in Vercel → your project → Settings → Environment Variables.
          </div>
        </div>
      </div>
    </div>
  )
}
