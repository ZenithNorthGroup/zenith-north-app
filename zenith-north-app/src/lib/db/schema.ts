/**
 * ZENITH NORTH — Complete Database Schema
 * Drizzle ORM + PostgreSQL
 *
 * Domain layout:
 *   1. Tenants (firms)
 *   2. Identity (users + roles)
 *   3. Skill registry (modules per tenant)
 *   4. Clients (versioned, append-only)
 *   5. Documents
 *   6. Communications (compliant messaging)
 *   7. Workflows + step gating
 *   8. Compliance items
 *   9. Calendar events
 *  10. Audit log (immutable)
 *
 * Design principles:
 *   - Every table has tenant_id for RLS isolation
 *   - Nothing is ever deleted — archive_at replaces DELETE
 *   - Clients use version rows, never UPDATE
 *   - Audit log is append-only, enforced at DB level
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  inet,
  uniqueIndex,
  index,
  serial,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────
// DOMAIN 1 — TENANTS (Firms)
// ─────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug:        text('slug').notNull().unique(),          // e.g. 'acme-advisors'
  name:        text('name').notNull(),                   // e.g. 'Acme Advisory LLC'
  plan:        text('plan').notNull().default('core'),   // 'core' | 'professional' | 'enterprise'
  config:      jsonb('config').notNull().default('{}'),  // feature flags, branding, fiscal year
  clerkOrgId:  text('clerk_org_id').unique(),            // Clerk organization ID
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  archivedAt:  timestamp('archived_at'),                 // soft delete
})

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert

// ─────────────────────────────────────────────────────────
// DOMAIN 2 — IDENTITY (Users + Roles)
// ─────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id),
  clerkUserId:   text('clerk_user_id').notNull().unique(),
  email:         text('email').notNull(),
  fullName:      text('full_name').notNull(),
  // Role: 'owner' | 'cco' | 'advisor' | 'operations' | 'associate'
  role:          text('role').notNull().default('advisor'),
  // Whether this user is the designated CCO (required by SEC)
  isCco:         boolean('is_cco').notNull().default(false),
  // Client scope: 'all' | 'own' | 'assigned'
  clientScope:   text('client_scope').notNull().default('all'),
  // Fine-grained permission overrides as JSON
  permissions:   jsonb('permissions').default('{}'),
  // Avatar / profile
  avatarUrl:     text('avatar_url'),
  title:         text('title'),                     // e.g. "Senior Advisor"
  phone:         text('phone'),
  lastSeenAt:    timestamp('last_seen_at'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  archivedAt:    timestamp('archived_at'),
}, (t) => ({
  tenantEmailIdx: uniqueIndex('users_tenant_email_idx').on(t.tenantId, t.email),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ─────────────────────────────────────────────────────────
// DOMAIN 3 — SKILL REGISTRY
// ─────────────────────────────────────────────────────────

export const skills = pgTable('skills', {
  id:         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug:       text('slug').notNull().unique(),     // 'crm' | 'compliance' | 'ai'
  name:       text('name').notNull(),
  version:    text('version').notNull(),
  dependsOn:  text('depends_on').array().notNull().default(sql`'{}'`),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
})

// Per-tenant skill configuration
export const tenantSkills = pgTable('tenant_skills', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  skillId:     uuid('skill_id').notNull().references(() => skills.id),
  enabled:     boolean('enabled').notNull().default(true),
  sortOrder:   integer('sort_order').notNull().default(0),  // sidebar position
  config:      jsonb('config').notNull().default('{}'),     // per-tenant overrides
  enabledAt:   timestamp('enabled_at'),
  disabledAt:  timestamp('disabled_at'),
}, (t) => ({
  unique: uniqueIndex('tenant_skills_unique').on(t.tenantId, t.skillId),
}))

// ─────────────────────────────────────────────────────────
// DOMAIN 4 — CLIENTS (Versioned, append-only)
// ─────────────────────────────────────────────────────────

/**
 * Client records are NEVER updated in place.
 * Every edit creates a new row with version + 1.
 * Current state = MAX(version) WHERE archived_at IS NULL.
 *
 * This gives us:
 *   - Full history of every field change
 *   - Who changed what and when
 *   - Exact state at any point in time (for exam packages)
 */
