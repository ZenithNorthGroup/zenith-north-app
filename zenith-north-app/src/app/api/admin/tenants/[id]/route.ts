import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../../middleware'
import { db, tenants } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const result = await db.execute(sql`
    SELECT
      t.id, t.name, t.slug, t.config, t.created_at,
      COALESCE(t.config->>'plan', 'starter') as plan,
      COALESCE(t.config->>'status', 'active') as status,
      (SELECT COUNT(DISTINCT c.id) FROM clients c WHERE c.tenant_id = t.id AND c.archived_at IS NULL) as client_count,
      (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.archived_at IS NULL) as user_count,
      (SELECT COUNT(*) FROM compliance_items ci WHERE ci.tenant_id = t.id AND ci.resolved_at IS NULL AND (ci.snoozed_until IS NULL OR ci.snoozed_until < NOW())) as open_compliance_items,
      (SELECT COUNT(*) FROM compliance_items ci WHERE ci.tenant_id = t.id AND ci.severity = 'critical' AND ci.resolved_at IS NULL) as critical_items,
      (SELECT COUNT(*) FROM workflow_runs wr WHERE wr.tenant_id = t.id AND wr.completed_at IS NULL) as active_workflows,
      (SELECT COUNT(*) FROM audit_log al WHERE al.tenant_id = t.id) as total_audit_entries,
      (SELECT MAX(al.created_at) FROM audit_log al WHERE al.tenant_id = t.id) as last_activity_at,
      (SELECT MAX(c.created_at) FROM communications c WHERE c.tenant_id = t.id AND c.channel = 'email') as email_last_received
    FROM tenants t
    WHERE t.id = ${params.id} AND t.archived_at IS NULL
    LIMIT 1
  `)

  if (!result.rows.length) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const row = result.rows[0] as any
  const config = row.config as Record<string, any>

  const stats = {
    clientCount:         Number(row.client_count),
    userCount:           Number(row.user_count),
    openComplianceItems: Number(row.open_compliance_items),
    criticalItems:       Number(row.critical_items),
    activeWorkflows:     Number(row.active_workflows),
    totalAuditEntries:   Number(row.total_audit_entries),
    lastActivityAt:      row.last_activity_at,
  }

  const channels = {
    platformMessaging: true,
    email:             !!(config.emailEnabled && config.emailProvider),
    emailProvider:     config.emailProvider,
    emailLastReceived: row.email_last_received,
    sms:               !!config.twilioPhoneNumber,
    smsNumber:         config.twilioPhoneNumber,
    zoom:              !!config.zoomEnabled,
    slack:             !!config.slackEnabled,
  }

  const setup = {
    firmInfoComplete:    !!(config.crd && config.ccoName && config.ccoEmail),
    deoSigned:           !!config.deoSignedAt,
    wspSigned:           !!config.wspSignedAt,
    emailConnected:      channels.email,
    smsConnected:        channels.sms,
    firstClientImported: stats.clientCount > 0,
    firstWorkflowRun:    stats.activeWorkflows > 0 || stats.totalAuditEntries > 0,
    completedSteps:      0,
    totalSteps:          7,
    percentComplete:     0,
  }

  const steps = [setup.firmInfoComplete, setup.deoSigned, setup.wspSigned, setup.emailConnected, setup.smsConnected, setup.firstClientImported, setup.firstWorkflowRun]
  setup.completedSteps  = steps.filter(Boolean).length
  setup.percentComplete = Math.round((setup.completedSteps / setup.totalSteps) * 100)

  const healthScore = Math.min(100, [
    setup.percentComplete >= 100 ? 20 : Math.floor((setup.percentComplete / 100) * 20),
    stats.criticalItems === 0 ? 25 : stats.criticalItems <= 2 ? 12 : 0,
    channels.email ? 15 : 0,
    channels.sms   ? 10 : 0,
    setup.deoSigned ? 15 : 0,
    setup.wspSigned ? 10 : 0,
    stats.clientCount > 0 ? 5 : 0,
  ].reduce((a, b) => a + b, 0))

  return NextResponse.json({
    id: row.id, name: row.name, slug: row.slug,
    plan: row.plan, status: row.status, createdAt: row.created_at,
    config, stats, channelHealth: channels, setupProgress: setup, healthScore,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const body = await request.json()

  // Merge incoming config fields into existing config (never overwrite whole object)
  await db.execute(sql`
    UPDATE tenants
    SET config = config || ${JSON.stringify(body)}::jsonb
    WHERE id = ${params.id}
      AND archived_at IS NULL
  `)

  return NextResponse.json({ success: true })
}
