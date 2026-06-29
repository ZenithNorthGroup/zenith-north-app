'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import {
  IconCheck, IconCopy, IconExternalLink,
  IconShield, IconMail, IconMessage,
  IconDeviceMobile, IconPhone, IconBrandLinkedin,
  IconBrandTwitter, IconVideo, IconBrandSlack,
  IconBrandZoom, IconAlertTriangle, IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react'

// ── Types ─────────────────────────────────────────────────

type ChannelStatus = 'connected' | 'setup' | 'disconnected' | 'coming_soon'

interface Channel {
  id:          string
  name:        string
  description: string
  icon:        React.ElementType
  status:      ChannelStatus
  priority:    'high' | 'medium' | 'low'
  regulatory:  string
}

// ── Copy button ────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="btn-ghost btn-sm flex items-center gap-1.5 flex-shrink-0"
    >
      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// ── Channel card ───────────────────────────────────────────

function ChannelCard({
  channel,
  journalAddress,
}: {
  channel: Channel
  journalAddress: string
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = channel.icon

  const statusConfig: Record<ChannelStatus, { pill: string; label: string }> = {
    connected:    { pill: 'pill-success', label: 'Connected'     },
    setup:        { pill: 'pill-warn',    label: 'Setup required' },
    disconnected: { pill: 'pill-ghost',   label: 'Not connected'  },
    coming_soon:  { pill: 'pill-ghost',   label: 'Coming soon'    },
  }

  const cfg = statusConfig[channel.status]

  return (
    <div className={cn(
      'card mb-2 transition-all',
      channel.status === 'coming_soon' && 'opacity-50',
    )}>
      <div
        className={cn(
          'flex items-center gap-3 p-4',
          channel.status !== 'coming_soon' && 'cursor-pointer',
        )}
        onClick={() => channel.status !== 'coming_soon' && setExpanded(!expanded)}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-zn-border bg-zn-surface-2">
          <Icon size={17} className="text-zn-text-2" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-zn-text-1">{channel.name}</span>
            <span className={cn('pill', cfg.pill)}>{cfg.label}</span>
            {channel.priority === 'high' && channel.status !== 'connected' && (
              <span className="pill pill-danger text-[9px]">HIGH RISK</span>
            )}
          </div>
          <div className="font-mono text-[10px] text-zn-text-3">{channel.regulatory}</div>
        </div>
        <div className="flex-shrink-0 text-zn-text-3">
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zn-border px-4 py-4">
          <p className="mb-4 text-sm text-zn-text-2 leading-relaxed">{channel.description}</p>
          {channel.id === 'microsoft365' && (
            <Microsoft365Setup journalAddress={journalAddress} />
          )}
          {channel.id === 'google_workspace' && (
            <GoogleWorkspaceSetup journalAddress={journalAddress} />
          )}
          {channel.id === 'sms' && <SMSSetup />}
          {channel.id === 'zoom' && <ZoomSetup />}
          {channel.id === 'slack' && <SlackSetup />}
        </div>
      )}
    </div>
  )
}

// ── Setup components ───────────────────────────────────────

function SetupStep({ num, title, detail, code }: {
  num: number; title: string; detail: string; code?: string
}) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-zn-gold/30 bg-zn-gold/10 font-mono text-[10px] text-zn-gold">
        {num}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-zn-text-1 mb-1">{title}</div>
        <div className="text-sm text-zn-text-2 leading-relaxed whitespace-pre-line">{detail}</div>
        {code && (
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded border border-zn-border bg-zn-black px-3 py-1.5 font-mono text-[11px] text-zn-gold truncate">
              {code}
            </code>
            <CopyButton text={code} />
          </div>
        )}
      </div>
    </div>
  )
}

