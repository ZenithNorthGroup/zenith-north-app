/**
 * POST /api/compliance/wsp
 * Generates the Written Supervisory Procedures document.
 * Called during firm setup and for annual review.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { generateWSP, type FirmConfig } from '@/lib/compliance/wsp'
import { writeAudit } from '@/lib/audit'
import { sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Resolve tenant from Clerk user
  const userResult = await db.execute(sql`
    SELECT u.id, u.tenant_id, u.full_name, u.role, t.slug, t.name, t.config
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    WHERE u.clerk_user_id = ${userId}
      AND u.archived_at IS NULL
    LIMIT 1
  `)

  if (!userResult.rows.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const user   = userResult.rows[0] as any
  const config = user.config as Record<string, unknown>

  // Build WSP config from tenant + request body
  const wspConfig: FirmConfig = {
    firmName:         user.name,
    firmCRD:          (config.crd as string) ?? body.firmCRD ?? 'PENDING',
    firmAddress:      (config.address as string) ?? body.firmAddress ?? '',
    firmState:        (config.state as string) ?? body.firmState ?? '',
    registrationType: (config.registrationType as 'SEC' | 'state') ?? 'SEC',
    ccoName:          (config.ccoName as string) ?? body.ccoName ?? user.full_name,
    ccoTitle:         (config.ccoTitle as string) ?? body.ccoTitle ?? 'Chief Compliance Officer',
    ccoEmail:         (config.ccoEmail as string) ?? body.ccoEmail ?? '',
    principalName:    (config.principalName as string) ?? body.principalName ?? user.full_name,
    principalTitle:   (config.principalTitle as string) ?? body.principalTitle ?? 'Principal',
    channels: {
      platformMessaging: true,
      email:             (config.emailEnabled as boolean) ?? body.emailEnabled ?? true,
      emailProvider:     (config.emailProvider as any) ?? body.emailProvider ?? 'microsoft365',
      sms:               (config.smsEnabled as boolean) ?? body.smsEnabled ?? true,
      zoom:              (config.zoomEnabled as boolean) ?? body.zoomEnabled ?? false,
      slack:             (config.slackEnabled as boolean) ?? body.slackEnabled ?? false,
      linkedin:          (config.linkedinEnabled as boolean) ?? body.linkedinEnabled ?? false,
      twitter:           (config.twitterEnabled as boolean) ?? body.twitterEnabled ?? false,
    },
    retentionYears:       5,
    immediateAccessYears: 2,
    reviewFrequency:      'annual',
    effectiveDate:        new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }),
    signedDate: body.signed ? new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }) : undefined,
    signedBy: body.signed ? (config.ccoName as string) ?? user.full_name : undefined,
  }

  const wspText = generateWSP(wspConfig)

  // Write audit log
  await writeAudit(
    { tenantId: user.tenant_id, userId: user.id },
    {
      skillSlug:  'compliance',
      action:     'wsp.generated',
      entityType: 'tenant',
      entityId:   user.tenant_id,
      metadata: {
        channels:   Object.entries(wspConfig.channels)
          .filter(([_, v]) => v)
          .map(([k]) => k),
        signed:     !!body.signed,
      },
    }
  )

  return NextResponse.json({
    wsp:          wspText,
    effectiveDate: wspConfig.effectiveDate,
    channels:     wspConfig.channels,
    wordCount:    wspText.split(' ').length,
  })
}
