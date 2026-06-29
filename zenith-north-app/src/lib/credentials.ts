/**
 * ZENITH NORTH — Tenant Credential Manager
 *
 * Stores per-tenant API credentials encrypted in the DB.
 * Master encryption key lives in CREDENTIAL_ENCRYPTION_KEY env var.
 * Never logs or exposes raw credentials.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getMasterKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!key) throw new Error('CREDENTIAL_ENCRYPTION_KEY env var not set')
  // Derive a 32-byte key from whatever string they set
  return createHash('sha256').update(key).digest()
}

export function encryptCredential(plaintext: string): string {
  const key  = getMasterKey()
  const iv   = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext (all hex)
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

export function decryptCredential(encrypted: string): string {
  const key = getMasterKey()
  const [ivHex, authTagHex, dataHex] = encrypted.split(':')

  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid encrypted credential format')
  }

  const iv       = Buffer.from(ivHex, 'hex')
  const authTag  = Buffer.from(authTagHex, 'hex')
  const data     = Buffer.from(dataHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString('utf8')
}

export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/.test(value)
}

// ── Credential definitions ────────────────────────────────

export const CREDENTIAL_FIELDS = {
  // Email
  emailProvider:        { label: 'Email provider',         section: 'Email',     type: 'select',   options: ['Microsoft 365','Google Workspace','Other','None'], sensitive: false },
  emailJournalAddress:  { label: 'Journal email address',  section: 'Email',     type: 'readonly',  sensitive: false },

  // Twilio (SMS)
  twilioAccountSid:     { label: 'Twilio Account SID',     section: 'SMS',       type: 'text',     sensitive: true  },
  twilioAuthToken:      { label: 'Twilio Auth Token',      section: 'SMS',       type: 'password', sensitive: true  },
  twilioPhoneNumber:    { label: 'Twilio Phone Number',    section: 'SMS',       type: 'text',     sensitive: false },

  // WhatsApp
  whatsappPhoneNumberId:{ label: 'WA Phone Number ID',     section: 'WhatsApp',  type: 'text',     sensitive: false },
  whatsappAccessToken:  { label: 'WA Access Token',        section: 'WhatsApp',  type: 'password', sensitive: true  },
  whatsappVerifyToken:  { label: 'WA Verify Token',        section: 'WhatsApp',  type: 'text',     sensitive: true  },

  // LinkedIn
  linkedinOrgUrn:       { label: 'LinkedIn Org URN',       section: 'LinkedIn',  type: 'text',     sensitive: false },
  linkedinWebhookSecret:{ label: 'LinkedIn Webhook Secret',section: 'LinkedIn',  type: 'password', sensitive: true  },

  // Twitter/X
  twitterUserId:        { label: 'Twitter User ID',        section: 'Twitter/X', type: 'text',     sensitive: false },
  twitterConsumerSecret:{ label: 'Twitter Consumer Secret',section: 'Twitter/X', type: 'password', sensitive: true  },

  // Slack
  slackTeamId:          { label: 'Slack Team ID',          section: 'Slack',     type: 'text',     sensitive: false },
  slackSigningSecret:   { label: 'Slack Signing Secret',   section: 'Slack',     type: 'password', sensitive: true  },
  slackBotToken:        { label: 'Slack Bot Token',        section: 'Slack',     type: 'password', sensitive: true  },

  // Microsoft Teams
  msTenantsId:          { label: 'MS Tenant ID',           section: 'Teams',     type: 'text',     sensitive: false },
  msClientId:           { label: 'MS App Client ID',       section: 'Teams',     type: 'text',     sensitive: false },
  msClientSecret:       { label: 'MS App Client Secret',   section: 'Teams',     type: 'password', sensitive: true  },

  // Zoom
  zoomWebhookSecret:    { label: 'Zoom Webhook Secret',    section: 'Zoom',      type: 'password', sensitive: true  },
  zoomAccountId:        { label: 'Zoom Account ID',        section: 'Zoom',      type: 'text',     sensitive: false },
  zoomClientId:         { label: 'Zoom Client ID',         section: 'Zoom',      type: 'text',     sensitive: false },
  zoomClientSecret:     { label: 'Zoom Client Secret',     section: 'Zoom',      type: 'password', sensitive: true  },

  // Deepgram (transcription)
  deepgramApiKey:       { label: 'Deepgram API Key',       section: 'Zoom',      type: 'password', sensitive: true  },

  // Custodian
  schwabClientId:       { label: 'Schwab Client ID',       section: 'Custodian', type: 'text',     sensitive: false },
  schwabClientSecret:   { label: 'Schwab Client Secret',   section: 'Custodian', type: 'password', sensitive: true  },
  fidelityKey:          { label: 'Fidelity API Key',       section: 'Custodian', type: 'password', sensitive: true  },
} as const

export type CredentialKey = keyof typeof CREDENTIAL_FIELDS

/**
 * Get a tenant's credential, decrypting if needed.
 * Returns null if not set.
 */
export function getCredential(
  config: Record<string, any>,
  key: CredentialKey
): string | null {
  const value = config[key]
  if (!value) return null
  if (isEncrypted(value)) {
    try {
      return decryptCredential(value)
    } catch {
      return null
    }
  }
  return value
}

/**
 * Prepare credentials for saving — encrypts sensitive fields.
 */
export function prepareCredentialsForSave(
  updates: Partial<Record<CredentialKey, string>>
): Partial<Record<CredentialKey, string>> {
  const result: Partial<Record<CredentialKey, string>> = {}
  for (const [key, value] of Object.entries(updates)) {
    const fieldDef = CREDENTIAL_FIELDS[key as CredentialKey]
    if (!fieldDef || !value) continue
    if (fieldDef.sensitive && value && !isEncrypted(value)) {
      result[key as CredentialKey] = encryptCredential(value)
    } else {
      result[key as CredentialKey] = value
    }
  }
  return result
}

/**
 * Mask a credential for display — shows last 4 chars only.
 */
export function maskCredential(value: string | null): string {
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return '••••••••' + value.slice(-4)
}