export const clients = pgTable('clients', {
  id:                 uuid('id').notNull().default(sql`gen_random_uuid()`),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id),
  version:            integer('version').notNull().default(1),
  data:               jsonb('data').notNull(),  // all client fields as JSON
  assignedAdvisorId:  uuid('assigned_advisor_id').references(() => users.id),
  createdBy:          uuid('created_by').references(() => users.id),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  archivedAt:  timestamp('archived_at'),
}, (t) => ({
  // Composite PK: id + version
  pk:              uniqueIndex('clients_pk').on(t.id, t.version),
  tenantIdx:       index('clients_tenant_idx').on(t.tenantId),
  tenantStatusIdx: index('clients_tenant_status_idx').on(t.tenantId, sql`(data->>'status')`),
}))

/**
 * ClientData shape — the JSON stored in clients.data
 * Keep this in sync with the Zod schema below.
 */
export interface ClientData {
  // Core identity
  firstName:          string
  lastName:           string
  email:              string
  phone?:             string
  dateOfBirth?:       string        // ISO date
  ssnEncrypted?:      string        // AES-256 encrypted
  // Classification
  clientType:         'individual' | 'entity' | 'trust'
  status:             'prospect' | 'active' | 'inactive' | 'archived'
  // Household
  householdId?:       string
  householdRole?:     'primary' | 'spouse' | 'dependent'
  // Compliance fields (maintained by compliance skill)
  kycStatus:          'pending' | 'verified' | 'flagged' | 'needs_review'
  kycVerifiedAt?:     string
  kycExpiresAt?:      string
  annualReviewDue?:   string        // ISO date
  lastReviewDate?:    string        // ISO date
  riskProfileVersion?: number
  aumBand?:           string        // '$50k-$250k' | '$250k-$1M' | '$1M-$5M' | '$5M+'
  // Advisor
  advisorId?:         string        // references users.id
  // Migration metadata
  importSource?:      'redtail' | 'wealthbox' | 'salesforce' | 'csv'
  importId?:          string
}

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert

// ─────────────────────────────────────────────────────────
// DOMAIN 5 — DOCUMENTS
// ─────────────────────────────────────────────────────────

export const documents = pgTable('documents', {
  id:                uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id),
  clientId:          uuid('client_id').notNull(),        // soft ref to clients.id
  createdBy:         uuid('created_by').references(() => users.id),
  skillSlug:         text('skill_slug').notNull(),        // which skill created this
  name:              text('name').notNull(),
  docType:           text('doc_type').notNull(),          // 'agreement'|'disclosure'|'id_verification'|'statement'
  storagePath:       text('storage_path').notNull(),      // R2 object key
  mimeType:          text('mime_type'),
  sizeBytes:         integer('size_bytes'),
  version:           integer('version').notNull().default(1),
  // Signature tracking
  signatureProvider: text('signature_provider'),          // 'internal'|'docusign'
  signatureData:     jsonb('signature_data'),
  signedAt:          timestamp('signed_at'),
  signedByClientAt:  timestamp('signed_by_client_at'),
  signedByAdvisorAt: timestamp('signed_by_advisor_at'),
  // Retention
  retainUntil:       timestamp('retain_until'),
  // AI extraction
  extractedData:     jsonb('extracted_data'),
  extractedAt:       timestamp('extracted_at'),
  extractionStatus:  text('extraction_status'),           // 'pending'|'complete'|'needs_review'
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  archivedAt:        timestamp('archived_at'),
}, (t) => ({
  clientIdx: index('documents_client_idx').on(t.tenantId, t.clientId),
  typeIdx:   index('documents_type_idx').on(t.tenantId, t.docType),
}))

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert

