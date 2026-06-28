/**
 * POST /api/admin/tenants/create
 * Creates a new tenant (firm) with initial config, owner user,
 * default retention policies, and default onboarding workflow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../../middleware'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const body = await request.json()
  const { firmName, slug, crd, ccoName, ccoTitle, ccoEmail,
    firmAddress, aum, emailProvider, useSMS, useZoom,
    priority1, priority2, currentCRM, documentState,
    modules = {}, trainingOption, team = [] } = body

  if (!firmName || !slug || !ccoEmail) {
    return NextResponse.json({ error: 'firmName, slug, and ccoEmail are required' }, { status: 400 })
  }

  // Check slug uniqueness
  const existing = await db.execute(sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1`)
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'A firm with this slug already exists.' }, { status: 409 })
  }

  const config = {
    crd, ccoName, ccoTitle, ccoEmail, firmAddress, aum,
    emailProvider: emailProvider !== 'Email not used' ? emailProvider : null,
    emailEnabled:  emailProvider && emailProvider !== 'Email not used',
    zoomEnabled:   useZoom?.startsWith('Yes') ?? false,
    priority1, priority2, currentCRM, documentState, trainingOption,
    plan: 'professional', status: 'active',
    modules: {
      commsArchiving: modules.moduleCommsArchiving?.startsWith('Yes') ?? false,
      ai:             modules.moduleAI?.startsWith('Yes') ?? false,
      clientPortal:   modules.moduleClientPortal?.startsWith('Yes') ?? false,
      documents:      modules.moduleDocuments?.startsWith('Yes') ?? false,
      reports:        modules.moduleReports?.startsWith('Yes') ?? false,
      integrations:   modules.moduleIntegrations?.startsWith('Yes') ?? false,
    },
  }

  // 1. Create tenant
  const tenantResult = await db.execute(sql`
    INSERT INTO tenants (slug, name, config)
    VALUES (${slug}, ${firmName}, ${JSON.stringify(config)}::jsonb)
    RETURNING id, slug, name
  `)
  const tenant = tenantResult.rows[0] as any

  // 2. Create team members from wizard
  const allMembers = team.length > 0 ? team : [{
    name: ccoName ?? ccoEmail, email: ccoEmail,
    role: 'owner', isCco: true, clientScope: 'all', title: ccoTitle ?? 'Managing Partner & CCO',
  }]

  for (const member of allMembers) {
    const pid = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await db.execute(sql`
      INSERT INTO users (tenant_id, clerk_user_id, email, full_name, role, is_cco, client_scope, title)
      VALUES (${tenant.id}, ${pid}, ${member.email}, ${member.name}, ${member.role},
              ${member.isCco ?? false}, ${member.clientScope ?? 'all'}, ${member.title ?? null})
    `)
  }

  // 3. Default retention policies
  await db.execute(sql`
    INSERT INTO retention_policies (tenant_id, record_type, retain_years, immediate_access_years) VALUES
    (${tenant.id},'communication',5,2),(${tenant.id},'agreement',5,2),
    (${tenant.id},'audit_log',99,5),(${tenant.id},'meeting_recording',3,1)
  `)

  // 4. Default onboarding workflow
  const wfResult = await db.execute(sql`
    INSERT INTO workflows (tenant_id, slug, name, trigger, enabled, config)
    VALUES (${tenant.id},'client-onboarding','Client Onboarding','client.created',true,'{}'::jsonb)
    RETURNING id
  `)
  const wfId = (wfResult.rows[0] as any).id

  for (const [i, step] of [
    ['collect-info','Collect client information','{}'],
    ['kyc','KYC verification','{}'],
    ['risk-profile','Risk profile assessment','{"portal":true}'],
    ['sign-agreement','Sign investment agreement','{"portal":true}'],
    ['deliver-adv','Deliver ADV Part 2','{"portal":true}'],
    ['suitability','Suitability review','{"approver_role":"cco"}'],
    ['account-open','Account opening approval','{"approver_role":"admin"}'],
  ].entries()) {
    await db.execute(sql`
      INSERT INTO workflow_steps (workflow_id, slug, name, sort_order, required, config)
      VALUES (${wfId}, ${step[0]}, ${step[1]}, ${i + 1}, true, ${step[2]}::jsonb)
    `)
  }

  // 5. Audit entry
  await db.execute(sql`
    INSERT INTO audit_log (tenant_id, skill_slug, action, entity_type, entity_id, next_state)
    VALUES (${tenant.id},'system','tenant.created','tenant',${tenant.id},
            ${JSON.stringify({ firmName, ccoEmail })}::jsonb)
  `)

  return NextResponse.json({ success: true, tenantId: tenant.id, slug: tenant.slug, name: tenant.name })
}
