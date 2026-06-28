/**
 * ZENITH NORTH — Settings Router
 * Reads and writes real tenant config from the DB.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db, tenants, retentionPolicies } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

export const settingsRouter = router({

  /** Get full firm config */
  getFirmConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT
          t.id, t.name, t.slug, t.config, t.created_at,
          (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.archived_at IS NULL) as user_count,
          (SELECT COUNT(DISTINCT id) FROM clients WHERE tenant_id = t.id AND archived_at IS NULL) as client_count
        FROM tenants t
        WHERE t.id = ${ctx.tenant.id}
        LIMIT 1
      `)

      const row = result.rows[0] as any
      const config = row.config as Record<string, any>

      return {
        id:           row.id,
        name:         row.name,
        slug:         row.slug,
        createdAt:    row.created_at,
        userCount:    Number(row.user_count),
        clientCount:  Number(row.client_count),
        // Firm info
        crd:          config.crd ?? '',
        ccoName:      config.ccoName ?? '',
        ccoTitle:     config.ccoTitle ?? '',
        ccoEmail:     config.ccoEmail ?? '',
        firmAddress:  config.firmAddress ?? '',
        aum:          config.aum ?? '',
        // Regulatory
        deoSignedAt:  config.deoSignedAt ?? null,
        wspSignedAt:  config.wspSignedAt ?? null,
        // Channels
        emailProvider:    config.emailProvider ?? null,
        emailEnabled:     config.emailEnabled ?? false,
        twilioPhoneNumber:config.twilioPhoneNumber ?? null,
        zoomEnabled:      config.zoomEnabled ?? false,
        slackEnabled:     config.slackEnabled ?? false,
        // Priorities
        priority1:    config.priority1 ?? '',
        priority2:    config.priority2 ?? '',
        // Plan
        plan:         config.plan ?? 'professional',
        status:       config.status ?? 'active',
      }
    }),

  /** Update firm config */
  updateFirmConfig: withPermission('settings.edit')
    .input(z.object({
      name:         z.string().min(1).optional(),
      crd:          z.string().optional(),
      ccoName:      z.string().optional(),
      ccoTitle:     z.string().optional(),
      ccoEmail:     z.string().email().optional(),
      firmAddress:  z.string().optional(),
      aum:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, any> = {}

      // Separate name (goes to tenants.name) from config fields
      if (input.name) {
        await db.execute(sql`
          UPDATE tenants SET name = ${input.name}
          WHERE id = ${ctx.tenant.id}
        `)
      }

      const configFields = ['crd','ccoName','ccoTitle','ccoEmail','firmAddress','aum']
      for (const key of configFields) {
        if (input[key as keyof typeof input] !== undefined) {
          updates[key] = input[key as keyof typeof input]
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.execute(sql`
          UPDATE tenants
          SET config = config || ${JSON.stringify(updates)}::jsonb
          WHERE id = ${ctx.tenant.id}
        `)
      }

      return { success: true }
    }),

  /** Get retention policies */
  getRetentionPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT * FROM retention_policies
        WHERE tenant_id = ${ctx.tenant.id}
        ORDER BY record_type
      `)
      return result.rows as any[]
    }),

  /** Get channel status */
  getChannelStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const config = ctx.tenant.config as Record<string, any>

      // Check last email received
      const emailCheck = await db.execute(sql`
        SELECT MAX(created_at) as last_received
        FROM communications
        WHERE tenant_id = ${ctx.tenant.id}
          AND channel = 'email'
          AND archived_at IS NULL
      `)

      return {
        platform:  { enabled: true, lastActivity: null },
        email:     {
          enabled:      !!(config.emailEnabled && config.emailProvider),
          provider:     config.emailProvider ?? null,
          journalAddress: `ingest-${ctx.tenant.slug}@mail.zenith-north.com`,
          lastReceived: (emailCheck.rows[0] as any)?.last_received ?? null,
        },
        sms:       {
          enabled:      !!config.twilioPhoneNumber,
          phoneNumber:  config.twilioPhoneNumber ?? null,
        },
        zoom:      { enabled: !!config.zoomEnabled },
        slack:     { enabled: !!config.slackEnabled },
        linkedin:  { enabled: false, comingSoon: true },
        teams:     { enabled: false, comingSoon: true },
      }
    }),
})
