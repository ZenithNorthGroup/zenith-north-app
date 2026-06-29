/**
 * POST /api/ai/ask
 * AI assistant endpoint — answers questions using firm context.
 * Rate limited: 20 requests per minute per tenant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { withErrorHandling, checkRateLimit, rateLimitResponse } from '@/lib/api-error'

const anthropic = new Anthropic()

async function buildFirmContext(tenantId: string): Promise<string> {
  try {
    const [clientStats, complianceItems, recentWorkflows, teamMembers] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE data->>'status' = 'active') as active,
          COUNT(*) FILTER (WHERE data->>'kycStatus' = 'needs_review') as kyc_review
        FROM (
          SELECT DISTINCT ON (id) id, data FROM clients
          WHERE tenant_id = ${tenantId} AND archived_at IS NULL
          ORDER BY id, version DESC
        ) latest_clients
      `),
      db.execute(sql`
        SELECT item_type, severity, title
        FROM compliance_items
        WHERE tenant_id = ${tenantId}
          AND resolved_at IS NULL
          AND archived_at IS NULL
        ORDER BY severity DESC, created_at DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT wr.status, wr.started_at,
          TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName','')) as client_name
        FROM workflow_runs wr
        LEFT JOIN LATERAL (
          SELECT data FROM clients WHERE id = wr.entity_id AND tenant_id = ${tenantId}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE wr.tenant_id = ${tenantId} AND wr.completed_at IS NULL
        ORDER BY wr.started_at DESC LIMIT 5
      `),
      db.execute(sql`
        SELECT full_name, role, is_cco FROM users
        WHERE tenant_id = ${tenantId} AND archived_at IS NULL
      `),
    ])

    const cs = (clientStats.rows[0] as any) ?? {}
    return `
FIRM CONTEXT:
- Total clients: ${cs.total ?? 0} (${cs.active ?? 0} active, ${cs.kyc_review ?? 0} needing KYC review)
- Open compliance items: ${complianceItems.rows.length}
${(complianceItems.rows as any[]).map(i => `  • [${i.severity?.toUpperCase()}] ${i.title}`).join('\n')}
- Active onboardings: ${recentWorkflows.rows.length}
${(recentWorkflows.rows as any[]).map(r => `  • ${r.client_name ?? 'Unknown'} — ${r.status?.replace(/_/g,' ')}`).join('\n')}
- Team members: ${(teamMembers.rows as any[]).map(m => `${m.full_name} (${m.role}${m.is_cco ? ', CCO' : ''})`).join(', ')}
`.trim()
  } catch {
    return 'Firm context unavailable.'
  }
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find tenant
  const userResult = await db.execute(sql`
    SELECT u.tenant_id, t.name as tenant_name
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    WHERE u.clerk_user_id = ${userId}
      AND u.archived_at IS NULL
    LIMIT 1
  `)
  if (!userResult.rows.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const { tenant_id: tenantId } = userResult.rows[0] as any

  // Rate limit: 20 requests per minute per tenant
  const rl = checkRateLimit(`ai:${tenantId}`, 20, 60000)
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const body = await request.json()
  const { question, history = [] } = body

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: 'Question too long (max 2000 characters)' }, { status: 400 })
  }

  const firmContext = await buildFirmContext(tenantId)

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-10), // Last 10 exchanges for context
    { role: 'user', content: question.trim() },
  ]

  const response = await anthropic.messages.create({
    model:  'claude-sonnet-4-6',
    max_tokens: 1000,
    system: `You are an AI assistant for a registered investment adviser (RIA) using Zenith North compliance software.
You help advisors, CCOs, and operations staff with questions about their clients, compliance requirements, workflows, and firm operations.

PRIVACY RULES:
- Never include SSNs, account numbers, or passwords in responses
- Treat all client information as confidential
- Do not make specific investment recommendations

CURRENT FIRM DATA:
${firmContext}

Be concise, accurate, and compliance-aware. If asked about something you don't have data for, say so clearly.`,
    messages,
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text : ''

  return NextResponse.json({ answer, usage: response.usage })
})
