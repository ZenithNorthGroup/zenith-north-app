import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../middleware'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

function computeHealthScore(stats: any, setup: any, channels: any): number {
  let score = 0
  const weights = {
    setupComplete:   20,  // setup progress
    noOpenCritical:  25,  // no critical compliance items
    emailConnected:  15,  // email channel active
    smsConnected:    10,  // SMS channel active
    deoSigned:       15,  // DEO undertaking signed
    wspSigned:       10,  // WSP signed
    hasClients:      5,   // has at least one client
  }

  if (setup.percentComplete >= 100) score += weights.setupComplete
  else score += Math.floor((setup.percentComplete / 100) * weights.setupComplete)

  if (stats.criticalItems === 0) score += weights.noOpenCritical
  else if (stats.criticalItems <= 2) score += Math.floor(weights.noOpenCritical / 2)

  if (channels.email)  score += weights.emailConnected
  if (channels.sms)    score += weights.smsConnected
  if (setup.deoSigned) score += weights.deoSigned
  if (setup.wspSigned) score += weights.wspSigned
  if (stats.clientCount > 0) score += weights.hasClients

  return Math.min(100, score)
}

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  // Fetch all tenants with aggregated stats
  const tenants = await db.execute(sql`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.config,
      t.created_at,
      COALESCE(t.config->>'plan', 'starter') as plan,
      COALESCE(t.config->>'status', 'active') as status,

      -- Client count
      (SELECT COUNT(DISTINCT c.id)
       FROM clients c
       WHERE c.tenant_id = t.id AND c.archived_at IS NULL) as client_count,

      -- User count
      (SELECT COUNT(*)
       FROM users u
       WHERE u.tenant_id = t.id AND u.archived_at IS NULL) as user_count,

      -- Open compliance items
      (SELECT COUNT(*)
       FROM compliance_items ci
       WHERE ci.tenant_id = t.id
         AND ci.resolved_at IS NULL
         AND (ci.snoozed_until IS NULL OR ci.snoozed_until < NOW())) as open_compliance_items,

      -- Critical items
      (SELECT COUNT(*)
       FROM compliance_items ci
       WHERE ci.tenant_id = t.id
         AND ci.severity = 'critical'
         AND ci.resolved_at IS NULL) as critical_items,

      -- Active workflows
      (SELECT COUNT(*)
       FROM workflow_runs wr
       WHERE wr.tenant_id = t.id
         AND wr.completed_at IS NULL) as active_workflows,

      -- Total audit entries
      (SELECT COUNT(*)
       FROM audit_log al
       WHERE al.tenant_id = t.id) as total_audit_entries,

      -- Last activity
      (SELECT MAX(al.created_at)
       FROM audit_log al
       WHERE al.tenant_id = t.id) as last_activity_at,

      -- Email last received
      (SELECT MAX(c.created_at)
       FROM communications c
       WHERE c.tenant_id = t.id AND c.channel = 'email') as email_last_received

    FROM tenants t
    WHERE t.archived_at IS NULL
    ORDER BY t.created_at DESC
  `)

  const result = (tenants.rows as any[]).map(row => {
    const config = row.config as Record<string, any>

    const stats = {
      clientCount:        Number(row.client_count),
      userCount:          Number(row.user_count),
      openComplianceItems: Number(row.open_compliance_items),
      criticalItems:      Number(row.critical_items),
      activeWorkflows:    Number(row.active_workflows),
      totalAuditEntries:  Number(row.total_audit_entries),
      lastActivityAt:     row.last_activity_at,
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

    const steps = [
      setup.firmInfoComplete, setup.deoSigned, setup.wspSigned,
      setup.emailConnected, setup.smsConnected,
      setup.firstClientImported, setup.firstWorkflowRun,
    ]
    setup.completedSteps  = steps.filter(Boolean).length
    setup.percentComplete = Math.round((setup.completedSteps / setup.totalSteps) * 100)

    const healthScore = computeHealthScore(stats, setup, channels)

    return {
      id:        row.id,
      name:      row.name,
      slug:      row.slug,
      plan:      row.plan,
      status:    row.status,
      createdAt: row.created_at,
      config:    {
        ...config,
        integrationToken: config.integrationToken
          ? config.integrationToken.slice(0, 8) + '...'  // mask token in list view
          : undefined,
      },
      stats,
      channelHealth: channels,
      setupProgress: setup,
      healthScore,
    }
  })

  return NextResponse.json(result)
}
