/**
 * ZENITH NORTH — Written Supervisory Procedures Generator
 *
 * The SEC's first request in every examination is the firm's
 * Written Supervisory Procedures (WSP). This document must:
 *
 *   1. List every communication channel used for business
 *   2. Describe how each channel is supervised and archived
 *   3. Name the designated supervisor (CCO)
 *   4. Specify retention periods for each record type
 *   5. Describe the review process and frequency
 *   6. Document prohibited channels and enforcement
 *   7. Cover the firm's marketing compliance procedures
 *   8. Address cybersecurity and data protection
 *
 * Zenith North generates this document automatically from:
 *   - The firm's enabled channels
 *   - The tenant's retention policy settings
 *   - The DEO undertaking data
 *   - The workflow definitions
 *
 * The CCO reviews and signs it via the client portal.
 * It's stored in documents table with signed_at timestamp.
 * Exam packages include it automatically.
 *
 * SEC requirement: Must be reviewed and updated annually.
 * Zenith North generates a compliance item 30 days before
 * the annual review date to remind the CCO.
 */

export interface FirmConfig {
  // Identity
  firmName:       string
  firmCRD:        string
  firmAddress:    string
  firmState:      string
  registrationType: 'SEC' | 'state'

  // Personnel
  ccoName:        string
  ccoTitle:       string
  ccoEmail:       string
  principalName:  string
  principalTitle: string

  // Channels enabled
  channels: {
    platformMessaging: boolean
    email:             boolean
    emailProvider:     'microsoft365' | 'google_workspace' | 'both' | null
    sms:               boolean
    zoom:              boolean
    slack:             boolean
    linkedin:          boolean
    twitter:           boolean
  }

  // Retention
  retentionYears:       number
  immediateAccessYears: number

  // Review
  reviewFrequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'

  // Dates
  effectiveDate:   string
  lastReviewDate?: string
  signedDate?:     string
  signedBy?:       string
}

