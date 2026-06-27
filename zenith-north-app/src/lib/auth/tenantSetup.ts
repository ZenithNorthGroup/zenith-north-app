/**
 * ZENITH NORTH — Tenant Setup
 * Called once when a firm completes onboarding.
 * Creates: tenant, user, default skills, retention policies,
 * SEC filing calendar, and default onboarding workflow.
 */

import { db, tenants, users, tenantSkills, skills,
  retentionPolicies, calendarEvents, workflows, workflowSteps } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq } from 'drizzle-orm'

// SEC minimum retention periods (years)
const SEC_RETENTION: Array<{ recordType: string; retainYears: number }> = [
  { recordType: 'agreement',           retainYears: 5 },
  { recordType: 'trade_record',        retainYears: 5 },
  { recordType: 'communication',       retainYears: 3 },
  { recordType: 'financial_statement', retainYears: 5 },
  { recordType: 'disclosure',          retainYears: 5 },
  { recordType: 'id_verification',     retainYears: 5 },
  { recordType: 'meeting_note',        retainYears: 5 },
  { recordType: 'complaint_record',    retainYears: 3 },
  { recordType: 'advertisement',       retainYears: 5 },
]

// Default skills enabled for all plans
const DEFAULT_SKILLS = ['crm', 'documents', 'tasks', 'calendar', 'messaging']

// SEC filing deadlines (relative to current year)
function getFilingDates(year: number) {
  return [
    {
      slug:  'adv-annual-amendment',
      title: 'Form ADV annual amendment',
      // Due within 90 days of fiscal year end (assuming Dec 31)
      date:  new Date(year + 1, 2, 31), // March 31
    },
    {
      slug:  'form-pf-q1',
      title: 'Form PF — Q1 filing',
      date:  new Date(year, 4, 15), // May 15
    },
    {
      slug:  'form-pf-q2',
      title: 'Form PF — Q2 filing',
      date:  new Date(year, 7, 15), // Aug 15
    },
    {
      slug:  'form-pf-q3',
      title: 'Form PF — Q3 filing',
      date:  new Date(year, 10, 15), // Nov 15
    },
    {
      slug:  'annual-compliance-review',
      title: 'Annual compliance review',
      date:  new Date(year + 1, 0, 31), // Jan 31 following year
    },
  ]
}

export interface SetupTenantInput {
  firmName:     string
  firmSlug:     string
  plan:         'core' | 'professional' | 'enterprise'
  ownerEmail:   string
  ownerName:    string
  clerkUserId:  string
  clerkOrgId?:  string
}

export async function setupTenant(input: SetupTenantInput) {
  const {
    firmName, firmSlug, plan,
    ownerEmail, ownerName, clerkUserId, clerkOrgId,
  } = input

  return db.transaction(async (trx) => {

    // 1. Create tenant
    const [tenant] = await trx.insert(tenants).values({
      slug:       firmSlug,
      name:       firmName,
      plan,
      clerkOrgId,
      config: {
        fiscalYearEnd:        'december',
        annualReviewDays:     365,
        kycExpiryDays:        365,
        workflowStallDays:    30,
        officeLocations:      [],
      },
    }).returning()

    // Set RLS context for this transaction
    await trx.execute(`SELECT set_config('app.tenant_id', '${tenant.id}', true)`)

    // 2. Create owner user
    const [user] = await trx.insert(users).values({
      tenantId:    tenant.id,
      clerkUserId,
      email:       ownerEmail,
      fullName:    ownerName,
      role:        'owner',
    }).returning()

    // 3. Enable default skills
    const allSkills = await trx.query.skills.findMany()
    const defaultSkillSlugs = plan === 'core'
      ? DEFAULT_SKILLS
      : plan === 'professional'
      ? [...DEFAULT_SKILLS, 'compliance', 'workflows', 'audit', 'portal']
      : allSkills.map(s => s.slug)

    const skillsToEnable = allSkills.filter(s => defaultSkillSlugs.includes(s.slug))
    await trx.insert(tenantSkills).values(
      skillsToEnable.map((skill, i) => ({
        tenantId:  tenant.id,
        skillId:   skill.id,
        enabled:   true,
        sortOrder: i,
      }))
    )

    // 4. Create retention policies (SEC minimums)
    await trx.insert(retentionPolicies).values(
      SEC_RETENTION.map(r => ({
        tenantId:    tenant.id,
        recordType:  r.recordType,
        retainYears: r.retainYears,
        fromField:   'created_at',
      }))
    )

    // 5. Populate SEC filing calendar
    const thisYear = new Date().getFullYear()
    const filingDates = getFilingDates(thisYear)

    const upcomingFilings = filingDates.filter(f => f.date > new Date())
    if (upcomingFilings.length > 0) {
      await trx.insert(calendarEvents).values(
        upcomingFilings.map(f => ({
          tenantId:   tenant.id,
          eventType:  'compliance',
          title:      f.title,
          dueAt:      f.date,
          sourceType: 'sec_filing_calendar',
          sourceSlug: f.slug,
        }))
      )
    }

    // 6. Create default onboarding workflow
    const [workflow] = await trx.insert(workflows).values({
      tenantId: tenant.id,
      slug:     'client-onboarding',
      name:     'Client onboarding',
      trigger:  'client.created',
      enabled:  true,
    }).returning()

    const defaultSteps = [
      { slug: 'collect-info',      name: 'Collect client information',   sortOrder: 1, config: { assignee: 'advisor',  deadline_days: 3 } },
      { slug: 'kyc-verification',  name: 'KYC verification',             sortOrder: 2, config: { assignee: 'advisor',  deadline_days: 3 } },
      { slug: 'risk-profile',      name: 'Risk profile assessment',      sortOrder: 3, config: { assignee: 'client',   portal: true, deadline_days: 14 } },
      { slug: 'sign-agreement',    name: 'Investment advisory agreement', sortOrder: 4, config: { assignee: 'client',   portal: true, requires_signature: true } },
      { slug: 'deliver-adv',       name: 'Deliver ADV Part 2',           sortOrder: 5, config: { assignee: 'client',   portal: true, requires_acknowledgment: true } },
      { slug: 'internal-approval', name: 'Internal approval',            sortOrder: 6, config: { assignee: 'admin',    deadline_days: 2 } },
      { slug: 'open-account',      name: 'Open account',                 sortOrder: 7, config: { assignee: 'advisor' } },
    ]

    await trx.insert(workflowSteps).values(
      defaultSteps.map(step => ({
        workflowId: workflow.id,
        skillSlug:  'workflows',
        ...step,
      }))
    )

    // 7. Write audit log entry for setup
    await trx.insert(require('@/lib/db/schema').auditLog).values({
      tenantId:   tenant.id,
      userId:     user.id,
      skillSlug:  'system',
      action:     'tenant.setup_completed',
      entityType: 'tenant',
      entityId:   tenant.id,
      nextState: {
        plan,
        skillsEnabled: defaultSkillSlugs.length,
        retentionPolicies: SEC_RETENTION.length,
        filingDeadlines: upcomingFilings.length,
        defaultWorkflow: 'client-onboarding',
      },
    })

    return { tenant, user, workflow }
  })
}
