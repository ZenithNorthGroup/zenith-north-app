/**
 * ZENITH NORTH — WSP Router
 * Written Supervisory Procedures — versioned living document.
 * CCO signs annually. Auto-updates when channels/advisors change.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const wspRouter = router({

  /** Get current active WSP */
  getCurrent: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT w.*,
          u.full_name as signed_by_name
        FROM wsp_documents w
        LEFT JOIN users u ON u.id = w.signed_by
        WHERE w.tenant_id = ${ctx.tenant.id}
          AND w.archived_at IS NULL
        ORDER BY w.version DESC
        LIMIT 1
      `)
      return result.rows[0] as any ?? null
    }),

  /** Get all WSP versions */
  listVersions: withPermission('compliance.view')
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT w.id, w.version, w.status, w.signed_at, w.effective_at,
          w.created_at, u.full_name as signed_by_name
        FROM wsp_documents w
        LEFT JOIN users u ON u.id = w.signed_by
        WHERE w.tenant_id = ${ctx.tenant.id}
        ORDER BY w.version DESC
      `)
      return result.rows as any[]
    }),

  /** Create new WSP draft (auto-generates from tenant config) */
  createDraft: withPermission('compliance.view')
    .mutation(async ({ ctx }) => {
      const config = ctx.tenant.config as Record<string, any>
      const slug   = ctx.tenant.slug

      // Get current version number
      const versionResult = await db.execute(sql`
        SELECT COALESCE(MAX(version), 0) + 1 as next_version
        FROM wsp_documents
        WHERE tenant_id = ${ctx.tenant.id}
      `)
      const nextVersion = (versionResult.rows[0] as any).next_version

      // Get team members
      const teamResult = await db.execute(sql`
        SELECT full_name, role, title, email, is_cco
        FROM users
        WHERE tenant_id = ${ctx.tenant.id}
          AND archived_at IS NULL
        ORDER BY role, full_name
      `)
      const team = teamResult.rows as any[]
      const cco  = team.find((m: any) => m.is_cco)

      // Auto-generate WSP content
      const channels = []
      if (config.emailEnabled) channels.push('Email (' + config.emailProvider + ')')
      if (config.twilioPhoneNumber) channels.push('SMS (Twilio)')
      if (config.zoomEnabled) channels.push('Zoom video conferencing')
      if (config.slackEnabled) channels.push('Slack (internal only)')

      const content = `# Written Supervisory Procedures
## ${ctx.tenant.name}

**Version:** ${nextVersion}  
**Effective Date:** [TO BE COMPLETED]  
**CCO:** ${cco?.full_name ?? config.ccoName ?? '[CCO NAME]'}

---

## 1. Scope and Purpose

These Written Supervisory Procedures ("WSP") establish the supervisory framework for ${ctx.tenant.name} ("the Firm") as a registered investment adviser. These procedures are designed to ensure compliance with the Investment Advisers Act of 1940 and all applicable SEC regulations.

## 2. Supervisory Structure

**Chief Compliance Officer:** ${cco?.full_name ?? config.ccoName ?? '[CCO NAME]'}  
**Title:** ${cco?.title ?? config.ccoTitle ?? 'Chief Compliance Officer'}  
**Email:** ${cco?.email ?? config.ccoEmail ?? '[CCO EMAIL]'}

### Supervised Personnel

${team.filter((m: any) => m.role !== 'owner' || !m.is_cco).map((m: any) =>
  `- **${m.full_name}** — ${m.title ?? m.role}`
).join('\n')}

## 3. Communication Policies

### 3.1 Approved Communication Channels

The following channels are approved for client communications and are subject to archiving and supervisory review:

${channels.length > 0 ? channels.map(c => `- ${c}`).join('\n') : '- Platform messaging (built-in)'}

### 3.2 Prohibited Channels

The following channels are **prohibited** for client communications:
- Personal email accounts
- Personal mobile devices (SMS/iMessage) unless enrolled in approved SMS program
- WhatsApp (personal accounts)
- Signal, Telegram, or other encrypted messaging apps not enrolled in archiving

### 3.3 Archiving Requirements

All client communications via approved channels are archived in accordance with SEC Rule 204-2. Records are retained for a minimum of 5 years, with the first 2 years in immediately accessible storage.

**Archive email:** ingest-${slug}@mail.zenith-north.com

### 3.4 AI Monitoring

All communications are subject to AI-powered compliance scanning. Flagged communications are reviewed by the CCO within 5 business days.

## 4. Client Onboarding

### 4.1 Required Documents

Before opening a new client account:
1. Investment Advisory Agreement (signed)
2. Form ADV Part 2A and 2B (delivered and acknowledged)
3. Risk profile assessment (completed)
4. KYC/AML identity verification
5. Fee disclosure and acknowledgment

### 4.2 Suitability

All investment recommendations must be suitable for the client based on their risk profile, investment objectives, time horizon, and financial situation. Suitability must be reviewed annually.

## 5. Annual Reviews

All clients receive an annual review of their investment portfolio, risk profile, and financial situation. Reviews must be completed within 12 months of the client's last review date.

The CCO monitors annual review completion and will flag advisors who have not completed reviews within the required timeframe.

## 6. Advertising and Marketing

### 6.1 Pre-Approval Required

All marketing materials, social media posts, newsletters, and advertisements must receive CCO pre-approval before publication. This includes:
- LinkedIn posts referencing the Firm or client results
- Email newsletters
- Website content changes
- Press releases
- Testimonials or endorsements

### 6.2 Prohibited Claims

Marketing materials may not contain:
- Promises or guarantees of returns
- False or misleading statements
- Client testimonials without proper disclosures
- Performance data that doesn't meet SEC requirements

## 7. Gifts and Entertainment

Advisors may not accept gifts valued at more than $100 from clients or vendors without prior CCO approval. All gifts and entertainment must be logged.

## 8. Outside Business Activities

All outside business activities must be pre-approved by the CCO and disclosed on Form ADV.

## 9. Conflicts of Interest

All potential conflicts of interest must be disclosed to clients and the CCO. Known conflicts include: [LIST CONFLICTS]

## 10. Record Keeping

Records are maintained in accordance with SEC Rule 204-2:
- Client records: 5 years (2 years immediately accessible)
- Financial records: 5 years
- Communications: 5 years (2 years immediately accessible)
- This WSP: 5 years after superseded

## 11. Annual Review of WSP

These procedures are reviewed annually by the CCO and updated as needed. All supervised personnel must acknowledge receipt and understanding of these procedures.

## 12. Acknowledgment

By signing below, the CCO certifies that these procedures have been reviewed and are appropriate for the Firm's operations.

**CCO Signature:** _______________________  
**Date:** _______________________  
**Name:** ${cco?.full_name ?? config.ccoName ?? '[CCO NAME]'}
`

      const result = await db.execute(sql`
        INSERT INTO wsp_documents (tenant_id, version, content, status, created_by)
        VALUES (${ctx.tenant.id}, ${nextVersion}, ${content}, 'draft', ${ctx.user.id})
        RETURNING *
      `)

      return result.rows[0] as any
    }),

  /** Sign and activate a WSP */
  sign: withPermission('compliance.resolve')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Supersede all current active versions
      await db.execute(sql`
        UPDATE wsp_documents
        SET status = 'superseded'
        WHERE tenant_id = ${ctx.tenant.id}
          AND status = 'active'
      `)

      const result = await db.execute(sql`
        UPDATE wsp_documents
        SET status = 'active', signed_by = ${ctx.user.id},
            signed_at = NOW(), effective_at = NOW()
        WHERE id = ${input.id}
          AND tenant_id = ${ctx.tenant.id}
        RETURNING *
      `)

      // Update tenant config
      await db.execute(sql`
        UPDATE tenants
        SET config = config || ${JSON.stringify({ wspSignedAt: new Date().toISOString() })}::jsonb
        WHERE id = ${ctx.tenant.id}
      `)

      return result.rows[0] as any
    }),

  /** Update WSP content */
  update: withPermission('compliance.view')
    .input(z.object({ id: z.string().uuid(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await db.execute(sql`
        UPDATE wsp_documents
        SET content = ${input.content}
        WHERE id = ${input.id}
          AND tenant_id = ${ctx.tenant.id}
          AND status = 'draft'
      `)
      return { success: true }
    }),
})
