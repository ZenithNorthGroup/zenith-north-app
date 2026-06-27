/**
 * ZENITH NORTH — Email Channel Configuration
 *
 * Setup instructions and helpers for:
 *   - Microsoft 365 journaling
 *   - Google Workspace third-party archiving
 *   - Google Chat journaling
 *   - Google Calendar journaling
 *   - Google Meet recording capture
 *
 * Each firm gets a unique journal address:
 *   ingest-{tenantSlug}@mail.zenith-north.com
 *
 * Inbound email infrastructure:
 *   We use Sendgrid Inbound Parse to receive SMTP and convert to HTTP.
 *   MX record: mail.zenith-north.com → mx.sendgrid.net
 *   Sendgrid POSTs to: /api/email/ingest
 *
 * This means:
 *   - No SMTP server to manage
 *   - Automatic parsing of MIME emails
 *   - Attachment extraction
 *   - Spam filtering via Sendgrid
 *   - TLS enforced on all inbound
 */

export interface EmailChannelConfig {
  journalAddress: string        // ingest-{slug}@mail.zenith-north.com
  tenantSlug:     string
  tenantName:     string
  enabled: {
    microsoft365:      boolean
    googleWorkspace:   boolean
    googleChat:        boolean
    googleCalendar:    boolean
    googleMeet:        boolean
  }
  setupStatus: {
    microsoft365:    'not_started' | 'configured' | 'verified' | 'error'
    googleWorkspace: 'not_started' | 'configured' | 'verified' | 'error'
  }
}

export function getJournalAddress(tenantSlug: string): string {
  return `ingest-${tenantSlug}@mail.zenith-north.com`
}

/**
 * Microsoft 365 setup instructions.
 * Admin pastes these into Exchange Admin Center.
 */
export function getMicrosoft365Instructions(journalAddress: string): {
  steps: Array<{ step: number; title: string; detail: string; url?: string }>
  verificationTest: string
} {
  return {
    steps: [
      {
        step:   1,
        title:  'Open Microsoft Purview Compliance Portal',
        detail: 'Go to compliance.microsoft.com and sign in with Global Admin credentials.',
        url:    'https://compliance.microsoft.com',
      },
      {
        step:   2,
        title:  'Navigate to Exchange journaling',
        detail: 'Go to: Data lifecycle management → Exchange (legacy) → Journal rules. Or navigate directly to the Exchange Admin Center.',
        url:    'https://admin.exchange.microsoft.com',
      },
      {
        step:   3,
        title:  'Create a new journal rule',
        detail: [
          'Click + Add rule',
          'Name: "Zenith North Compliance Archive"',
          'If the message is sent to or from: [Apply to all messages]',
          'Journal the following messages: All messages',
          `Send journal reports to: ${journalAddress}`,
          'Click Save',
        ].join('\n'),
      },
      {
        step:   4,
        title:  'Configure undeliverable report address',
        detail: 'Set a fallback mailbox for undeliverable journal reports. Use an internal distribution list or the CCO\'s mailbox. This ensures you\'re notified if journaling fails.',
      },
      {
        step:   5,
        title:  'Enable IRM journal report decryption (recommended)',
        detail: 'In Exchange Online PowerShell, run: Set-IRMConfiguration -JournalReportDecryptionEnabled $true\nThis ensures encrypted emails are archived in readable format.',
      },
      {
        step:   6,
        title:  'Send a test email',
        detail: 'Send a test email from an advisor to a client. It should appear in Zenith North Messages within 60 seconds. Journal rules can take up to 4 hours to fully propagate.',
      },
    ],
    verificationTest: `Send any email from your Microsoft 365 account. Within 60 seconds it should appear in Zenith North with provider: "microsoft365". If it doesn't appear within 5 minutes, check that the journal rule is enabled and the address is correct: ${journalAddress}`,
  }
}

/**
 * Google Workspace setup instructions.
 * Admin pastes the journal address into Google Admin console.
 *
 * Google supports journaling for:
 *   - Gmail (email)
 *   - Google Chat (instant messages)
 *   - Google Calendar (meeting events)
 *   - Google Meet (recordings metadata)
 */