// Signature requests
export const signatureRequests = pgTable('signature_requests', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  documentId:   uuid('document_id').notNull().references(() => documents.id),
  clientId:     uuid('client_id').notNull(),
  runId:        uuid('run_id'),                             // linked workflow run
  stepId:       uuid('step_id'),
  signerType:   text('signer_type').notNull(),              // 'client'|'advisor'
  token:        text('token').notNull().unique(),           // magic link token
  status:       text('status').notNull().default('pending'),// 'pending'|'signed'|'expired'
  expiresAt:    timestamp('expires_at').notNull(),
  signedAt:     timestamp('signed_at'),
  ipAddress:    inet('ip_address'),
  userAgent:    text('user_agent'),
  signatureImg: text('signature_image'),                   // base64 drawn sig
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────
// DOMAIN 6 — COMMUNICATIONS (Compliant Messaging)
// ─────────────────────────────────────────────────────────

export const communications = pgTable('communications', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  threadId:       uuid('thread_id').notNull(),              // groups messages
  clientId:       uuid('client_id').notNull(),
  fromUserId:     uuid('from_user_id').references(() => users.id),
  channel:        text('channel').notNull(),                // 'platform'|'email'|'phone_log'
  direction:      text('direction').notNull(),              // 'inbound'|'outbound'
  subject:        text('subject'),
  body:           text('body').notNull(),
  bodyEncrypted:  text('body_encrypted'),                   // AES-256 encrypted copy
  // AI monitoring
  aiScanned:      boolean('ai_scanned').notNull().default(false),
  aiFlagged:      boolean('ai_flagged').notNull().default(false),
  aiSeverity:     text('ai_severity'),                      // 'low'|'medium'|'high'
  aiReason:       text('ai_reason'),
  aiExcerpt:      text('ai_excerpt'),
  // Review
  reviewedBy:     uuid('reviewed_by').references(() => users.id),
  reviewedAt:     timestamp('reviewed_at'),
  reviewNotes:    text('review_notes'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  archivedAt:     timestamp('archived_at'),
}, (t) => ({
  clientIdx:  index('comms_client_idx').on(t.tenantId, t.clientId, t.createdAt),
  flaggedIdx: index('comms_flagged_idx').on(t.tenantId, t.aiFlagged)
    .where(sql`ai_flagged = true`),
  threadIdx:  index('comms_thread_idx').on(t.threadId),
}))

export type Communication = typeof communications.$inferSelect

// ─────────────────────────────────────────────────────────
// DOMAIN 7 — WORKFLOWS + STEP GATING
// ─────────────────────────────────────────────────────────

export const workflows = pgTable('workflows', {
  id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id),
  slug:      text('slug').notNull(),                        // 'client-onboarding'
  name:      text('name').notNull(),
  trigger:   text('trigger').notNull(),                     // 'client.created'|'manual'
  enabled:   boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unique: uniqueIndex('workflows_tenant_slug').on(t.tenantId, t.slug),
}))

export const workflowSteps = pgTable('workflow_steps', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId:   uuid('workflow_id').notNull().references(() => workflows.id),
  skillSlug:    text('skill_slug').notNull(),
  slug:         text('slug').notNull(),                     // 'kyc-check'
  name:         text('name').notNull(),
  sortOrder:    integer('sort_order').notNull(),
  required:     boolean('required').notNull().default(true),
  config:       jsonb('config').notNull().default('{}'),    // portal, deadline, conditions
})

export const workflowRuns = pgTable('workflow_runs', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId:   uuid('workflow_id').notNull().references(() => workflows.id),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  entityType:   text('entity_type').notNull(),              // 'client'
  entityId:     uuid('entity_id').notNull(),
  status:       text('status').notNull().default('in_progress'),
  // 'in_progress'|'awaiting_client'|'awaiting_advisor'|
  // 'awaiting_approval'|'blocked'|'complete'
  startedAt:    timestamp('started_at').notNull().defaultNow(),
  completedAt:  timestamp('completed_at'),
}, (t) => ({
  entityIdx: index('runs_entity_idx').on(t.tenantId, t.entityId),
  statusIdx: index('runs_status_idx').on(t.tenantId, t.status),
}))

