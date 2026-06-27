/**
 * ZENITH NORTH — AI Assistant API
 *
 * POST /api/ai/ask
 *
 * Answers natural language questions about the firm's data.
 * Has access to:
 *   - All clients (names, status, KYC, review dates)
 *   - All compliance items (open, resolved, critical)
 *   - All workflow runs (stalled, awaiting, complete)
 *   - All flagged communications
 *   - Audit log summary
 *   - Upcoming calendar events
 *
 * The AI is given a snapshot of the firm's current state as
 * context, then answers the advisor's question.
 *
 * PRIVACY: No client PII (SSN, account numbers) is sent to the AI.
 * Only names, status fields, dates, and counts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

const anthropic = new Anthropic()

// ── Firm context builder ───────────────────────────────────

async function buildFirmContext(tenantId: string): Promise<string> {
  const now = new Date()

  const [
    clientStats,
    openComplianceItems,
    workflowSummary,
    flaggedComms,
    upcomingEvents,
    recentAudit,
  ] = await Promise.all([

    // Client overview
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE data->>'status' = 'active')  as active,
        COUNT(*) FILTER (WHERE data->>'status' = 'prospect') as prospects,
        COUNT(*) FILTER (WHERE data->>'kycStatus' = 'needs_review') as kyc_needs_review,
        COUNT(*) FILTER (
          WHERE data->>'annualReviewDue' IS NOT NULL
          AND (data->>'annualReviewDue')::date < CURRENT_DATE
        ) as overdue_reviews,
        COUNT(*) FILTER (
          WHERE data->>'annualReviewDue' IS NOT NULL
          AND (data->>'annualReviewDue')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ) as upcoming_reviews
      FROM (
        SELECT DISTINCT ON (id) id, data
        FROM clients
        WHERE tenant_id = ${tenantId}
          AND archived_at IS NULL
        ORDER BY id, version DESC
      ) latest_clients
    `),

    // Open compliance items
    db.execute(sql`
      SELECT
        item_type, severity, title, due_date, client_id
      FROM compliance_items
      WHERE tenant_id = ${tenantId}
        AND resolved_at IS NULL
        AND (snoozed_until IS NULL OR snoozed_until < NOW())
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'warning'  THEN 2
          ELSE 3
        END,
        created_at DESC
      LIMIT 20
    `),

    // Workflow runs summary
    db.execute(sql`
      SELECT
        status,
        COUNT(*) as count,
        MAX(EXTRACT(EPOCH FROM NOW() - COALESCE(updated_at, started_at)) / 86400) as max_days_stalled
      FROM workflow_runs
      WHERE tenant_id = ${tenantId}
        AND completed_at IS NULL
      GROUP BY status
    `),

    // Unreviewed AI flags
    db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ai_severity = 'high') as high,
        COUNT(*) FILTER (WHERE ai_severity = 'medium') as medium
      FROM communications
      WHERE tenant_id = ${tenantId}
        AND ai_flagged = true
        AND reviewed_at IS NULL
        AND archived_at IS NULL
    `),

    // Upcoming calendar events (next 60 days)
    db.execute(sql`
      SELECT title, event_type, due_at
      FROM calendar_events
      WHERE tenant_id = ${tenantId}
        AND due_at BETWEEN NOW() AND NOW() + INTERVAL '60 days'
      ORDER BY due_at
      LIMIT 10
    `),

    // Recent audit activity
    db.execute(sql`
      SELECT action, skill_slug, created_at
      FROM audit_log
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 20
    `),
  ])

  const stats     = clientStats.rows[0] as any
  const workflows = workflowSummary.rows as any[]
  const flags     = flaggedComms.rows[0] as any
  const items     = openComplianceItems.rows as any[]
  const events    = upcomingEvents.rows as any[]
  const activity  = recentAudit.rows as any[]

  return `
FIRM DATA SNAPSHOT — ${now.toISOString()}
You are an AI assistant for a registered investment adviser (RIA) using Zenith North.

═══════════════════════════════════════
CLIENT OVERVIEW
═══════════════════════════════════════
Active clients:         ${stats.active ?? 0}
Prospects:              ${stats.prospects ?? 0}
KYC needs review:       ${stats.kyc_needs_review ?? 0}
Overdue annual reviews: ${stats.overdue_reviews ?? 0}
Reviews due in 30 days: ${stats.upcoming_reviews ?? 0}

═══════════════════════════════════════
OPEN COMPLIANCE ITEMS (${items.length} total)
═══════════════════════════════════════
${items.length === 0
    ? 'No open compliance items.'
    : items.map(i =>
        `[${i.severity?.toUpperCase()}] ${i.title}${i.due_date ? ` · Due: ${new Date(i.due_date).toLocaleDateString()}` : ''}`
      ).join('\n')
  }

═══════════════════════════════════════
ACTIVE WORKFLOWS
═══════════════════════════════════════
${workflows.length === 0
    ? 'No active workflows.'
    : workflows.map(w =>
        `${w.status}: ${w.count} run(s)${w.max_days_stalled > 14 ? ` · MAX ${Math.floor(w.max_days_stalled)} days stalled` : ''}`
      ).join('\n')
  }

═══════════════════════════════════════
COMMUNICATION FLAGS
═══════════════════════════════════════
Total unreviewed:  ${flags.total ?? 0}
High severity:     ${flags.high ?? 0}
Medium severity:   ${flags.medium ?? 0}

═══════════════════════════════════════
UPCOMING EVENTS (60 days)
═══════════════════════════════════════
${events.length === 0
    ? 'No upcoming events.'
    : events.map(e =>
        `${new Date(e.due_at).toLocaleDateString()} · ${e.title}`
      ).join('\n')
  }

═══════════════════════════════════════
RECENT ACTIVITY (last 20 entries)
═══════════════════════════════════════
${activity.map(a =>
    `${new Date(a.created_at).toLocaleString()} · [${a.skill_slug}] ${a.action}`
  ).join('\n')}
`.trim()
}

// ── Route handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { question, history = [] } = body

  if (!question?.trim()) {
    return NextResponse.json({ error: 'Question required' }, { status: 400 })
  }

  // Resolve tenant
  const userResult = await db.execute(sql`
    SELECT id, tenant_id, full_name, role
    FROM users
    WHERE clerk_user_id = ${userId}
      AND archived_at IS NULL
    LIMIT 1
  `)

  if (!userResult.rows.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const user = userResult.rows[0] as { id: string; tenant_id: string; full_name: string; role: string }

  // Build firm context snapshot
  const firmContext = await buildFirmContext(user.tenant_id)

  // Build conversation history for Claude
  const messages: Anthropic.MessageParam[] = [
    // Inject firm context as first user message
    {
      role:    'user',
      content: `Here is the current state of my firm:\n\n${firmContext}\n\nPlease use this data to answer my questions.`,
    },
    {
      role:    'assistant',
      content: `I have your firm's current data loaded. I can see your client overview, open compliance items, workflow status, communication flags, and recent activity. What would you like to know?`,
    },
    // Prior conversation history
    ...history.map((msg: { role: string; content: string }) => ({
      role:    msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    // Current question
    {
      role:    'user',
      content: question,
    },
  ]

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1000,
    system: `You are an expert compliance AI assistant for ${user.full_name}'s registered investment adviser firm, operating within Zenith North — an RIA compliance platform.

You have access to real-time data about the firm including:
- Client records, status, and compliance standing
- Open compliance items requiring action
- Workflow run status and bottlenecks
- Communication flags and review queue
- Upcoming regulatory deadlines and calendar events
- Audit log activity

Your job is to:
1. Answer questions about the firm's current state accurately
2. Surface important compliance issues the advisor may have missed
3. Suggest specific action items when appropriate
4. Explain SEC/FINRA regulatory requirements when asked
5. Help the advisor prepare for examinations

You do NOT have access to:
- Specific dollar amounts or account balances
- Social Security Numbers or government IDs
- Specific investment holdings or transactions
- Banking or custodian data

Be concise, specific, and action-oriented. Use bullet points for lists.
When referencing specific compliance items, include the severity and any due dates.
Always remind advisors that your responses are not legal advice.`,
    messages,
  })

  const answer = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  return NextResponse.json({ answer })
}