function Microsoft365Setup({ journalAddress }: { journalAddress: string }) {
  return (
    <div>
      <div className="mb-4 rounded border border-zn-gold/20 bg-zn-gold/5 px-4 py-3">
        <div className="field-label mb-1">Your Microsoft 365 journal address</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded border border-zn-border bg-zn-black px-3 py-2 font-mono text-[12px] text-zn-gold">
            {journalAddress}
          </code>
          <CopyButton text={journalAddress} />
        </div>
        <div className="mt-1 font-mono text-[10px] text-zn-text-3">
          Paste this address into Microsoft Purview as the journal recipient
        </div>
      </div>

      <SetupStep
        num={1}
        title="Open Microsoft Purview Compliance Portal"
        detail="Sign in with Global Administrator credentials."
        code="https://compliance.microsoft.com"
      />
      <SetupStep
        num={2}
        title="Create a journal rule"
        detail={`Navigate to: Data lifecycle management → Exchange → Journal rules\n\nClick + Add rule:\n• Name: "Zenith North Compliance Archive"\n• Apply to: All messages\n• Journal: All messages (internal + external)`}
        code={journalAddress}
      />
      <SetupStep
        num={3}
        title="Enable IRM journal report decryption"
        detail="In Exchange Online PowerShell, run this command to ensure encrypted emails are archived in readable format:"
        code="Set-IRMConfiguration -JournalReportDecryptionEnabled $true"
      />
      <SetupStep
        num={4}
        title="Send a test email"
        detail="Send any email from your Microsoft 365 account. It should appear in Zenith North Messages within 60 seconds. Journal rules can take up to 4 hours to fully propagate."
      />

      <div className="flex items-start gap-2 rounded border border-zn-warning/30 bg-zn-warning/8 px-3 py-2.5 mt-2">
        <IconAlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-zn-warning" />
        <div className="font-mono text-[10px] text-zn-warning">
          Journal rules apply prospectively. Historical email before setup is not archived. For past email archiving, use Microsoft Purview Content Search to export and we can import via CSV.
        </div>
      </div>
    </div>
  )
}

function GoogleWorkspaceSetup({ journalAddress }: { journalAddress: string }) {
  const [activeTab, setActiveTab] = useState<'gmail' | 'chat' | 'calendar' | 'meet'>('gmail')

  const tabs = [
    { id: 'gmail',    label: 'Gmail' },
    { id: 'chat',     label: 'Chat' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'meet',     label: 'Meet' },
  ] as const

  return (
    <div>
      <div className="mb-4 rounded border border-zn-gold/20 bg-zn-gold/5 px-4 py-3">
        <div className="field-label mb-1">Your Google Workspace journal address</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded border border-zn-border bg-zn-black px-3 py-2 font-mono text-[12px] text-zn-gold">
            {journalAddress}
          </code>
          <CopyButton text={journalAddress} />
        </div>
        <div className="mt-1 font-mono text-[10px] text-zn-text-3">
          Use this address for all Google Workspace journaling (Gmail, Chat, Calendar)
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b border-zn-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-zn-gold text-zn-gold font-medium'
                : 'border-transparent text-zn-text-3 hover:text-zn-text-2',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'gmail' && (
        <>
          <SetupStep
            num={1}
            title="Open Google Admin Console"
            detail="Sign in with Super Admin credentials."
            code="https://admin.google.com"
          />
          <SetupStep
            num={2}
            title="Navigate to Gmail routing"
            detail="Apps → Google Workspace → Gmail → Routing (scroll to bottom of the page)"
          />
          <SetupStep
            num={3}
            title="Configure third-party email archiving"
            detail={`Under "Third-party email archiving", click Configure.\nPaste your journal address and click Add Setting → Save.`}
            code={journalAddress}
          />
          <SetupStep
            num={4}
            title="Enforce TLS"
            detail='In the same routing settings, enable "Require secure transport (TLS)" to ensure all journal emails are encrypted in transit.'
          />
        </>
      )}

      {activeTab === 'chat' && (
        <>
          <SetupStep
            num={1}
            title="Enable Chat history"
            detail="Apps → Google Workspace → Google Chat → Chat history\nSet 'History is ON' for all users. Chat journaling only works when history is enabled."
          />
          <SetupStep
            num={2}
            title="Configure Chat journaling"
            detail="Apps → Google Workspace → Google Chat → Third-party archiving\nPaste your journal address and save."
            code={journalAddress}
          />
          <SetupStep
            num={3}
            title="What gets captured"
            detail="All Google Chat messages between advisors and clients — text, files, and reactions. Requires Google Workspace Business Plus or higher."
          />
        </>
      )}

      {activeTab === 'calendar' && (
        <>
          <SetupStep
            num={1}
            title="Navigate to Calendar archiving"
            detail="Apps → Google Workspace → Calendar → Third-party archiving settings"
          />
          <SetupStep
            num={2}
            title="Enable third-party archiving"
            detail="Toggle on 'Third-party archiving' and paste your journal address."
            code={journalAddress}
          />
          <SetupStep
            num={3}
            title="What gets captured"
            detail="All calendar events: meeting titles, attendees, times, descriptions, and changes. This gives you a complete record of every client meeting scheduled."
          />
        </>
      )}

      {activeTab === 'meet' && (
        <>
          <SetupStep
            num={1}
            title="Enable Meet recordings"
            detail="Apps → Google Workspace → Google Meet → Meet safety → Recording\nEnable 'Let people record their meetings'"
          />
          <SetupStep
            num={2}
            title="Recordings stored in Drive"
            detail="Meet recordings automatically save to the organizer's Google Drive. Meeting metadata (participants, duration, title) is captured via Calendar journaling."
          />
          <div className="rounded border border-zn-border bg-zn-surface-2 px-4 py-3 text-sm text-zn-text-2 mt-2">
            Full Meet audio archiving (not just metadata) requires Google Workspace Enterprise Plus with Vault. For most RIAs, capturing meeting metadata and having advisors take meeting notes in Zenith North satisfies Rule 204-2.
          </div>
        </>
      )}
    </div>
  )
}

