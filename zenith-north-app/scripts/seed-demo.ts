/**
 * ZENITH NORTH — Demo Seed Script
 *
 * Creates a complete demo environment for sales demos.
 * Run once against a fresh Neon database.
 *
 * Creates:
 *   - 1 demo firm (Wright Advisory LLC)
 *   - 1 admin user (you)
 *   - 12 demo clients with realistic data
 *   - 3 active onboarding workflows in different states
 *   - Open compliance items (overdue review, missing KYC, upcoming ADV)
 *   - Sample communications with 1 AI flag
 *   - Sample documents (signed + unsigned)
 *   - SEC filing calendar event
 *   - Audit log entries
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *
 * Env vars required:
 *   DATABASE_URL — your Neon connection string
 *   DEMO_USER_CLERK_ID — your Clerk user ID (from dashboard.clerk.com)
 */

import { db } from '../src/lib/db'
import { sql } from 'drizzle-orm'
import {
  tenants, users, clients, workflows, workflowSteps,
  workflowRuns, workflowStepCompletions, complianceItems,
  communications, documents, calendarEvents, auditLog,
  retentionPolicies,
} from '../src/lib/db/schema'

const DEMO_CLERK_USER_ID = process.env.DEMO_USER_CLERK_ID ?? 'user_demo'

// ── Demo data ──────────────────────────────────────────────

const DEMO_CLIENTS = [
  {
    firstName: 'Margaret',    lastName: 'Chen',
    email: 'margaret.chen@email.com',    phone: '415-555-0101',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2025-01-15',  // OVERDUE — good for demo
    clientType: 'individual',
  },
  {
    firstName: 'Robert',     lastName: 'Walsh',
    email: 'robert.walsh@email.com',     phone: '415-555-0102',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2025-03-20',  // overdue
    clientType: 'individual',
  },
  {
    firstName: 'Sandra',     lastName: 'Chukwu',
    email: 'sandra.chukwu@email.com',    phone: '415-555-0103',
    status: 'prospect', kycStatus: 'needs_review',
    clientType: 'individual',
  },
  {
    firstName: 'Marcus',     lastName: 'Oyelaran',
    email: 'marcus.oyelaran@email.com',  phone: '415-555-0104',
    status: 'prospect', kycStatus: 'needs_review',
    clientType: 'individual',
  },
  {
    firstName: 'David',      lastName: 'Kim',
    email: 'david.kim@email.com',        phone: '415-555-0105',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2026-08-10',
    clientType: 'individual',
  },
  {
    firstName: 'Priya',      lastName: 'Nair',
    email: 'priya.nair@email.com',       phone: '415-555-0106',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2026-09-22',
    clientType: 'individual',
  },
  {
    firstName: 'Thomas',     lastName: 'Park',
    email: 'thomas.park@email.com',      phone: '415-555-0107',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2026-10-05',
    clientType: 'individual',
  },
  {
    firstName: 'Jennifer',   lastName: 'Holloway',
    email: 'jennifer.holloway@email.com',phone: '415-555-0108',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2026-11-14',
    clientType: 'trust',
  },
  {
    firstName: 'Brian',      lastName: 'Tran',
    email: 'brian.tran@email.com',       phone: '415-555-0109',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2026-12-01',
    clientType: 'individual',
  },
  {
    firstName: 'Rachel',     lastName: 'Goldberg',
    email: 'rachel.goldberg@email.com',  phone: '415-555-0110',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2027-01-08',
    clientType: 'individual',
  },
  {
    firstName: 'Pacific',    lastName: 'Ventures LLC',
    email: 'admin@pacificventures.com',  phone: '415-555-0111',
    status: 'active', kycStatus: 'verified',
    annualReviewDue: '2026-07-30',
    clientType: 'entity',
  },
  {
    firstName: 'Eleanor',    lastName: 'Fitzgerald',
    email: 'eleanor.f@email.com',        phone: '415-555-0112',
    status: 'inactive', kycStatus: 'verified',
    clientType: 'individual',
  },
]