export const workflowStepCompletions = pgTable('workflow_step_completions', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  runId:         uuid('run_id').notNull().references(() => workflowRuns.id),
  stepId:        uuid('step_id').notNull().references(() => workflowSteps.id),
  completedBy:   uuid('completed_by').references(() => users.id),
  completedType: text('completed_type'),                    // 'advisor'|'client'|'system'
  status:        text('status').notNull().default('pending'),
  // 'pending'|'complete'|'skipped'|'blocked'
  assignedAt:    timestamp('assigned_at'),
  completedAt:   timestamp('completed_at'),
  data:          jsonb('data'),                             // step-specific data
  notes:         text('notes'),
}, (t) => ({
  unique:    uniqueIndex('completions_run_step').on(t.runId, t.stepId),
  statusIdx: index('completions_status_idx').on(t.runId, t.status),
}))

// ─────────────────────────────────────────────────────────
// DOMAIN 8 — COMPLIANCE ITEMS
// ─────────────────────────────────────────────────────────

export const complianceItems = pgTable('compliance_items', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  clientId:     uuid('client_id'),                          // nullable for firm-wide items
  itemType:     text('item_type').notNull(),
  // 'annual_review_overdue'|'missing_signature'|'missing_document'|
  // 'kyc_expired'|'workflow_stalled'|'communication_flagged'|
  // 'filing_deadline'|'retention_expiring'
  severity:     text('severity').notNull().default('warning'), // 'critical'|'warning'|'info'
  title:        text('title').notNull(),
  description:  text('description'),
  dueAt:        timestamp('due_at'),
  resolvedAt:   timestamp('resolved_at'),
  resolvedBy:   uuid('resolved_by').references(() => users.id),
  snoozedUntil: timestamp('snoozed_until'),
  sourceType:   text('source_type'),                        // 'document'|'workflow_step'|'regulation'
  sourceId:     uuid('source_id'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  activeIdx:  index('ci_active_idx').on(t.tenantId, t.severity)
    .where(sql`resolved_at IS NULL`),
  clientIdx:  index('ci_client_idx').on(t.clientId)
    .where(sql`client_id IS NOT NULL`),
}))

export type ComplianceItem = typeof complianceItems.$inferSelect

// ─────────────────────────────────────────────────────────
// DOMAIN 9 — CALENDAR EVENTS
// ─────────────────────────────────────────────────────────

export const calendarEvents = pgTable('calendar_events', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  clientId:     uuid('client_id'),                          // nullable for firm-wide
  createdBy:    uuid('created_by').references(() => users.id),
  eventType:    text('event_type').notNull(),
  // 'compliance'|'client_review'|'workflow_task'|'meeting'
  title:        text('title').notNull(),
  description:  text('description'),
  dueAt:        timestamp('due_at').notNull(),
  completedAt:  timestamp('completed_at'),
  // Source linking
  sourceType:   text('source_type'),                        // 'workflow_run'|'regulation'|'manual'
  sourceId:     uuid('source_id'),
  sourceSlug:   text('source_slug'),                        // 'adv-annual-amendment'
  // Escalation tracking
  alert60dSent: boolean('alert_60d_sent').notNull().default(false),
  alert30dSent: boolean('alert_30d_sent').notNull().default(false),
  alert7dSent:  boolean('alert_7d_sent').notNull().default(false),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  upcomingIdx: index('events_upcoming_idx').on(t.tenantId, t.dueAt)
    .where(sql`completed_at IS NULL`),
}))

// ─────────────────────────────────────────────────────────
// DOMAIN 10 — AUDIT LOG (Immutable, append-only)
// ─────────────────────────────────────────────────────────

/**
 * CRITICAL: This table is append-only.
 * DELETE is blocked via RLS policy (see migration file).
 * UPDATE is blocked via RLS policy.
 * Never expose delete/update routes for this table.
 */