function SMSSetup() {
  return (
    <div>
      <div className="mb-3 rounded border border-zn-success/30 bg-zn-success/8 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[11px] text-zn-success">
          <IconCheck size={13} />
          SMS is built natively into Zenith North via Twilio
        </div>
        <div className="mt-1 font-mono text-[10px] text-zn-success/70">
          All texts are archived, AI-scanned, and linked to client records automatically
        </div>
      </div>
      <SetupStep
        num={1}
        title="Add Twilio credentials to your environment"
        detail="Set these in your .env.local or deployment environment variables:"
        code="TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_PHONE_NUMBER"
      />
      <SetupStep
        num={2}
        title="Register for 10DLC (required by carriers)"
        detail="In your Twilio console, go to Messaging → Regulatory Compliance → Trust Hub.\nRegister your business for 10DLC — required for business SMS in the US.\nTakes 2-5 business days. Cost: ~$4/month per number."
        code="https://console.twilio.com"
      />
      <SetupStep
        num={3}
        title="Set the inbound webhook URL"
        detail="In Twilio console: Phone Numbers → Manage → your number → Messaging\nSet webhook URL for incoming messages:"
        code={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/api/sms/inbound`}
      />
    </div>
  )
}

function ZoomSetup() {
  return (
    <div>
      <SetupStep
        num={1}
        title="Create a Zoom OAuth app"
        detail="Go to marketplace.zoom.us → Develop → Build App → OAuth\nName: 'Zenith North'\nScopes needed: recording:read, meeting:read"
        code="https://marketplace.zoom.us"
      />
      <SetupStep
        num={2}
        title="Configure the recording webhook"
        detail="In your Zoom app settings → Feature → Event Subscriptions\nAdd event: recording.completed\nEndpoint URL:"
        code={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/api/zoom/recording`}
      />
      <SetupStep
        num={3}
        title="What gets captured"
        detail="Every completed Zoom meeting with recording: participant list, duration, transcript (if enabled), and recording URL stored in Zenith North linked to the client record."
      />
      <div className="font-mono text-[10px] text-zn-text-3 mt-2">
        Zoom recording capture coming in Phase 2 — webhook endpoint is scaffolded.
      </div>
    </div>
  )
}

