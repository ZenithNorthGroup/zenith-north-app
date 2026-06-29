/**
 * ZENITH NORTH — Credentials Router
 * Manages per-tenant API credentials. Encrypted at rest.
 */

import { z } from 'zod'
import { router, withPermission } from '@/lib/trpc'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import {
  CREDENTIAL_FIELDS,
  prepareCredentialsForSave,
  maskCredential,
  isEncrypted,
  getCredential,
  type CredentialKey,
} from '@/lib/credentials'

export const credentialsRouter = router({

  /** Get all credentials for the current tenant — sensitive fields masked */
  list: withPermission('settings.view')
    .query(async ({ ctx }) => {
      const config = ctx.tenant.config as Record<string, any>

      const result: Record<string, {
        key: string
        label: string
        section: string
        type: string
        isSet: boolean
        maskedValue: string
        sensitive: boolean
      }> = {}

      for (const [key, def] of Object.entries(CREDENTIAL_FIELDS)) {
        const rawValue = config[key]
        const isSet = !!rawValue

        // Compute display value
        let maskedValue = ''
        if (isSet && def.sensitive) {
          // Show masked version
          maskedValue = '••••••••' + (
            isEncrypted(rawValue)
              ? rawValue.split(':')[2]?.slice(-8) ?? '????'
              : rawValue.slice(-4)
          )
        } else if (isSet && def.type === 'readonly') {
          maskedValue = `ingest-${ctx.tenant.slug}@mail.zenith-north.com`
        } else if (isSet) {
          maskedValue = rawValue
        }

        result[key] = {
          key,
          label:       def.label,
          section:     def.section,
          type:        def.type,
          isSet,
          maskedValue,
          sensitive:   def.sensitive,
        }
      }

      // Add the read-only journal address
      result['emailJournalAddress'] = {
        key:          'emailJournalAddress',
        label:        'Journal email address',
        section:      'Email',
        type:         'readonly',
        isSet:        true,
        maskedValue:  `ingest-${ctx.tenant.slug}@mail.zenith-north.com`,
        sensitive:    false,
      }

      return result
    }),

  /** Save one or more credentials — encrypts sensitive fields */
  save: withPermission('settings.manage_integrations')
    .input(z.object({
      credentials: z.record(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const prepared = prepareCredentialsForSave(
        input.credentials as Partial<Record<CredentialKey, string>>
      )

      if (Object.keys(prepared).length === 0) {
        return { success: true, saved: 0 }
      }

      // Merge into tenant config
      await db.execute(sql`
        UPDATE tenants
        SET config = config || ${JSON.stringify(prepared)}::jsonb
        WHERE id = ${ctx.tenant.id}
      `)

      // Audit log
      await db.execute(sql`
        INSERT INTO audit_log (tenant_id, user_id, skill_slug, action, entity_type, entity_id, next_state)
        VALUES (
          ${ctx.tenant.id}, ${ctx.user.id}, 'system', 'credentials.updated',
          'tenant', ${ctx.tenant.id},
          ${JSON.stringify({ fields: Object.keys(prepared) })}::jsonb
        )
      `)

      return { success: true, saved: Object.keys(prepared).length }
    }),

  /** Delete / clear a credential */
  clear: withPermission('settings.manage_integrations')
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.execute(sql`
        UPDATE tenants
        SET config = config - ${input.key}
        WHERE id = ${ctx.tenant.id}
      `)
      return { success: true }
    }),

  /** Test a channel connection */
  test: withPermission('settings.manage_integrations')
    .input(z.object({ channel: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const config = ctx.tenant.config as Record<string, any>

      switch (input.channel) {
        case 'twilio': {
          const sid   = getCredential(config, 'twilioAccountSid')
          const token = getCredential(config, 'twilioAuthToken')
          if (!sid || !token) return { success: false, error: 'Twilio credentials not set' }

          const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
            headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') }
          })
          if (resp.ok) return { success: true, message: 'Twilio connection verified' }
          return { success: false, error: `Twilio returned ${resp.status}` }
        }

        case 'deepgram': {
          const key = getCredential(config, 'deepgramApiKey')
          if (!key) return { success: false, error: 'Deepgram API key not set' }

          const resp = await fetch('https://api.deepgram.com/v1/projects', {
            headers: { Authorization: `Token ${key}` }
          })
          if (resp.ok) return { success: true, message: 'Deepgram connection verified' }
          return { success: false, error: `Deepgram returned ${resp.status}` }
        }

        default:
          return { success: false, error: `No test available for ${input.channel}` }
      }
    }),
})