export function getGoogleWorkspaceInstructions(journalAddress: string): {
  gmail: Array<{ step: number; title: string; detail: string; url?: string }>
  chat:  Array<{ step: number; title: string; detail: string; url?: string }>
  calendar: Array<{ step: number; title: string; detail: string; url?: string }>
  meet:  Array<{ step: number; title: string; detail: string; url?: string }>
} {
  return {
    gmail: [
      {
        step:   1,
        title:  'Open Google Admin Console',
        detail: 'Go to admin.google.com and sign in with Super Admin credentials.',
        url:    'https://admin.google.com',
      },
      {
        step:   2,
        title:  'Navigate to Gmail routing',
        detail: 'Apps → Google Workspace → Gmail → Routing (scroll to bottom)',
      },
      {
        step:   3,
        title:  'Configure Third-party email archiving',
        detail: `Under "Third-party email archiving", click Configure.\nEnter the archive email address: ${journalAddress}\nClick Add Setting → Save.`,
      },
      {
        step:   4,
        title:  'Verify TLS is enforced',
        detail: 'In the routing settings, enable "Require secure transport (TLS)" to ensure all journal emails are encrypted in transit.',
      },
      {
        step:   5,
        title:  'Test with a send',
        detail: 'Send a Gmail from any user. It should appear in Zenith North Messages within 60 seconds with provider: "google_workspace".',
      },
    ],

    chat: [
      {
        step:   1,
        title:  'Navigate to Chat journaling',
        detail: 'Google Admin console → Apps → Google Workspace → Google Chat → Chat history',
        url:    'https://admin.google.com',
      },
      {
        step:   2,
        title:  'Enable Chat history',
        detail: 'Chat history must be ON for journaling to work. Set "History is ON" for all users.',
      },
      {
        step:   3,
        title:  'Configure third-party archiving for Chat',
        detail: `Apps → Google Workspace → Google Chat → Third-party archiving\nEnter archive address: ${journalAddress}\nSave.`,
      },
    ],

    calendar: [
      {
        step:   1,
        title:  'Navigate to Calendar archiving',
        detail: 'Google Admin console → Apps → Google Workspace → Calendar → Third-party archiving settings',
        url:    'https://admin.google.com',
      },
      {
        step:   2,
        title:  'Enable third-party archiving',
        detail: `Toggle on "Third-party archiving"\nEnter archive address: ${journalAddress}\nSave.`,
      },
      {
        step:   3,
        title:  'What gets captured',
        detail: 'All calendar events and their updates are journaled — meeting titles, attendees, times, and descriptions. Meeting notes are NOT captured here (use Meet journaling for recordings).',
      },
    ],

    meet: [
      {
        step:   1,
        title:  'Enable Meet recordings',
        detail: 'Google Admin → Apps → Google Workspace → Google Meet → Meet safety → Recording. Enable "Let people record their meetings".',
      },
      {
        step:   2,
        title:  'Configure recording storage',
        detail: 'Recordings automatically save to the meeting organizer\'s Google Drive. We capture recording metadata via Calendar journaling (meeting title, participants, duration).',
      },
      {
        step:   3,
        title:  'Note on Meet audio archiving',
        detail: 'Full Meet audio archiving requires Google Workspace Enterprise Plus with Vault. For most RIAs, capturing meeting metadata + manual notes is sufficient for Rule 204-2 compliance.',
      },
    ],
  }
}

/**
 * Verify a journal address is receiving emails.
 * Called after setup — checks for recent emails from this tenant.
 */
export async function verifyEmailJournaling(
  tenantId: string,
  provider: 'microsoft365' | 'google_workspace'
): Promise<{
  verified:      boolean
  lastReceived?: Date
  count:         number
}> {
  const { db } = await import('@/lib/db')
  const { sql } = await import('drizzle-orm')

  const result = await db.execute(sql`
    SELECT COUNT(*) as count, MAX(created_at) as last_received
    FROM communications
    WHERE tenant_id = ${tenantId}
      AND channel = 'email'
      AND metadata->>'provider' = ${provider}
      AND created_at > NOW() - INTERVAL '24 hours'
  `)

  const row = result.rows[0] as { count: string; last_received: string | null }
  const count = Number(row.count)

  return {
    verified:      count > 0,
    lastReceived:  row.last_received ? new Date(row.last_received) : undefined,
    count,
  }
}
