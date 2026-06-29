'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const SECTIONS = ['Email','SMS','WhatsApp','LinkedIn','Twitter/X','Slack','Teams','Zoom','Custodian'] as const

const CREDENTIAL_FIELDS = {
  // Email
  emailProvider:         { label: 'Email provider',          section: 'Email',      type: 'select',   options: ['Microsoft 365','Google Workspace','Other','None'], sensitive: false },

  // SMS
  twilioAccountSid:      { label: 'Account SID',             section: 'SMS',        type: 'text',     sensitive: true,  placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  twilioAuthToken:       { label: 'Auth Token',              section: 'SMS',        type: 'password', sensitive: true,  placeholder: 'Your Twilio auth token' },
  twilioPhoneNumber:     { label: 'From phone number',       section: 'SMS',        type: 'text',     sensitive: false, placeholder: '+14155551234' },

  // WhatsApp
  whatsappPhoneNumberId: { label: 'Phone Number ID',         section: 'WhatsApp',   type: 'text',     sensitive: false, placeholder: '123456789012345' },
  whatsappAccessToken:   { label: 'Access Token',            section: 'WhatsApp',   type: 'password', sensitive: true,  placeholder: 'EAAxxxxxxx...' },
  whatsappVerifyToken:   { label: 'Verify Token',            section: 'WhatsApp',   type: 'text',     sensitive: true,  placeholder: 'Any string you choose' },

  // LinkedIn
  linkedinOrgUrn:        { label: 'Organization URN',        section: 'LinkedIn',   type: 'text',     sensitive: false, placeholder: 'urn:li:organization:12345678' },
  linkedinWebhookSecret: { label: 'Webhook Secret',          section: 'LinkedIn',   type: 'password', sensitive: true,  placeholder: 'From LinkedIn Developer Console' },

  // Twitter/X
  twitterUserId:         { label: 'Twitter User ID',         section: 'Twitter/X',  type: 'text',     sensitive: false, placeholder: '123456789' },
  twitterConsumerSecret: { label: 'Consumer Secret',         section: 'Twitter/X',  type: 'password', sensitive: true,  placeholder: 'From Twitter Developer Portal' },

  // Slack
  slackTeamId:           { label: 'Team ID',                 section: 'Slack',      type: 'text',     sensitive: false, placeholder: 'T0XXXXXXXX' },
  slackSigningSecret:    { label: 'Signing Secret',          section: 'Slack',      type: 'password', sensitive: true,  placeholder: 'From Slack App settings' },
  slackBotToken:         { label: 'Bot Token',               section: 'Slack',      type: 'password', sensitive: true,  placeholder: 'xoxb-...' },

  // Teams
  msTenantsId:           { label: 'MS Tenant ID',            section: 'Teams',      type: 'text',     sensitive: false, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  msClientId:            { label: 'App Client ID',           section: 'Teams',      type: 'text',     sensitive: false, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  msClientSecret:        { label: 'App Client Secret',       section: 'Teams',      type: 'password', sensitive: true,  placeholder: 'From Azure App Registration' },

  // Zoom
  zoomWebhookSecret:     { label: 'Webhook Secret Token',    section: 'Zoom',       type: 'password', sensitive: true,  placeholder: 'From Zoom App credentials' },
  zoomAccountId:         { label: 'Account ID',              section: 'Zoom',       type: 'text',     sensitive: false, placeholder: 'xxxxxxxxxxxx' },
  zoomClientId:          { label: 'Client ID',               section: 'Zoom',       type: 'text',     sensitive: false, placeholder: 'xxxxxxxxxxxx' },
  zoomClientSecret:      { label: 'Client Secret',           section: 'Zoom',       type: 'password', sensitive: true,  placeholder: 'From Zoom Marketplace' },
  deepgramApiKey:        { label: 'Deepgram API Key',        section: 'Zoom',       type: 'password', sensitive: true,  placeholder: 'For audio transcription' },

  // Custodian
  schwabClientId:        { label: 'Schwab Client ID',        section: 'Custodian',  type: 'text',     sensitive: false, placeholder: 'From Schwab Developer Portal' },
  schwabClientSecret:    { label: 'Schwab Client Secret',    section: 'Custodian',  type: 'password', sensitive: true,  placeholder: '' },
  fidelityKey:           { label: 'Fidelity API Key',        section: 'Custodian',  type: 'password', sensitive: true,  placeholder: '' },
} as const

type FieldKey = keyof typeof CREDENTIAL_FIELDS

const SETUP_INSTRUCTIONS: Record<string, { steps: string[]; docUrl: string }> = {
  SMS: {
    docUrl: 'https://console.twilio.com',
    steps: [
      'Sign up at twilio.com/try-twilio',
      'From the Console Dashboard, copy your Account SID and Auth Token',
      'Buy a phone number: Phone Numbers → Manage → Buy a number',
      'Set the SMS webhook URL to: https://app.zenith-north.com/api/sms/inbound',
    ],
  },
  WhatsApp: {
    docUrl: 'https://developers.facebook.com/apps',
    steps: [
      'Create a Meta App at developers.facebook.com → My Apps → Create App',
      'Add WhatsApp product to your app',
      'Under WhatsApp → API Setup, copy the Phone Number ID',
      'Create a System User token with whatsapp_business_messaging permission',
      'Set webhook URL: https://app.zenith-north.com/api/channels/whatsapp',
      'Set your Verify Token to any string — use the same one here',
      'Subscribe to: messages webhook field',
    ],
  },
  LinkedIn: {
    docUrl: 'https://developer.linkedin.com',
    steps: [
      'Create an app at developer.linkedin.com → My Apps → Create app',
      'Request Marketing Developer Platform product access',
      'Under Webhooks, add URL: https://app.zenith-north.com/api/channels/linkedin',
      'Subscribe to: OrganizationSocialActionEvent, MessageEvent',
      'Copy the Webhook Secret from the verification section',
      'Find your Org URN in the Company Admin page URL',
    ],
  },
  'Twitter/X': {
    docUrl: 'https://developer.twitter.com/en/portal/dashboard',
    steps: [
      'Apply for Elevated access at developer.twitter.com',
      'Create a project and app',
      'Enable Account Activity API subscription',
      'Set webhook URL: https://app.zenith-north.com/api/channels/twitter',
      'Copy the Consumer Secret from your app keys',
      'Find the User ID at twitterid.com or via API',
    ],
  },
  Slack: {
    docUrl: 'https://api.slack.com/apps',
    steps: [
      'Create a Slack app at api.slack.com/apps → Create New App',
      'Under Event Subscriptions, enable and set URL: https://app.zenith-north.com/api/channels/slack',
      'Subscribe to bot events: message.channels, message.groups, message.im',
      'Under Basic Information, copy the Signing Secret',
      'Install the app to your workspace and copy the Bot Token',
      'Find Team ID in Slack → workspace settings URL',
    ],
  },
  Teams: {
    docUrl: 'https://portal.azure.com',
    steps: [
      'Register an app in Azure Portal → App Registrations → New registration',
      'Add API permissions: ChannelMessage.Read.All, Chat.Read.All (Application)',
      'Grant admin consent for those permissions',
      'Create a client secret under Certificates & Secrets',
      'Copy the Tenant ID, Client ID, and Client Secret',
      'Use Graph API to create webhook subscriptions per channel',
    ],
  },
  Zoom: {
    docUrl: 'https://marketplace.zoom.us',
    steps: [
      'Create a Server-to-Server OAuth app at marketplace.zoom.us → Build App',
      'Add scopes: cloud_recording:read:admin, recording:read:admin',
      'Activate the app and copy Account ID, Client ID, Client Secret',
      'Create a Webhook-only app for event subscriptions',
      'Set webhook URL: https://app.zenith-north.com/api/zoom/recording',
      'Subscribe to: recording.completed event',
      'Copy the Webhook Secret Token from the Features tab',
      'Add Deepgram API key for audio transcription (deepgram.com)',
    ],
  },
}

const WEBHOOK_URLS: Record<string, string> = {
  SMS:        'https://app.zenith-north.com/api/sms/inbound',
  WhatsApp:   'https://app.zenith-north.com/api/channels/whatsapp',
  LinkedIn:   'https://app.zenith-north.com/api/channels/linkedin',
  'Twitter/X':'https://app.zenith-north.com/api/channels/twitter',
  Slack:      'https://app.zenith-north.com/api/channels/slack',
  Teams:      'https://app.zenith-north.com/api/channels/teams',
  Zoom:       'https://app.zenith-north.com/api/zoom/recording',
}

type CredentialState = Partial<Record<FieldKey, string>>
type SavedState = Partial<Record<FieldKey, { isSet: boolean; maskedValue: string }>>

export default function FirmCredentialsPage() {
  const { id: firmId } = useParams<{ id: string }>()
  const [activeSection, setActiveSection] = useState<string>('Email')
  const [values,   setValues]   = useState<CredentialState>({})
  const [saved,    setSaved]    = useState<SavedState>({})
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [testing,  setTesting]  = useState<string | null>(null)
  const [testMsg,  setTestMsg]  = useState<{ channel: string; ok: boolean; msg: string } | null>(null)
  const [copied,   setCopied]   = useState<string | null>(null)

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
  const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

  // Load existing credentials
  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(`${API_BASE}/api/admin/tenants/${firmId}/credentials`, {
          headers: { 'X-Admin-Secret': ADMIN_KEY }
        })
        if (resp.ok) {
          const data = await resp.json()
          setSaved(data)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [firmId])

  // Fields for current section
  const sectionFields = Object.entries(CREDENTIAL_FIELDS)
    .filter(([, def]) => def.section === activeSection) as [FieldKey, typeof CREDENTIAL_FIELDS[FieldKey]][]

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)

    // Only send fields that have been changed in this session
    const changedFields: CredentialState = {}
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') {
        changedFields[key as FieldKey] = value
      }
    }

    if (Object.keys(changedFields).length === 0) {
      setSaving(false)
      setSaveMsg('No changes to save')
      return
    }

    try {
      const resp = await fetch(`${API_BASE}/api/admin/tenants/${firmId}/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': ADMIN_KEY,
        },
        body: JSON.stringify({ credentials: changedFields }),
      })
      const data = await resp.json()
      if (resp.ok) {
        setSaveMsg(`✓ ${data.saved} credential${data.saved !== 1 ? 's' : ''} saved`)
        setValues({}) // Clear local state — reload from server
        const reloadResp = await fetch(`${API_BASE}/api/admin/tenants/${firmId}/credentials`, {
          headers: { 'X-Admin-Secret': ADMIN_KEY }
        })
        if (reloadResp.ok) setSaved(await reloadResp.json())
      } else {
        setSaveMsg(`✗ ${data.error ?? 'Save failed'}`)
      }
    } catch (err) {
      setSaveMsg('✗ Network error')
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 4000)
  }

  async function handleTest(channel: string) {
    setTesting(channel)
    setTestMsg(null)
    try {
      const resp = await fetch(`${API_BASE}/api/admin/tenants/${firmId}/credentials/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_KEY },
        body: JSON.stringify({ channel }),
      })
      const data = await resp.json()
      setTestMsg({ channel, ok: data.success, msg: data.message ?? data.error ?? '' })
    } catch {
      setTestMsg({ channel, ok: false, msg: 'Network error' })
    }
    setTesting(null)
    setTimeout(() => setTestMsg(null), 5000)
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const instructions = SETUP_INSTRUCTIONS[activeSection]
  const webhookUrl   = WEBHOOK_URLS[activeSection]

  const s: Record<string, React.CSSProperties> = {
    card:       { background: 'var(--admin-surface)', border: '0.5px solid var(--admin-border)', borderRadius: 10, overflow: 'hidden' },
    cardHeader: { padding: '12px 16px', borderBottom: '0.5px solid var(--admin-border)', background: 'var(--admin-surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    input:      { width: '100%', padding: '8px 12px', border: '0.5px solid var(--admin-border-2)', borderRadius: 6, background: 'var(--admin-surface2)', color: 'var(--admin-text1)', fontSize: 13, outline: 'none', fontFamily: 'inherit' },
    label:      { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: 'var(--admin-text3)', marginBottom: 5 },
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href={`/firms/${firmId}`} style={{ fontSize: 13, color: 'var(--admin-text3)' }}>← Back to firm</Link>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--admin-text1)' }}>Channel credentials</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20 }}>

        {/* Section nav */}
        <div>
          {SECTIONS.map(section => {
            const sectionCreds = Object.entries(CREDENTIAL_FIELDS).filter(([, def]) => def.section === section)
            const setCount = sectionCreds.filter(([key]) => saved[key as FieldKey]?.isSet).length
            return (
              <div
                key={section}
                onClick={() => setActiveSection(section)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: 4,
                  background: activeSection === section ? 'var(--admin-gold-bg)' : 'transparent',
                  border: activeSection === section ? '0.5px solid var(--admin-gold-border)' : '0.5px solid transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: activeSection === section ? 'var(--admin-gold)' : 'var(--admin-text2)', fontWeight: activeSection === section ? 600 : 400 }}>
                  {section}
                </span>
                {setCount > 0 && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(5,150,105,0.15)', color: '#059669', fontWeight: 600 }}>
                    {setCount}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Webhook URL */}
          {webhookUrl && (
            <div style={{ ...s.card }}>
              <div style={s.cardHeader}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)' }}>
                  Webhook URL for {activeSection}
                </span>
              </div>
              <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <code style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: 'var(--admin-text1)', background: 'var(--admin-surface2)', padding: '8px 12px', borderRadius: 6, border: '0.5px solid var(--admin-border)' }}>
                  {webhookUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  style={{ padding: '8px 14px', border: '0.5px solid var(--admin-border)', borderRadius: 6, background: 'transparent', color: 'var(--admin-text2)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                >
                  {copied === 'webhook' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Credentials form */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)' }}>
                {activeSection} credentials
              </span>
              {saveMsg && (
                <span style={{ fontSize: 12, color: saveMsg.startsWith('✓') ? '#059669' : '#DC2626' }}>
                  {saveMsg}
                </span>
              )}
            </div>

            <div style={{ padding: 20 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--admin-text3)', fontSize: 13 }}>Loading...</div>
              ) : (
                sectionFields.map(([key, def]) => {
                  const savedCred = saved[key]
                  const hasValue  = !!values[key]
                  const isSet     = savedCred?.isSet

                  return (
                    <div key={key} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <label style={s.label}>{def.label}</label>
                        {isSet && !hasValue && (
                          <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>✓ Set</span>
                        )}
                      </div>

                      {def.type === 'select' ? (
                        <select
                          value={values[key] ?? savedCred?.maskedValue ?? ''}
                          onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                          style={s.input}
                        >
                          <option value="">Select...</option>
                          {(def as any).options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : def.type === 'readonly' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <code style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: 'var(--admin-text1)', background: 'var(--admin-surface2)', padding: '8px 12px', borderRadius: 6, border: '0.5px solid var(--admin-border)' }}>
                            {savedCred?.maskedValue ?? '—'}
                          </code>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input
                            type={def.type === 'password' && !values[key] ? 'password' : 'text'}
                            value={values[key] ?? ''}
                            onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                            placeholder={isSet ? (def.sensitive ? savedCred?.maskedValue : savedCred?.maskedValue) : ((def as any).placeholder ?? '')}
                            style={{ ...s.input, paddingRight: isSet ? 70 : 12 }}
                          />
                          {isSet && !values[key] && (
                            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#059669', fontWeight: 700, background: 'rgba(5,150,105,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                              SET
                            </span>
                          )}
                        </div>
                      )}

                      {def.sensitive && (
                        <div style={{ fontSize: 10, color: 'var(--admin-text3)', marginTop: 4 }}>
                          Stored encrypted with AES-256-GCM. Never logged or exposed.
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving || Object.keys(values).length === 0}
                  style={{
                    padding: '9px 20px', border: 'none', borderRadius: 6,
                    background: Object.keys(values).length > 0 ? 'var(--admin-gold)' : 'var(--admin-border)',
                    color: Object.keys(values).length > 0 ? '#0A0A0A' : 'var(--admin-text3)',
                    fontSize: 13, fontWeight: 600,
                    cursor: Object.keys(values).length > 0 ? 'pointer' : 'not-allowed',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : `Save ${Object.keys(values).length > 0 ? `(${Object.keys(values).length} changed)` : ''}`}
                </button>

                {/* Test buttons */}
                {activeSection === 'SMS' && (
                  <button
                    onClick={() => handleTest('twilio')}
                    disabled={testing === 'twilio'}
                    style={{ padding: '9px 16px', border: '0.5px solid var(--admin-border)', borderRadius: 6, background: 'transparent', color: 'var(--admin-text2)', fontSize: 13, cursor: 'pointer' }}
                  >
                    {testing === 'twilio' ? 'Testing...' : 'Test Twilio connection'}
                  </button>
                )}
                {activeSection === 'Zoom' && (
                  <button
                    onClick={() => handleTest('deepgram')}
                    disabled={testing === 'deepgram'}
                    style={{ padding: '9px 16px', border: '0.5px solid var(--admin-border)', borderRadius: 6, background: 'transparent', color: 'var(--admin-text2)', fontSize: 13, cursor: 'pointer' }}
                  >
                    {testing === 'deepgram' ? 'Testing...' : 'Test Deepgram connection'}
                  </button>
                )}
              </div>

              {testMsg && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: testMsg.ok ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)', border: `0.5px solid ${testMsg.ok ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}`, fontSize: 12, color: testMsg.ok ? '#059669' : '#DC2626' }}>
                  {testMsg.ok ? '✓' : '✗'} {testMsg.msg}
                </div>
              )}
            </div>
          </div>

          {/* Setup instructions */}
          {instructions && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)' }}>
                  Setup guide — {activeSection}
                </span>
                <a href={instructions.docUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--admin-gold)', textDecoration: 'none' }}>
                  Open developer console →
                </a>
              </div>
              <div style={{ padding: 16 }}>
                {instructions.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--admin-gold-bg)', border: '0.5px solid var(--admin-gold-border)', color: 'var(--admin-gold)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--admin-text2)', lineHeight: 1.5, paddingTop: 2 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
