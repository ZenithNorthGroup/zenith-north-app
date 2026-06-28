'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────

type TeamMember = {
  id:          string
  name:        string
  email:       string
  title:       string
  role:        'owner' | 'cco' | 'advisor' | 'operations' | 'associate'
  isCco:       boolean
  clientScope: 'all' | 'own' | 'assigned'
}

// ── Role config ────────────────────────────────────────────

const ROLES = [
  {
    value: 'owner',
    label: 'Owner / Principal',
    desc:  'Full access to everything. Sees all clients, compliance, and financials.',
    color: '#C9A96E',
  },
  {
    value: 'cco',
    label: 'CCO',
    desc:  'Compliance-first view. Sees compliance queue, AI flags, exam packages, audit center.',
    color: '#DC2626',
  },
  {
    value: 'advisor',
    label: 'Advisor',
    desc:  'Client-first view. Sees their book of business and active onboardings.',
    color: '#059669',
  },
  {
    value: 'operations',
    label: 'Operations',
    desc:  'Workflow-first view. Sees tasks, onboarding pipeline, documents, calendar.',
    color: '#3B82F6',
  },
  {
    value: 'associate',
    label: 'Associate Advisor',
    desc:  'Read-only client view. Assigned clients only. Cannot approve workflows.',
    color: '#6B7280',
  },
]

// ── Wizard steps ───────────────────────────────────────────

const REGULAR_STEPS = [
  {
    id: 'firm_basics',
    title: 'Firm information',
    subtitle: 'Basic details about the RIA',
    fields: [
      { key: 'firmName',     label: 'Firm legal name',    type: 'text',   placeholder: 'Wright Advisory LLC' },
      { key: 'crd',          label: 'SEC CRD number',     type: 'text',   placeholder: '123456' },
      { key: 'firmAddress',  label: 'Business address',   type: 'text',   placeholder: '100 Market St, San Francisco CA 94105' },
      { key: 'aum',          label: 'AUM (approximate)',  type: 'select', options: ['Under $50M','$50M–$150M','$150M–$500M','$500M–$1B','Over $1B'] },
      { key: 'advisorCount', label: 'Number of advisors', type: 'select', options: ['1–3','4–7','8–15','16–30','30+'] },
    ],
  },
  { id: 'team', title: 'Team & roles', subtitle: 'Add team members and assign their roles — determines what each person sees when they log in', fields: [] },
  {
    id: 'channels',
    title: 'Communication channels',
    subtitle: 'Sets which channels are enabled, monitored, and appear in the WSP',
    fields: [
      { key: 'emailProvider', label: 'Email platform',     type: 'select', options: ['Microsoft 365','Google Workspace','Other (manual journal)','Email not used'] },
      { key: 'useSMS',        label: 'SMS with clients',   type: 'select', options: ['Yes — needs Twilio setup','No — we prohibit SMS'] },
      { key: 'useZoom',       label: 'Zoom / video calls', type: 'select', options: ['Yes — record & archive','No'] },
      { key: 'useSlack',      label: 'Slack (internal)',   type: 'select', options: ['Yes — archive Slack','No'] },
      { key: 'useLinkedIn',   label: 'LinkedIn (advisors)',type: 'select', options: ['Yes — capture posts & DMs','No / policy prohibits'] },
    ],
  },
  {
    id: 'priorities',
    title: 'Top compliance priorities',
    subtitle: 'Reorders the dashboard and surfaces the right modules first',
    fields: [
      { key: 'priority1',   label: 'Priority #1',              type: 'select', options: ['Client onboarding speed','SEC exam readiness','Communication compliance','Annual review tracking','Document management'] },
      { key: 'priority2',   label: 'Priority #2',              type: 'select', options: ['SEC exam readiness','Communication compliance','Annual review tracking','Document management','Client onboarding speed'] },
      { key: 'currentPain', label: 'Biggest pain point today', type: 'textarea', placeholder: 'e.g. "We have no way to track annual reviews"' },
    ],
  },
  {
    id: 'migration',
    title: 'Current data & migration',
    subtitle: 'Determines setup fee and whether in-person visit is needed',
    fields: [
      { key: 'currentCRM',         label: 'Current CRM / system',        type: 'select', options: ['Redtail','Salesforce','Wealthbox','Junxure','Practifi','Spreadsheets / Excel','Paper files','Nothing — starting fresh'] },
      { key: 'clientRecordCount',  label: 'Client records to migrate',   type: 'select', options: ['Under 25','25–75','75–200','200–500','Over 500'] },
      { key: 'documentState',      label: 'Document storage today',      type: 'select', options: ['Fully digital (cloud)','Mix of digital and paper','Mostly paper / filing cabinets','Each advisor keeps their own files'] },
    ],
  },
  {
    id: 'modules',
    title: 'Module selection',
    subtitle: 'Toggle modules on/off — generates their monthly price',
    fields: [
      { key: 'moduleCommsArchiving', label: 'Communication archiving (+$299/mo)', type: 'select', options: ['Yes — include','No — exclude'] },
      { key: 'moduleAI',             label: 'AI assistant + scanning (+$199/mo)',  type: 'select', options: ['Yes — include','No — exclude'] },
      { key: 'moduleClientPortal',   label: 'Client portal (+$149/mo)',            type: 'select', options: ['Yes — include','No — exclude'] },
      { key: 'moduleDocuments',      label: 'Document management (+$99/mo)',        type: 'select', options: ['Yes — include','No — exclude'] },
      { key: 'moduleReports',        label: 'Reports + analytics (+$149/mo)',       type: 'select', options: ['Yes — include','No — exclude'] },
      { key: 'moduleIntegrations',   label: 'Integrations (+$199/mo)',             type: 'select', options: ['Yes — include','No — exclude'] },
    ],
  },
  {
    id: 'training',
    title: 'Training package',
    subtitle: 'Select training option to include in the quote',
    fields: [
      { key: 'trainingOption', label: 'Training type',          type: 'select',   options: ['Online training ($2,500)','On-site training ($7,500)','No training'] },
      { key: 'trainingNotes',  label: 'Notes for training team',type: 'textarea', placeholder: 'e.g. "4 advisors + 1 CCO, prefer mornings"' },
    ],
  },
]