function SlackSetup() {
  return (
    <div>
      <SetupStep
        num={1}
        title="Create a Slack app"
        detail="Go to api.slack.com/apps → Create New App → From scratch\nScopes needed: channels:history, im:history, groups:history"
        code="https://api.slack.com/apps"
      />
      <SetupStep
        num={2}
        title="Enable event subscriptions"
        detail="In your Slack app → Event Subscriptions → Subscribe to bot events\nAdd: message.channels, message.im, message.groups\nRequest URL:"
        code={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/api/slack/events`}
      />
      <div className="font-mono text-[10px] text-zn-text-3 mt-2">
        Slack capture coming in Phase 2 — use for internal advisor communications only. Client-facing Slack channels are lower priority than email/SMS.
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function IntegrationsPage() {
  // In production: get tenantSlug from auth context
  const { data: me } = trpc.me.getMe.useQuery()
  const tenantSlug = me?.tenantSlug ?? ''
  const journalAddress = `ingest-${tenantSlug}@mail.zenith-north.com`

  const CHANNELS: Channel[] = [
    // Email — highest priority
    {
      id:         'microsoft365',
      name:       'Microsoft 365 / Outlook',
      description: 'Journal every email sent and received by your advisors. Microsoft 365 BCCs all emails to Zenith North via Exchange journaling rules — no client-side software required. Covers Outlook desktop, Outlook web, and mobile.',
      icon:       IconMail,
      status:     'setup',
      priority:   'high',
      regulatory: 'SEC Rule 204-2 · FINRA Rule 4511 · Email archiving required',
    },
    {
      id:         'google_workspace',
      name:       'Google Workspace / Gmail',
      description: 'Journal Gmail, Google Chat, Google Calendar events, and Google Meet recordings. Google\'s third-party archiving routes copies of every communication to Zenith North. Covers Gmail web, mobile app, and Google Chat.',
      icon:       IconMail,
      status:     'setup',
      priority:   'high',
      regulatory: 'SEC Rule 204-2 · FINRA Rule 4511 · FINRA compliance launched June 2025',
    },

    // SMS — built natively
    {
      id:         'sms',
      name:       'SMS / Text messaging',
      description: 'Compliant SMS built natively into Zenith North via Twilio. Every text is archived, AI-scanned, and linked to the client record. Advisors send from a dedicated business number — personal numbers are prohibited by firm policy.',
      icon:       IconDeviceMobile,
      status:     'setup',
      priority:   'high',
      regulatory: 'SEC Rule 204-2 · $2.3B in fines since 2022 for off-channel texting',
    },

    // Voice
    {
      id:         'zoom',
      name:       'Zoom meetings',
      description: 'Capture Zoom meeting recordings, participant lists, and transcripts automatically via Zoom webhooks. Every recorded client meeting is archived and linked to the client record in Zenith North.',
      icon:       IconBrandZoom,
      status:     'setup',
      priority:   'medium',
      regulatory: 'SEC Rule 204-2 · Meeting records required · Transcripts searchable in exam',
    },

    // Collaboration
    {
      id:         'slack',
      name:       'Slack',
      description: 'Archive internal advisor communications in Slack. Lower priority than email and SMS — most client-facing communications happen via other channels. Recommended for firms that use Slack for advisor collaboration.',
      icon:       IconBrandSlack,
      status:     'setup',
      priority:   'medium',
      regulatory: 'SEC Rule 204-2 · Internal communications archiving',
    },

    // Social — coming soon
    {
      id:         'linkedin',
      name:       'LinkedIn',
      description: 'Capture LinkedIn posts and messages from advisor accounts. Required for firms that use LinkedIn for client marketing or communication.',
      icon:       IconBrandLinkedin,
      status:     'coming_soon',
      priority:   'medium',
      regulatory: 'SEC Marketing Rule · Social media supervision required',
    },
    {
      id:         'twitter',
      name:       'X / Twitter',
      description: 'Archive advisor posts and direct messages from Twitter/X accounts used for business.',
      icon:       IconBrandTwitter,
      status:     'coming_soon',
      priority:   'low',
      regulatory: 'SEC Marketing Rule · Social media supervision',
    },
  ]

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
          Communication channels
        </h1>
        <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
          CAPTURE EVERY CHANNEL · ZERO BLIND SPOTS · EXAM READY
        </p>
      </div>

      {/* Compliance summary */}
      <div className="mb-5 flex items-start gap-3 rounded border border-zn-gold/20 bg-zn-gold/5 px-4 py-3">
        <IconShield size={14} className="mt-0.5 flex-shrink-0 text-zn-gold" />
        <div className="text-sm text-zn-text-2 leading-relaxed">
          <strong className="text-zn-text-1">SEC Rule 204-2 requires archiving all business communications</strong> — email, text, voice, and social. Every channel you enable flows into Zenith North's immutable audit log, is AI-scanned for compliance flags, and is producible in seconds during an exam. Your CCO signed the DEO undertaking confirming you can produce all records to the SEC on request.
        </div>
      </div>

      {/* Your journal address */}
      <div className="mb-5 card p-4">
        <div className="field-label mb-2">Your universal journal address</div>
        <div className="flex items-center gap-2 mb-2">
          <code className="flex-1 rounded border border-zn-border bg-zn-black px-3 py-2 font-mono text-[12px] text-zn-gold">
            {journalAddress}
          </code>
          <CopyButton text={journalAddress} />
        </div>
        <div className="font-mono text-[10px] text-zn-text-3">
          Use this address for both Microsoft 365 and Google Workspace journaling. Every email sent to this address is parsed, archived, and linked to the right client record automatically.
        </div>
      </div>

      {/* Channels */}
      <div className="sl mb-3">Email — highest volume, highest priority</div>
      <ChannelCard channel={CHANNELS[0]} journalAddress={journalAddress} />
      <ChannelCard channel={CHANNELS[1]} journalAddress={journalAddress} />

      <div className="sl mb-3 mt-5">SMS and voice</div>
      <ChannelCard channel={CHANNELS[2]} journalAddress={journalAddress} />
      <ChannelCard channel={CHANNELS[3]} journalAddress={journalAddress} />

      <div className="sl mb-3 mt-5">Collaboration</div>
      <ChannelCard channel={CHANNELS[4]} journalAddress={journalAddress} />

      <div className="sl mb-3 mt-5">Social media — Phase 2</div>
      <ChannelCard channel={CHANNELS[5]} journalAddress={journalAddress} />
      <ChannelCard channel={CHANNELS[6]} journalAddress={journalAddress} />

      {/* What we can't capture */}
      <div className="mt-5 rounded border border-zn-danger/30 bg-zn-danger/5 px-4 py-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-medium text-zn-danger">
          <IconAlertTriangle size={13} />
          Channels that must be prohibited — cannot be archived by anyone
        </div>
        <div className="space-y-1.5">
          {[
            { name: 'iMessage / Apple Messages', reason: 'End-to-end encryption prevents capture without a device agent on every corporate iPhone' },
            { name: 'Personal WhatsApp',          reason: 'WhatsApp Business API is capturable; personal WhatsApp is E2E encrypted' },
            { name: 'Signal',                     reason: 'Designed to be uncapturable — encryption by design, no archiving API exists' },
            { name: 'Telegram (secret chats)',    reason: 'Secret chats are E2E encrypted; regular Telegram messages are archivable but not recommended' },
          ].map(ch => (
            <div key={ch.name} className="flex gap-2 text-sm">
              <span className="font-medium text-zn-danger flex-shrink-0">{ch.name}:</span>
              <span className="text-zn-text-2">{ch.reason}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[10px] text-zn-text-3">
          These channels should be explicitly prohibited in your Written Supervisory Procedures (WSP). Zenith North generates this policy document automatically — it's in your compliance settings.
        </div>
      </div>
    </div>
  )
}