export const auditLog = pgTable('audit_log', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  userId:      uuid('user_id').references(() => users.id),
  skillSlug:   text('skill_slug').notNull(),                // which module fired this
  action:      text('action').notNull(),                    // 'client.created'
  entityType:  text('entity_type').notNull(),               // 'client'|'document'
  entityId:    uuid('entity_id'),
  prevState:   jsonb('prev_state'),                         // snapshot before change
  nextState:   jsonb('next_state'),                         // snapshot after change
  metadata:    jsonb('metadata'),                           // extra context
  ipAddress:   inet('ip_address'),
  userAgent:   text('user_agent'),
  device:      text('device'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  // Fast lookup: all events for a specific entity (exam package query)
  entityIdx: index('audit_entity_idx').on(t.tenantId, t.entityType, t.entityId, t.createdAt),
  // Fast lookup: all events by tenant + timerange
  tenantIdx: index('audit_tenant_idx').on(t.tenantId, t.createdAt),
}))

export type AuditLogEntry = typeof auditLog.$inferSelect

// ─────────────────────────────────────────────────────────
// RETENTION POLICIES
// ─────────────────────────────────────────────────────────

export const retentionPolicies = pgTable('retention_policies', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  recordType:   text('record_type').notNull(),              // 'agreement'|'communication'
  retainYears:  integer('retain_years').notNull(),
  fromField:    text('from_field').notNull().default('created_at'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  unique: uniqueIndex('retention_tenant_type').on(t.tenantId, t.recordType),
}))

// ─────────────────────────────────────────────────────────
// RELATIONS (for Drizzle query builder)
// ─────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users:            many(users),
  tenantSkills:     many(tenantSkills),
  workflows:        many(workflows),
  workflowRuns:     many(workflowRuns),
  complianceItems:  many(complianceItems),
  calendarEvents:   many(calendarEvents),
  communications:   many(communications),
  documents:        many(documents),
}))

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}))

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  tenant: one(tenants, { fields: [workflows.tenantId], references: [tenants.id] }),
  steps:  many(workflowSteps),
  runs:   many(workflowRuns),
}))

export const workflowRunsRelations = relations(workflowRuns, ({ one, many }) => ({
  workflow:    one(workflows, { fields: [workflowRuns.workflowId], references: [workflows.id] }),
  completions: many(workflowStepCompletions),
}))

export const workflowStepsRelations = relations(workflowSteps, ({ one, many }) => ({
  workflow:    one(workflows, { fields: [workflowSteps.workflowId], references: [workflows.id] }),
  completions: many(workflowStepCompletions),
}))

// ── Phase 2 tables ─────────────────────────────────────────

/**
 * WSP (Written Supervisory Procedures) — versioned living document
 */
export const wspDocuments = pgTable('wsp_documents', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  version:     integer('version').notNull().default(1),
  content:     text('content').notNull(),             // Full WSP text (markdown)
  status:      text('status').notNull().default('draft'), // draft | active | superseded
  signedBy:    uuid('signed_by').references(() => users.id),
  signedAt:    timestamp('signed_at'),
  effectiveAt: timestamp('effective_at'),
  createdBy:   uuid('created_by').references(() => users.id),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  archivedAt:  timestamp('archived_at'),
})

/**
 * DEO Undertaking — per-advisor, tracks signature and renewal
 */