const BASE_PRICE = 799
const MODULE_PRICES: Record<string, number> = {
  moduleCommsArchiving: 299, moduleAI: 199, moduleClientPortal: 149,
  moduleDocuments: 99, moduleReports: 149, moduleIntegrations: 199,
}

function calcSetupFee(data: Record<string, string>) {
  const crm = data.currentCRM ?? ''
  const docs = data.documentState ?? ''
  if (crm === 'Paper files' || docs === 'Mostly paper / filing cabinets')
    return { min: 20000, max: 50000, label: 'Full analog — in-person required', inPerson: true }
  if (docs === 'Mix of digital and paper' || crm === 'Spreadsheets / Excel')
    return { min: 10000, max: 20000, label: 'Hybrid migration', inPerson: false }
  if (crm === 'Nothing — starting fresh')
    return { min: 2500, max: 5000, label: 'No migration — fresh start', inPerson: false }
  return { min: 5000, max: 10000, label: 'Digital CRM migration', inPerson: false }
}

// ── Team builder component ─────────────────────────────────

function TeamStep({ team, setTeam }: { team: TeamMember[]; setTeam: (t: TeamMember[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', title: '', role: 'advisor' as TeamMember['role'], isCco: false, clientScope: 'all' as TeamMember['clientScope'] })

  const hasCco = team.some(m => m.isCco)

  function addMember() {
    if (!form.name || !form.email) return
    const member: TeamMember = { id: crypto.randomUUID(), ...form }
    setTeam([...team, member])
    setForm({ name: '', email: '', title: '', role: 'advisor', isCco: false, clientScope: 'all' })
    setAdding(false)
  }

  function removeMember(id: string) {
    setTeam(team.filter(m => m.id !== id))
  }

  function toggleCco(id: string) {
    setTeam(team.map(m => ({ ...m, isCco: m.id === id ? !m.isCco : false })))
  }

  const s: Record<string, React.CSSProperties> = {
    input: { width: '100%', padding: '7px 10px', border: '0.5px solid var(--admin-border-2)', borderRadius: 6, background: 'var(--admin-surface2)', color: 'var(--admin-text1)', fontSize: 13, outline: 'none', fontFamily: 'inherit' },
    label: { display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: 'var(--admin-text3)', marginBottom: 5 },
    fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  }

  return (
    <div>
      {/* CCO warning */}
      {!hasCco && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '0.5px solid rgba(220,38,38,0.25)', fontSize: 12, color: 'var(--admin-danger)' }}>
          ⚠ Every RIA must designate a CCO. Mark one team member as CCO before completing setup.
        </div>
      )}

      {/* Team list */}
      {team.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text3)', fontSize: 13, border: '0.5px dashed var(--admin-border-2)', borderRadius: 8, marginBottom: 16 }}>
          No team members added yet. Add the owner first.
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {team.map(member => {
            const roleCfg = ROLES.find(r => r.value === member.role)
            return (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '0.5px solid var(--admin-border)', borderRadius: 8, marginBottom: 8, background: 'var(--admin-surface)' }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: (roleCfg?.color ?? '#888') + '20', color: roleCfg?.color ?? '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text1)' }}>{member.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--admin-text3)' }}>{member.email}</div>
                </div>

                {/* Role badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 20, background: (roleCfg?.color ?? '#888') + '15', color: roleCfg?.color ?? '#888', border: `0.5px solid ${roleCfg?.color ?? '#888'}40` }}>
                    {roleCfg?.label ?? member.role}
                  </span>
                  {member.isCco && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '0.5px solid rgba(220,38,38,0.3)' }}>
                      CCO
                    </span>
                  )}
                </div>

                {/* CCO toggle */}
                <button
                  onClick={() => toggleCco(member.id)}
                  title={member.isCco ? 'Remove CCO designation' : 'Designate as CCO'}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--admin-border-2)', background: member.isCco ? 'rgba(220,38,38,0.08)' : 'transparent', color: member.isCco ? '#DC2626' : 'var(--admin-text3)', fontSize: 11, cursor: 'pointer' }}
                >
                  {member.isCco ? '✓ CCO' : 'Set CCO'}
                </button>

                {/* Remove */}
                <button onClick={() => removeMember(member.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '0.5px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text3)', fontSize: 11, cursor: 'pointer' }}>
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add member form */}
      {adding ? (
        <div style={{ padding: 16, border: '0.5px solid var(--admin-border-2)', borderRadius: 8, background: 'var(--admin-surface2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text1)', marginBottom: 14 }}>Add team member</div>

          <div style={s.fieldRow}>
            <div>
              <label style={s.label}>Full name</label>
              <input style={s.input} placeholder="James Wright" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Work email</label>
              <input style={s.input} placeholder="james@firm.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>

          <div style={s.fieldRow}>
            <div>
              <label style={s.label}>Title / position</label>
              <input style={s.input} placeholder="Managing Partner" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Client scope (for advisors)</label>
              <select style={s.input} value={form.clientScope} onChange={e => setForm(f => ({ ...f, clientScope: e.target.value as TeamMember['clientScope'] }))}>
                <option value="all">All clients</option>
                <option value="own">Own clients only</option>
                <option value="assigned">Assigned clients only</option>
              </select>
            </div>
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>Role — determines dashboard layout & access</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ROLES.map(r => (
                <div
                  key={r.value}
                  onClick={() => setForm(f => ({ ...f, role: r.value as TeamMember['role'] }))}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `0.5px solid ${form.role === r.value ? r.color : 'var(--admin-border)'}`,
                    background: form.role === r.value ? r.color + '10' : 'var(--admin-surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: form.role === r.value ? r.color : 'var(--admin-text1)', marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--admin-text3)', lineHeight: 1.4 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CCO toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 13, color: 'var(--admin-text1)' }}>
            <input
              type="checkbox"
              checked={form.isCco}
              onChange={e => setForm(f => ({ ...f, isCco: e.target.checked }))}
            />
            Designate as CCO (required by SEC — only one per firm)
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addMember} disabled={!form.name || !form.email} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: 'var(--admin-gold)', color: '#0A0A0A', fontSize: 13, fontWeight: 600, cursor: (!form.name || !form.email) ? 'not-allowed' : 'pointer', opacity: (!form.name || !form.email) ? 0.5 : 1 }}>
              Add to team
            </button>
            <button onClick={() => setAdding(false)} style={{ padding: '8px 14px', border: '0.5px solid var(--admin-border-2)', borderRadius: 6, background: 'transparent', color: 'var(--admin-text2)', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{ width: '100%', padding: '10px', border: '0.5px dashed var(--admin-border-2)', borderRadius: 8, background: 'transparent', color: 'var(--admin-text3)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          + Add team member
        </button>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '0.5px solid var(--admin-border-2)',
  borderRadius: 6,
  background: 'var(--admin-surface2)',
  color: 'var(--admin-text1)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--admin-surface)',
  border: '0.5px solid var(--admin-border)',
  borderRadius: 10,
  overflow: 'hidden',
}

const cardHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '0.5px solid var(--admin-border)',
  background: 'var(--admin-surface2)',
}

export default function FirmSetupPage() {
  const router = useRouter()
  const [step,   setStep]   = useState(0)
  const [data,   setData]   = useState<Record<string, string>>({})
  const [team,   setTeam]   = useState<TeamMember[]>([])
  const [saving, setSaving] = useState(false)

  const currentStep = REGULAR_STEPS[step]
  const isLast = step === REGULAR_STEPS.length - 1
  const isTeamStep = currentStep.id === 'team'

  function update(key: string, value: string) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  const monthlyAddons = Object.entries(MODULE_PRICES)
    .filter(([key]) => data[key]?.startsWith('Yes'))
    .reduce((sum, [, price]) => sum + price, 0)
  const monthlyTotal = BASE_PRICE + monthlyAddons
  const setup    = calcSetupFee(data)
  const training = data.trainingOption?.includes('Online') ? 2500 : data.trainingOption?.includes('On-site') ? 7500 : 0
  const firstYearTotal = monthlyTotal * 12 + setup.max + training

  const hasCco = team.some(m => m.isCco)
  const canContinue = isTeamStep ? (team.length > 0 && hasCco) : true

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 1200))
    setSaving(false)
    router.push('/firms')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--admin-text1)', marginBottom: 4 }}>
          New firm setup
        </h1>
        <p style={{ fontSize: 13, color: 'var(--admin-text3)' }}>
          Complete this with the CCO on your setup call. Every answer configures the platform for their firm.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* Wizard */}
        <div>
          {/* Progress */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
            {REGULAR_STEPS.map((s, i) => (
              <div
                key={s.id}
                onClick={() => i <= step && setStep(i)}
                title={s.title}
                style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--admin-gold)' : 'var(--admin-border)', cursor: i <= step ? 'pointer' : 'default', transition: 'background 0.2s' }}
              />
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ ...cardHeaderStyle, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Step {step + 1} of {REGULAR_STEPS.length}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--admin-text1)' }}>{currentStep.title}</div>
              <div style={{ fontSize: 12, color: 'var(--admin-text3)' }}>{currentStep.subtitle}</div>
            </div>

            <div style={{ padding: 20 }}>
              {isTeamStep ? (
                <TeamStep team={team} setTeam={setTeam} />
              ) : (
                currentStep.fields.map((field: any) => (
                  <div key={field.key} style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--admin-text3)', marginBottom: 6 }}>
                      {field.label}
                    </label>
                    {field.type === 'select' ? (
                      <select value={data[field.key] ?? ''} onChange={e => update(field.key, e.target.value)} style={inputStyle}>
                        <option value="">Select...</option>
                        {field.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea value={data[field.key] ?? ''} onChange={e => update(field.key, e.target.value)} placeholder={field.placeholder} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    ) : (
                      <input type="text" value={data[field.key] ?? ''} onChange={e => update(field.key, e.target.value)} placeholder={field.placeholder} style={inputStyle} />
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ padding: '8px 16px', border: '0.5px solid var(--admin-border-2)', borderRadius: 6, background: 'transparent', color: step === 0 ? 'var(--admin-text3)' : 'var(--admin-text1)', fontSize: 13, cursor: step === 0 ? 'default' : 'pointer' }}
              >
                ← Back
              </button>

              {isTeamStep && !hasCco && (
                <div style={{ fontSize: 11, color: 'var(--admin-danger)' }}>⚠ Designate a CCO to continue</div>
              )}

              {isLast ? (
                <button onClick={handleSave} disabled={saving || !canContinue} style={{ padding: '8px 24px', border: 'none', borderRadius: 6, background: 'var(--admin-gold)', color: '#0A0A0A', fontSize: 13, fontWeight: 600, cursor: (saving || !canContinue) ? 'not-allowed' : 'pointer', opacity: (saving || !canContinue) ? 0.6 : 1 }}>
                  {saving ? 'Creating firm...' : 'Create firm & generate quote →'}
                </button>
              ) : (
                <button onClick={() => { if (canContinue) setStep(s => Math.min(REGULAR_STEPS.length - 1, s + 1)) }} disabled={!canContinue} style={{ padding: '8px 24px', border: 'none', borderRadius: 6, background: 'var(--admin-gold)', color: '#0A0A0A', fontSize: 13, fontWeight: 600, cursor: canContinue ? 'pointer' : 'not-allowed', opacity: canContinue ? 1 : 0.5 }}>
                  Continue →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live pricing */}
        <div style={{ position: 'sticky', top: 0 }}>
          {/* Team summary (when on team step) */}
          {isTeamStep && team.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ ...cardHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)' }}>Team ({team.length})</span>
                {hasCco && <span style={{ fontSize: 10, color: 'var(--admin-success)', fontFamily: 'monospace' }}>✓ CCO assigned</span>}
              </div>
              {team.map(m => {
                const roleCfg = ROLES.find(r => r.value === m.role)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '0.5px solid var(--admin-border)' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: (roleCfg?.color ?? '#888') + '20', color: roleCfg?.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--admin-text3)' }}>{roleCfg?.label}{m.isCco ? ' · CCO' : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Price card */}
          <div style={cardStyle}>
            <div style={{ ...cardHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)' }}>Live quote</span>
              <span style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace' }}>Updates as you fill in</span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)', marginBottom: 8 }}>Monthly subscription</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--admin-border)', fontSize: 12, color: 'var(--admin-text2)' }}>
                  <span>Core platform</span>
                  <span style={{ fontFamily: 'monospace' }}>${BASE_PRICE}/mo</span>
                </div>
                {Object.entries(MODULE_PRICES).map(([key, price]) => {
                  if (!data[key]?.startsWith('Yes')) return null
                  const label = key.replace('module', '').replace(/([A-Z])/g, ' $1').trim()
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--admin-border)', fontSize: 12, color: 'var(--admin-text2)' }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--admin-gold)' }}>+${price}/mo</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--admin-text1)' }}>
                  <span>Monthly total</span>
                  <span style={{ color: 'var(--admin-gold)' }}>${monthlyTotal.toLocaleString()}/mo</span>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)', marginBottom: 4 }}>Setup fee</div>
                <div style={{ fontSize: 11, color: 'var(--admin-text3)', marginBottom: 3 }}>{setup.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--admin-text1)' }}>${setup.min.toLocaleString()} – ${setup.max.toLocaleString()}</div>
              </div>

              {training > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text3)', marginBottom: 4 }}>Training</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--admin-text1)' }}>${training.toLocaleString()}</div>
                </div>
              )}

              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.3)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-gold)', marginBottom: 6 }}>First year total</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--admin-gold)' }}>${firstYearTotal.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--admin-text3)', marginTop: 2 }}>Includes max setup + training</div>
              </div>
            </div>
          </div>

          {setup.inPerson && (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: 'rgba(217,119,6,0.08)', border: '0.5px solid rgba(217,119,6,0.3)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-warning)', marginBottom: 4 }}>⚠ In-person visit required</div>
              <div style={{ fontSize: 11, color: 'var(--admin-text3)', lineHeight: 1.6 }}>Analog records detected. Discuss on-site migration logistics before committing to a setup date.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