export function generateWSP(config: FirmConfig): string {
  const {
    firmName, firmCRD, firmAddress, firmState,
    ccoName, ccoTitle, ccoEmail,
    principalName, principalTitle,
    channels, retentionYears, immediateAccessYears,
    reviewFrequency, effectiveDate,
  } = config

  const enabledChannels: string[] = []
  if (channels.platformMessaging) enabledChannels.push('Zenith North platform messaging')
  if (channels.email) {
    if (channels.emailProvider === 'microsoft365') enabledChannels.push('Microsoft 365 / Outlook email')
    else if (channels.emailProvider === 'google_workspace') enabledChannels.push('Google Workspace / Gmail')
    else if (channels.emailProvider === 'both') enabledChannels.push('Microsoft 365 / Outlook email', 'Google Workspace / Gmail')
  }
  if (channels.sms)      enabledChannels.push('SMS text messaging (Twilio)')
  if (channels.zoom)     enabledChannels.push('Zoom video meetings')
  if (channels.slack)    enabledChannels.push('Slack (internal communications only)')
  if (channels.linkedin) enabledChannels.push('LinkedIn (business profile and messages)')
  if (channels.twitter)  enabledChannels.push('X / Twitter (business account only)')

  const prohibitedChannels = [
    'iMessage / Apple Messages (cannot be archived)',
    'Personal WhatsApp (WhatsApp Business permitted)',
    'Signal (end-to-end encrypted, cannot be archived)',
    'Telegram Secret Chats (end-to-end encrypted)',
    'Personal email accounts (Gmail, Yahoo, Hotmail, etc.)',
    'Facebook Messenger personal accounts',
    'Any communication channel not listed above',
  ]

  return `
WRITTEN SUPERVISORY PROCEDURES
${firmName}
CRD Number: ${firmCRD}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIRM INFORMATION

Firm Name:           ${firmName}
CRD Number:          ${firmCRD}
Address:             ${firmAddress}
Registration:        ${config.registrationType === 'SEC' ? 'SEC-Registered Investment Adviser' : `State-Registered Investment Adviser (${firmState})`}
Effective Date:      ${effectiveDate}
${config.lastReviewDate ? `Last Annual Review: ${config.lastReviewDate}` : ''}

CHIEF COMPLIANCE OFFICER

Name:  ${ccoName}
Title: ${ccoTitle}
Email: ${ccoEmail}

PRINCIPAL

Name:  ${principalName}
Title: ${principalTitle}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1: ELECTRONIC COMMUNICATIONS SUPERVISION

1.1 PURPOSE

This section establishes ${firmName}'s (the "Firm") procedures for
supervising, archiving, and reviewing electronic communications
pursuant to the Investment Advisers Act of 1940, Rule 204-2, and
applicable SEC guidance on electronic recordkeeping.

1.2 APPROVED COMMUNICATION CHANNELS

The following channels are approved for business communications
with clients, prospects, and counterparties:

${enabledChannels.map((ch, i) => `  ${i + 1}. ${ch}`).join('\n')}

ALL approved channels are automatically archived to the Firm's
compliant recordkeeping system (Zenith North) and are available
for immediate production to regulators upon request.

1.3 PROHIBITED COMMUNICATION CHANNELS

The following channels are PROHIBITED for any business-related
communication with clients, prospects, or counterparties:

${prohibitedChannels.map((ch, i) => `  ${i + 1}. ${ch}`).join('\n')}

Any access person who uses a prohibited channel for business
communication must immediately notify the CCO and preserve
all records of such communication by forwarding to:
${ccoEmail}

Violations of this policy may result in disciplinary action
up to and including termination.

1.4 ARCHIVING MECHANISM

${channels.email && channels.emailProvider === 'microsoft365' ? `
MICROSOFT 365 EMAIL:
All emails sent or received by Firm personnel are automatically
journaled to Zenith North via Microsoft Exchange journal rules.
Journal recipient: ingest-${firmCRD.toLowerCase()}@mail.zenith-north.com
Scope: All messages (internal and external)
` : ''}
${channels.email && (channels.emailProvider === 'google_workspace' || channels.emailProvider === 'both') ? `
GOOGLE WORKSPACE EMAIL:
All Gmail messages are automatically journaled to Zenith North via
Google Workspace third-party email archiving.
Journal recipient: ingest-${firmCRD.toLowerCase()}@mail.zenith-north.com
Scope: All inbound, outbound, and internal messages
` : ''}
${channels.sms ? `
SMS / TEXT MESSAGING:
All SMS messages are sent and received through Zenith North's
native SMS infrastructure (Twilio). Messages are archived
automatically at time of transmission.
` : ''}
${channels.zoom ? `
ZOOM MEETINGS:
All Zoom meetings are recorded when client communications occur.
Recordings and transcripts are automatically captured via Zoom
webhook and stored in Zenith North linked to the client record.
` : ''}

All archived communications are:
  (a) Stored in a non-erasable, append-only format (DELETE and
      UPDATE operations are blocked at the database level)
  (b) Encrypted at rest using AES-256 encryption
  (c) Replicated across geographically separate data centers
  (d) Indexed and searchable by date, advisor, client, and keyword
  (e) Immediately accessible to regulators upon request

This archiving system satisfies the audit-trail alternative to
WORM storage as amended by the SEC in October 2022.

1.5 RETENTION PERIODS

Record Type                         | Retention Period
------------------------------------|------------------
Client communications (all channels)| ${retentionYears} years
Investment advisory agreements      | ${retentionYears} years from termination
Client account records              | ${retentionYears} years
Compliance records                  | ${retentionYears} years
Performance records                 | ${retentionYears} years
Audit log                           | Permanent (never deleted)

Records from the first ${immediateAccessYears} years are immediately accessible.
Records from years ${immediateAccessYears + 1}–${retentionYears} are accessible within 24 hours.

1.6 SUPERVISION AND REVIEW

FREQUENCY: ${reviewFrequency.charAt(0).toUpperCase() + reviewFrequency.slice(1)}

SUPERVISOR: ${ccoName}, ${ccoTitle}

PROCESS:
  1. The CCO reviews a sample of archived communications
     using Zenith North's supervision dashboard
  2. AI-flagged communications are reviewed within 2 business
     days of flagging
  3. High-severity flags are reviewed the same business day
  4. Review actions are documented in the Zenith North audit log

LEXICON MONITORING:
The following terms and phrases trigger AI-based flagging:
  - Performance guarantees or return promises
  - Discretionary action language without authorization
  - Suitability-concerning recommendations
  - Testimonial or endorsement language
  - Performance claims without disclosures

1.7 DESIGNATED EXECUTIVE OFFICER

Pursuant to SEC Rule 17a-4(f)(3)(vii) (as amended October 2022),
${ccoName} (${ccoTitle}) is designated as the Firm's Designated
Executive Officer (DEO) responsible for:

  (a) Maintaining access to all electronic records
  (b) Producing records to the SEC upon request
  (c) Ensuring the recordkeeping system meets regulatory requirements

The DEO has executed a separate Written Undertaking confirming
these obligations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 2: CLIENT ONBOARDING SUPERVISION

2.1 ONBOARDING PROCESS

All client onboarding follows the Firm's documented workflow,
enforced by Zenith North's workflow engine. The workflow requires
completion of all required steps before account opening.

Required steps before account opening:
  1. Collection of client information and identification
  2. KYC verification (identity verification)
  3. Risk profile assessment
  4. Execution of investment advisory agreement
  5. Delivery and acknowledgment of ADV Part 2
  6. Suitability review (for accounts above applicable thresholds)
  7. Internal approval by designated supervisor

2.2 DOCUMENTATION

All onboarding documents are stored in Zenith North with:
  - Version control (prior versions preserved)
  - Digital signature with timestamp and IP address
  - Audit trail of every review and approval step

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 3: ANNUAL REVIEW SUPERVISION

3.1 ANNUAL REVIEW SCHEDULE

All active client relationships receive an annual review.
Reviews are tracked in Zenith North and flagged as overdue
if not completed within 365 days of the prior review.

3.2 REVIEW CONTENT

Annual reviews include:
  - Review of client's financial situation and objectives
  - Update to risk profile if material change has occurred
  - Review of investment policy statement
  - Delivery of updated ADV Part 2 if material changes occurred
  - Documentation of all discussion points

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 4: MARKETING AND ADVERTISING SUPERVISION

4.1 SEC MARKETING RULE COMPLIANCE

All marketing materials, including social media posts, are
reviewed by the CCO before publication pursuant to the
SEC Marketing Rule (Rule 206(4)-1).

4.2 PROHIBITED CONTENT

Marketing materials must not contain:
  - Testimonials or endorsements without required disclosures
  - Hypothetical performance without required disclosures
  - Cherry-picked performance periods
  - Untrue or misleading statements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 5: CYBERSECURITY

5.1 DATA PROTECTION

All client data is protected by:
  - AES-256 encryption at rest
  - TLS 1.3 encryption in transit
  - Multi-factor authentication (enforced via Clerk)
  - Role-based access control
  - Comprehensive access logging

5.2 INCIDENT RESPONSE

Security incidents are reported to the CCO immediately.
Client notification follows applicable state and federal law.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 6: ANNUAL WSP REVIEW

These Written Supervisory Procedures must be reviewed and updated
at least annually by the CCO. The review must be documented in
Zenith North's audit log with a signed attestation.

Next required review: ${(() => {
    const d = new Date(effectiveDate)
    d.setFullYear(d.getFullYear() + 1)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  })()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ATTESTATION

I, ${ccoName}, as Chief Compliance Officer of ${firmName},
attest that I have reviewed these Written Supervisory Procedures,
that they are reasonably designed to achieve compliance with
applicable securities laws and regulations, and that they
accurately describe the Firm's supervisory practices.

Firm:        ${firmName}
CCO:         ${ccoName}
Date:        ${config.signedDate ?? '[SIGNATURE REQUIRED]'}
Signature:   ${config.signedBy ?? '[DIGITAL SIGNATURE]'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Zenith North — The RIA Operating System
Document version: 1.0 · Effective: ${effectiveDate}
This document is maintained as part of the Firm's books and
records and is produced automatically during SEC examinations.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
}