export const deoUndertakings = pgTable('deo_undertakings', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  userId:      uuid('user_id').notNull().references(() => users.id),
  signedAt:    timestamp('signed_at'),
  expiresAt:   timestamp('expires_at'),
  version:     integer('version').notNull().default(1),
  channels:    text('channels').array(),     // Which channels they agreed to
  documentUrl: text('document_url'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

/**
 * Marketing content — Rule 206(4)-1 pre-approval workflow
 */
export const marketingContent = pgTable('marketing_content', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  submittedBy:  uuid('submitted_by').notNull().references(() => users.id),
  contentType:  text('content_type').notNull(), // linkedin_post | newsletter | website | advertisement | social | other
  platform:     text('platform'),
  title:        text('title').notNull(),
  body:         text('body').notNull(),
  attachments:  jsonb('attachments').default('[]'),
  status:       text('status').notNull().default('pending'), // pending | approved | rejected | revision_requested
  reviewedBy:   uuid('reviewed_by').references(() => users.id),
  reviewedAt:   timestamp('reviewed_at'),
  reviewNotes:  text('review_notes'),
  publishedAt:  timestamp('published_at'),
  scheduledFor: timestamp('scheduled_for'),
  tags:         text('tags').array(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  archivedAt:   timestamp('archived_at'),
})

/**
 * Annual reviews — dedicated tracking per client
 */
export const annualReviews = pgTable('annual_reviews', {
  id:              uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  clientId:        uuid('client_id').notNull(),
  advisorId:       uuid('advisor_id').references(() => users.id),
  dueAt:           timestamp('due_at').notNull(),
  scheduledAt:     timestamp('scheduled_at'),
  completedAt:     timestamp('completed_at'),
  completedBy:     uuid('completed_by').references(() => users.id),
  notes:           text('notes'),
  outcome:         text('outcome'),         // completed | client_cancelled | advisor_cancelled | rescheduled
  alert60Sent:     boolean('alert_60_sent').notNull().default(false),
  alert30Sent:     boolean('alert_30_sent').notNull().default(false),
  alert7Sent:      boolean('alert_7_sent').notNull().default(false),
  nextReviewDue:   timestamp('next_review_due'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
})

/**
 * Incidents & complaints — timed response tracking
 */
export const incidents = pgTable('incidents', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  clientId:       uuid('client_id'),
  reportedBy:     uuid('reported_by').references(() => users.id),
  assignedTo:     uuid('assigned_to').references(() => users.id),
  incidentType:   text('incident_type').notNull(), // complaint | regulatory_inquiry | data_breach | trading_error | other
  severity:       text('severity').notNull().default('medium'), // low | medium | high | critical
  title:          text('title').notNull(),
  description:    text('description').notNull(),
  responseDeadline: timestamp('response_deadline'),
  respondedAt:    timestamp('responded_at'),
  resolvedAt:     timestamp('resolved_at'),
  resolution:     text('resolution'),
  regulatoryRef:  text('regulatory_ref'),  // SEC case number etc
  attachments:    jsonb('attachments').default('[]'),
  timeline:       jsonb('timeline').default('[]'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  archivedAt:     timestamp('archived_at'),
})

/**
 * Fee disclosures — billing and fee tracking per client
 */
export const feeDisclosures = pgTable('fee_disclosures', {
  id:              uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  clientId:        uuid('client_id').notNull(),
  feeType:         text('fee_type').notNull(), // aum_percentage | flat | hourly | performance | other
  feeAmount:       text('fee_amount').notNull(),
  billingCycle:    text('billing_cycle'),       // monthly | quarterly | annual
  disclosedAt:     timestamp('disclosed_at'),
  acknowledgedAt:  timestamp('acknowledged_at'),
  documentId:      uuid('document_id'),
  effectiveFrom:   timestamp('effective_from').notNull(),
  effectiveTo:     timestamp('effective_to'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
})

/**
 * Vendor management — third party due diligence
 */
export const vendors = pgTable('vendors', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id),
  name:             text('name').notNull(),
  vendorType:       text('vendor_type').notNull(), // custodian | technology | compliance | legal | accounting | other
  website:          text('website'),
  contactName:      text('contact_name'),
  contactEmail:     text('contact_email'),
  ddStatus:         text('dd_status').notNull().default('pending'), // pending | in_review | approved | rejected | expired
  ddCompletedAt:    timestamp('dd_completed_at'),
  ddNextReviewAt:   timestamp('dd_next_review_at'),
  contractStart:    timestamp('contract_start'),
  contractEnd:      timestamp('contract_end'),
  notes:            text('notes'),
  riskLevel:        text('risk_level').default('medium'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  archivedAt:       timestamp('archived_at'),
})

/**
 * Channel webhooks — tracks inbound from all platforms
 */
export const channelEvents = pgTable('channel_events', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  platform:    text('platform').notNull(), // whatsapp | linkedin | twitter | slack | teams | zoom
  eventType:   text('event_type').notNull(),
  payload:     jsonb('payload').notNull(),
  processedAt: timestamp('processed_at'),
  error:       text('error'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})