async function seed() {
  console.log('🌱 Seeding demo data...\n')

  // ── 1. Create tenant ──────────────────────────────────────

  console.log('Creating firm: Wright Advisory LLC')
  const [tenant] = await db.insert(tenants).values({
    name:   'Wright Advisory LLC',
    slug:   'wright-advisory',
    config: {
      plan:             'professional',
      status:           'active',
      crd:              '123456',
      ccoName:          'James Wright',
      ccoTitle:         'Chief Compliance Officer',
      ccoEmail:         'james@wrightadvisory.com',
      address:          '100 California Street, Suite 1200, San Francisco, CA 94111',
      firmState:        'CA',
      registrationType: 'SEC',
      emailProvider:    'microsoft365',
      emailEnabled:     true,
      twilioPhoneNumber: '+14155550100',
      deoSignedAt:      new Date().toISOString(),
      wspSignedAt:      new Date().toISOString(),
      integrationToken: 'zn_live_demo_' + Math.random().toString(36).slice(2),
    },
  }).returning()

  console.log(`  ✓ Tenant created: ${tenant.id}`)

  // ── 2. Create user ────────────────────────────────────────

  const [user] = await db.insert(users).values({
    tenantId:    tenant.id,
    clerkUserId: DEMO_CLERK_USER_ID,
    email:       'james@wrightadvisory.com',
    fullName:    'James Wright',
    role:        'admin',
  }).returning()

  console.log(`  ✓ User created: ${user.id}`)

  // ── 3. Retention policies ─────────────────────────────────

  await db.insert(retentionPolicies).values([
    { tenantId: tenant.id, recordType: 'communication', retainYears: 5, immediateAccessYears: 2 },
    { tenantId: tenant.id, recordType: 'agreement',     retainYears: 5, immediateAccessYears: 2 },
    { tenantId: tenant.id, recordType: 'audit_log',     retainYears: 99, immediateAccessYears: 5 },
  ])

  // ── 4. Create clients ──────────────────────────────────────

  console.log('\nCreating 12 demo clients...')
  const clientIds: string[] = []

  for (const clientData of DEMO_CLIENTS) {
    const [client] = await db.insert(clients).values({
      tenantId:  tenant.id,
      version:   1,
      data:      clientData,
      createdBy: user.id,
    }).returning()
    clientIds.push(client.id)
    process.stdout.write('.')
  }
  console.log(`\n  ✓ ${clientIds.length} clients created`)

  // ── 5. Create workflow definition ─────────────────────────

  console.log('\nCreating onboarding workflow...')
  const [workflow] = await db.insert(workflows).values({
    tenantId: tenant.id,
    slug:     'client-onboarding',
    name:     'Client Onboarding',
    trigger:  'client.created',
    enabled:  true,
  }).returning()

  const STEPS = [
    { slug: 'collect-info',      name: 'Collect client information', sortOrder: 1, required: true, config: {} },
    { slug: 'kyc-verification',  name: 'KYC verification',           sortOrder: 2, required: true, config: {} },
    { slug: 'risk-profile',      name: 'Risk profile assessment',    sortOrder: 3, required: true, config: { portal: true } },
    { slug: 'sign-agreement',    name: 'Sign investment agreement',  sortOrder: 4, required: true, config: { portal: true, requires_signature: true } },
    { slug: 'deliver-adv',       name: 'Deliver ADV Part 2',         sortOrder: 5, required: true, config: { portal: true } },
    { slug: 'suitability',       name: 'Suitability review',         sortOrder: 6, required: true, config: { approver_role: 'cco' } },
    { slug: 'account-opening',   name: 'Account opening approval',  sortOrder: 7, required: true, config: { approver_role: 'admin' } },
  ]

  const stepRecords = await db.insert(workflowSteps).values(
    STEPS.map(s => ({ ...s, workflowId: workflow.id }))
  ).returning()

  console.log(`  ✓ Workflow created with ${stepRecords.length} steps`)

  // ── 6. Create workflow runs in different states ────────────

  console.log('\nCreating 3 demo workflow runs...')

  // Run 1: Sandra Chukwu — awaiting CCO approval (step 6)
  const [run1] = await db.insert(workflowRuns).values({
    workflowId: workflow.id,
    tenantId:   tenant.id,
    entityType: 'client',
    entityId:   clientIds[2], // Sandra Chukwu
    status:     'awaiting_approval',
    startedAt:  new Date(Date.now() - 5 * 86400000),
  }).returning()

  await db.insert(workflowStepCompletions).values(
    stepRecords.map((step, i) => ({
      runId:       run1.id,
      stepId:      step.id,
      status:      i < 5 ? 'complete' : 'pending',
      completedAt: i < 5 ? new Date(Date.now() - (5 - i) * 86400000) : null,
      completedBy: i < 5 ? user.id : null,
      completedType: i < 5 ? 'advisor' : null,
    }))
  )

  // Run 2: Marcus Oyelaran — awaiting client (step 3, stalled 16 days)
  const [run2] = await db.insert(workflowRuns).values({
    workflowId: workflow.id,
    tenantId:   tenant.id,
    entityType: 'client',
    entityId:   clientIds[3], // Marcus Oyelaran
    status:     'awaiting_client',
    startedAt:  new Date(Date.now() - 16 * 86400000),
  }).returning()

  await db.insert(workflowStepCompletions).values(
    stepRecords.map((step, i) => ({
      runId:       run2.id,
      stepId:      step.id,
      status:      i < 2 ? 'complete' : 'pending',
      completedAt: i < 2 ? new Date(Date.now() - (16 - i) * 86400000) : null,
      completedBy: i < 2 ? user.id : null,
      completedType: i < 2 ? 'advisor' : null,
    }))
  )

  // Run 3: Brian Tran — complete
  const [run3] = await db.insert(workflowRuns).values({
    workflowId:  workflow.id,
    tenantId:    tenant.id,
    entityType:  'client',
    entityId:    clientIds[8], // Brian Tran
    status:      'complete',
    startedAt:   new Date(Date.now() - 45 * 86400000),
    completedAt: new Date(Date.now() - 30 * 86400000),
  }).returning()

  await db.insert(workflowStepCompletions).values(
    stepRecords.map((step, i) => ({
      runId:       run3.id,
      stepId:      step.id,
      status:      'complete',
      completedAt: new Date(Date.now() - (45 - i * 2) * 86400000),
      completedBy: user.id,
      completedType: i % 2 === 0 ? 'advisor' : 'client',
    }))
  )

  console.log('  ✓ 3 workflow runs created')

  // ── 7. Compliance items ───────────────────────────────────

  console.log('\nCreating compliance items...')
  await db.insert(complianceItems).values([
    {
      tenantId:    tenant.id,
      clientId:    clientIds[0], // Margaret Chen
      itemType:    'annual_review_overdue',
      severity:    'critical',
      title:       'Annual review overdue — Margaret Chen',
      description: 'Review was due January 15, 2025. Now 161 days overdue.',
      dueDate:     new Date('2025-01-15'),
    },
    {
      tenantId:    tenant.id,
      clientId:    clientIds[1], // Robert Walsh
      itemType:    'annual_review_overdue',
      severity:    'warning',
      title:       'Annual review overdue — Robert Walsh',
      description: 'Review was due March 20, 2025.',
      dueDate:     new Date('2025-03-20'),
    },
    {
      tenantId:    tenant.id,
      clientId:    clientIds[2], // Sandra Chukwu
      itemType:    'kyc_expiry',
      severity:    'warning',
      title:       'KYC verification required — Sandra Chukwu',
      description: 'Client identity verification not completed.',
    },
    {
      tenantId:    tenant.id,
      itemType:    'sec_filing_due',
      severity:    'warning',
      title:       'Form ADV annual amendment due in 62 days',
      description: 'Form ADV annual amendment must be filed by March 31, 2027.',
      dueDate:     new Date('2027-03-31'),
    },
    {
      tenantId:    tenant.id,
      clientId:    clientIds[3], // Marcus Oyelaran
      itemType:    'stalled_workflow',
      severity:    'warning',
      title:       'Onboarding stalled for 16 days — Marcus Oyelaran',
      description: 'Workflow has been awaiting client action for 16 days without progress.',
    },
  ])

  console.log('  ✓ 5 compliance items created')

  // ── 8. Sample communications ──────────────────────────────

  console.log('\nCreating sample communications...')
  const threadId1 = crypto.randomUUID()
  const threadId2 = crypto.randomUUID()
  const threadId3 = crypto.randomUUID()

  await db.insert(communications).values([
    // David Kim — outbound with AI flag
    {
      tenantId:    tenant.id,
      threadId:    threadId1,
      clientId:    clientIds[4], // David Kim
      fromUserId:  user.id,
      channel:     'platform',
      direction:   'outbound',
      subject:     'Q3 portfolio update',
      body:        'David, your portfolio is up 12% this quarter. Based on current momentum, I expect we\'ll easily hit 20% returns by year end. The tech positions have been particularly strong.',
      bodyEncrypted: Buffer.from('...').toString('base64'),
      aiScanned:   true,
      aiFlagged:   true,
      aiSeverity:  'high',
      aiReason:    'Return guarantee — specific performance promise made without required disclosures',
      aiExcerpt:   'I expect we\'ll easily hit 20% returns by year end',
      createdAt:   new Date(Date.now() - 2 * 86400000),
    },
    // David Kim — inbound reply
    {
      tenantId:    tenant.id,
      threadId:    threadId1,
      clientId:    clientIds[4],
      fromUserId:  null,
      channel:     'platform',
      direction:   'inbound',
      body:        'That\'s great news James! Looking forward to seeing that growth continue.',
      bodyEncrypted: Buffer.from('...').toString('base64'),
      aiScanned:   true,
      aiFlagged:   false,
      createdAt:   new Date(Date.now() - 2 * 86400000 + 3600000),
    },
    // Brian Tran — clean email exchange
    {
      tenantId:    tenant.id,
      threadId:    threadId2,
      clientId:    clientIds[8], // Brian Tran
      fromUserId:  user.id,
      channel:     'email',
      direction:   'outbound',
      subject:     'Annual review meeting — Brian Tran',
      body:        'Hi Brian, I\'d like to schedule your annual portfolio review. Can you do Tuesday at 2pm? We\'ll review your current allocation and discuss any changes to your goals.',
      bodyEncrypted: Buffer.from('...').toString('base64'),
      aiScanned:   true,
      aiFlagged:   false,
      createdAt:   new Date(Date.now() - 7 * 86400000),
    },
    // Margaret Chen — SMS
    {
      tenantId:    tenant.id,
      threadId:    threadId3,
      clientId:    clientIds[0], // Margaret Chen
      fromUserId:  user.id,
      channel:     'sms',
      direction:   'outbound',
      body:        'Hi Margaret, just a reminder that your annual review is overdue. Can we schedule a call this week?',
      bodyEncrypted: Buffer.from('...').toString('base64'),
      aiScanned:   true,
      aiFlagged:   false,
      createdAt:   new Date(Date.now() - 86400000),
    },
  ])

  console.log('  ✓ 4 sample communications created (1 flagged)')

  // ── 9. Sample documents ───────────────────────────────────

  console.log('\nCreating sample documents...')
  await db.insert(documents).values([
    {
      tenantId:    tenant.id,
      clientId:    clientIds[8], // Brian Tran
      createdBy:   user.id,
      skillSlug:   'crm',
      name:        'Investment Advisory Agreement — Brian Tran',
      docType:     'agreement',
      storagePath: 'documents/demo/brian-tran-agreement.pdf',
      mimeType:    'application/pdf',
      sizeBytes:   245000,
      signedAt:    new Date(Date.now() - 40 * 86400000),
    },
    {
      tenantId:    tenant.id,
      clientId:    clientIds[8],
      createdBy:   user.id,
      skillSlug:   'crm',
      name:        'ADV Part 2 — Brian Tran',
      docType:     'disclosure',
      storagePath: 'documents/demo/brian-tran-adv.pdf',
      mimeType:    'application/pdf',
      sizeBytes:   182000,
      signedAt:    new Date(Date.now() - 40 * 86400000),
    },
    {
      tenantId:    tenant.id,
      clientId:    clientIds[2], // Sandra Chukwu
      createdBy:   user.id,
      skillSlug:   'crm',
      name:        'Investment Advisory Agreement — Sandra Chukwu',
      docType:     'agreement',
      storagePath: 'documents/demo/sandra-chukwu-agreement.pdf',
      mimeType:    'application/pdf',
      sizeBytes:   245000,
      signedAt:    null,  // unsigned — good for demo
    },
  ])

  console.log('  ✓ 3 documents created (1 unsigned)')

  // ── 10. Calendar events ───────────────────────────────────

  console.log('\nCreating calendar events...')
  await db.insert(calendarEvents).values([
    {
      tenantId:  tenant.id,
      eventType: 'compliance',
      title:     'Form ADV Annual Amendment Due',
      dueAt:     new Date('2027-03-31'),
      sourceType: 'compliance_engine',
    },
    {
      tenantId:  tenant.id,
      clientId:  clientIds[0],
      eventType: 'client_review',
      title:     'Annual review — Margaret Chen (OVERDUE)',
      dueAt:     new Date('2025-01-15'),
      sourceType: 'compliance_engine',
    },
    {
      tenantId:  tenant.id,
      clientId:  clientIds[8],
      eventType: 'meeting',
      title:     'Q3 review meeting — Brian Tran',
      dueAt:     new Date(Date.now() + 7 * 86400000),
      sourceType: 'manual',
    },
  ])

  console.log('  ✓ 3 calendar events created')

  // ── 11. Audit log ─────────────────────────────────────────

  console.log('\nCreating audit log entries...')
  const auditEntries = [
    { action: 'tenant.created',     skillSlug: 'system',     entityType: 'tenant',    entityId: tenant.id },
    { action: 'user.created',       skillSlug: 'system',     entityType: 'user',      entityId: user.id },
    { action: 'client.created',     skillSlug: 'crm',        entityType: 'client',    entityId: clientIds[0] },
    { action: 'workflow.started',   skillSlug: 'workflows',  entityType: 'workflow_run', entityId: run1.id },
    { action: 'step.completed',     skillSlug: 'workflows',  entityType: 'workflow_run', entityId: run1.id },
    { action: 'msg.sent',           skillSlug: 'messaging',  entityType: 'client',    entityId: clientIds[4] },
    { action: 'msg.flagged',        skillSlug: 'messaging',  entityType: 'client',    entityId: clientIds[4] },
    { action: 'compliance.engine_ran', skillSlug: 'compliance', entityType: 'tenant', entityId: tenant.id },
    { action: 'import.completed',   skillSlug: 'crm',        entityType: 'tenant',    entityId: tenant.id },
    { action: 'workflow.completed', skillSlug: 'workflows',  entityType: 'workflow_run', entityId: run3.id },
  ]

  await db.insert(auditLog).values(
    auditEntries.map((entry, i) => ({
      ...entry,
      tenantId:  tenant.id,
      userId:    user.id,
      ipAddress: '127.0.0.1',
      createdAt: new Date(Date.now() - (auditEntries.length - i) * 3600000 * 4),
    }))
  )

  console.log(`  ✓ ${auditEntries.length} audit entries created`)

  // ── Summary ───────────────────────────────────────────────

  console.log('\n' + '─'.repeat(50))
  console.log('✅ Demo seed complete!\n')
  console.log('Firm:      Wright Advisory LLC')
  console.log('Slug:      wright-advisory')
  console.log('Tenant ID:', tenant.id)
  console.log('User ID:  ', user.id)
  console.log('\nDemo credentials:')
  console.log('  Sign in with your Clerk account at /sign-in')
  console.log('  Clerk user ID:', DEMO_CLERK_USER_ID)
  console.log('\nWhat to show in the demo:')
  console.log('  1. Dashboard → 2 critical, 3 warning compliance items visible immediately')
  console.log('  2. Clients → 12 clients, filter by status and KYC')
  console.log('  3. Workflows → Sandra awaiting approval, Marcus stalled 16 days')
  console.log('  4. Messages → David Kim thread with AI flag (high severity)')
  console.log('  5. Audit → 10 entries, run exam package')
  console.log('  6. Compliance → Form ADV deadline, overdue reviews')
  console.log('─'.repeat(50))

  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
