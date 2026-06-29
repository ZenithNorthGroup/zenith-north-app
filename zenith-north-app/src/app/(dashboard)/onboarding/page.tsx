'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { IconCheck, IconLoader2, IconArrowRight } from '@tabler/icons-react'

const STEPS = [
  { id: 'firm',     title: 'Your firm',           desc: 'Basic details about your RIA' },
  { id: 'role',     title: 'Your role',            desc: 'How you use the platform' },
  { id: 'channels', title: 'Communication setup',  desc: 'Which channels you use with clients' },
  { id: 'done',     title: "You're ready",          desc: 'Platform configured for your firm' },
] as const

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useUser()

  const [step,  setStep]  = useState(0)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const [form, setForm] = useState({
    firmName:    '',
    crd:         '',
    firmAddress: '',
    aum:         '',
    role:        'owner',
    isCco:       true,
    title:       '',
    emailProvider: 'Microsoft 365',
    useSMS:      false,
    useZoom:     false,
  })

  function update(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleFinish() {
    setSaving(true)
    setError(null)

    try {
      const slug = form.firmName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'my-firm'

      const resp = await fetch('/api/admin/tenants/create', {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'X-Admin-Secret': process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '',
        },
        body: JSON.stringify({
          firmName:      form.firmName,
          slug:          slug + '-' + Date.now().toString(36),
          crd:           form.crd,
          firmAddress:   form.firmAddress,
          aum:           form.aum,
          ccoName:       user?.fullName ?? '',
          ccoEmail:      user?.primaryEmailAddress?.emailAddress ?? '',
          ccoTitle:      form.title,
          emailProvider: form.emailProvider,
          team: [{
            name:        user?.fullName ?? '',
            email:       user?.primaryEmailAddress?.emailAddress ?? '',
            role:        form.role,
            isCco:       form.isCco,
            clientScope: 'all',
            title:       form.title,
          }],
        }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Setup failed')

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    border: '1px solid #E5E7EB', borderRadius: 8,
    background: '#fff', color: '#111827',
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: '#6B7280', marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F4F5F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <svg width="40" height="50" viewBox="0 0 40 50" fill="none" style={{ margin: '0 auto 12px' }}>
            <rect x="2" y="2" width="36" height="46" stroke="#C9A96E" strokeWidth="1.5" fill="none"/>
            <rect x="5" y="5" width="30" height="40" stroke="#C9A96E" strokeWidth="0.5" fill="none" opacity="0.4"/>
            <line x1="8" y1="42" x2="32" y2="8" stroke="#C9A96E" strokeWidth="0.75" opacity="0.5"/>
            <text x="7" y="25" fontFamily="Inter" fontWeight="300" fontSize="17" fill="#C9A96E">Z</text>
            <text x="18" y="41" fontFamily="Inter" fontWeight="300" fontSize="17" fill="#9CA3AF">N</text>
          </svg>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>Zenith North — Setup</div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? '#C9A96E' : '#E5E7EB', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Card */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C9A96E', marginBottom: 6 }}>
              Step {step + 1} of {STEPS.length}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: 0 }}>{STEPS[step].title}</h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>{STEPS[step].desc}</p>
          </div>

          <div style={{ padding: 28 }}>

            {/* Step 0 — Firm info */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>Firm legal name *</label>
                  <input value={form.firmName} onChange={e => update('firmName', e.target.value)} placeholder="Acme Advisory LLC" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>SEC CRD number</label>
                    <input value={form.crd} onChange={e => update('crd', e.target.value)} placeholder="123456" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>AUM (approximate)</label>
                    <select value={form.aum} onChange={e => update('aum', e.target.value)} style={inputStyle}>
                      <option value="">Select...</option>
                      {['Under $50M','$50M–$150M','$150M–$500M','$500M–$1B','Over $1B'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Business address</label>
                  <input value={form.firmAddress} onChange={e => update('firmAddress', e.target.value)} placeholder="100 Market St, San Francisco CA 94105" style={inputStyle} />
                </div>
              </div>
            )}

            {/* Step 1 — Role */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>Your title</label>
                  <input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Managing Partner & CCO" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Your role</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { value: 'owner', label: 'Owner / Principal', desc: 'Full access to everything' },
                      { value: 'cco',   label: 'CCO',               desc: 'Compliance-first view' },
                      { value: 'advisor', label: 'Advisor',          desc: 'Client-focused view' },
                    ].map(r => (
                      <div
                        key={r.value}
                        onClick={() => update('role', r.value)}
                        style={{
                          padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                          border: form.role === r.value ? '1.5px solid #C9A96E' : '1px solid #E5E7EB',
                          background: form.role === r.value ? 'rgba(201,169,110,0.06)' : '#fff',
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: form.role === r.value ? '#A8843A' : '#111827' }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{r.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isCco} onChange={e => update('isCco', e.target.checked)} style={{ width: 16, height: 16 }} />
                  <div>
                    <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>I am the designated CCO</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Required by SEC — every RIA must designate one CCO</div>
                  </div>
                </label>
              </div>
            )}

            {/* Step 2 — Channels */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>Email platform</label>
                  <select value={form.emailProvider} onChange={e => update('emailProvider', e.target.value)} style={inputStyle}>
                    {['Microsoft 365','Google Workspace','Other','We don\'t use email'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, marginBottom: 10 }}>Other channels (you can configure these later)</label>
                  {[
                    { key: 'useSMS',  label: 'SMS with clients',    desc: 'Text message archiving via Twilio' },
                    { key: 'useZoom', label: 'Zoom video calls',    desc: 'Recording + auto-transcription' },
                  ].map(ch => (
                    <label key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form[ch.key as keyof typeof form] as boolean} onChange={e => update(ch.key, e.target.checked)} style={{ width: 16, height: 16 }} />
                      <div>
                        <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{ch.label}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{ch.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ padding: 14, borderRadius: 8, background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)', fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                  All communication channels are archived per <strong style={{ color: '#111827' }}>SEC Rule 204-2</strong> and monitored by AI for compliance issues. You can add credentials for each channel in Settings → Integrations.
                </div>
              </div>
            )}

            {/* Step 3 — Done */}
            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(5,150,105,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <IconCheck size={28} style={{ color: '#059669' }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 10 }}>
                  {form.firmName} is ready
                </h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, marginBottom: 24 }}>
                  Your firm is configured. Your compliance engine will run tonight and generate your first set of compliance items.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                  {[
                    'Client onboarding workflows — ready',
                    'Compliance monitoring — active',
                    'Communication archiving — configured',
                    'WSP — generate from Settings',
                    'Team members — invite from Settings',
                  ].map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                      <IconCheck size={14} style={{ color: '#059669', flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                </div>
                {error && (
                  <div style={{ marginTop: 16, padding: 12, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '18px 28px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between' }}>
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)} style={{ padding: '9px 18px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                Back
              </button>
            ) : <div />}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 0 && !form.firmName.trim()}
                style={{
                  padding: '9px 24px', border: 'none', borderRadius: 8,
                  background: (step === 0 && !form.firmName.trim()) ? '#E5E7EB' : '#C9A96E',
                  color: (step === 0 && !form.firmName.trim()) ? '#9CA3AF' : '#000',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                Continue <IconArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving}
                style={{
                  padding: '9px 24px', border: 'none', borderRadius: 8,
                  background: '#C9A96E', color: '#000',
                  fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {saving ? <><IconLoader2 size={14} className="animate-spin" /> Setting up...</> : <>Go to dashboard <IconArrowRight size={14} /></>}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9CA3AF' }}>
          Need help? Email <a href="mailto:support@zenith-north.com" style={{ color: '#C9A96E' }}>support@zenith-north.com</a>
        </p>
      </div>
    </div>
  )
}
