-- ═══════════════════════════════════════════════════════════
-- ZENITH NORTH — Initial Migration
-- Run after: npm run db:migrate
-- ═══════════════════════════════════════════════════════════

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY SETUP
-- ─────────────────────────────────────────────────────────

-- Create application role (used by Drizzle connection)
-- In production: create a separate role per environment
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END
$$;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_skills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies   ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- TENANT ISOLATION POLICIES
-- Each policy uses current_setting('app.tenant_id')
-- which is set via withTenant() before every query
-- ─────────────────────────────────────────────────────────

-- Helper: get current tenant ID safely
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Users
CREATE POLICY tenant_isolation ON users
  FOR ALL USING (tenant_id = current_tenant_id());

-- Clients
CREATE POLICY tenant_isolation ON clients
  FOR ALL USING (tenant_id = current_tenant_id());

-- Documents
CREATE POLICY tenant_isolation ON documents
  FOR ALL USING (tenant_id = current_tenant_id());

-- Communications
CREATE POLICY tenant_isolation ON communications
  FOR ALL USING (tenant_id = current_tenant_id());

-- Workflows
CREATE POLICY tenant_isolation ON workflows
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON workflow_runs
  FOR ALL USING (tenant_id = current_tenant_id());

-- Compliance items
CREATE POLICY tenant_isolation ON compliance_items
  FOR ALL USING (tenant_id = current_tenant_id());

-- Calendar events
CREATE POLICY tenant_isolation ON calendar_events
  FOR ALL USING (tenant_id = current_tenant_id());

-- Retention policies
CREATE POLICY tenant_isolation ON retention_policies
  FOR ALL USING (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────
-- AUDIT LOG — APPEND-ONLY ENFORCEMENT
-- This is the most critical security policy.
-- Even if the application has a bug, data cannot be deleted.
-- ─────────────────────────────────────────────────────────

-- Allow reads (scoped to tenant)
CREATE POLICY audit_read ON audit_log
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Allow inserts (from application)
CREATE POLICY audit_insert ON audit_log
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- BLOCK all updates — audit log entries are immutable
CREATE POLICY audit_no_update ON audit_log
  AS RESTRICTIVE
  FOR UPDATE
  TO PUBLIC
  USING (false);

-- BLOCK all deletes — audit log entries are permanent
CREATE POLICY audit_no_delete ON audit_log
  AS RESTRICTIVE
  FOR DELETE
  TO PUBLIC
  USING (false);

-- Same for documents — never actually deleted
CREATE POLICY docs_no_delete ON documents
  AS RESTRICTIVE
  FOR DELETE
  TO PUBLIC
  USING (false);

-- Same for communications
CREATE POLICY comms_no_delete ON communications
  AS RESTRICTIVE
  FOR DELETE
  TO PUBLIC
  USING (false);

-- ─────────────────────────────────────────────────────────
-- DEFAULT RETENTION POLICIES (SEC minimums)
-- These are inserted when a tenant is created.
-- See: server/jobs/tenantSetup.ts
-- ─────────────────────────────────────────────────────────

-- SEC Rule 204-2 minimums (for reference — applied per tenant on signup)
-- 'agreement'           -> 5 years from termination
-- 'trade_record'        -> 5 years from created_at
-- 'communication'       -> 3 years from created_at
-- 'financial_statement' -> 5 years from created_at
-- 'disclosure'          -> 5 years from created_at
-- 'id_verification'     -> 5 years from created_at
-- 'meeting_note'        -> 5 years from created_at
-- 'complaint_record'    -> 3 years from created_at
-- 'advertisement'       -> 5 years from created_at

-- ─────────────────────────────────────────────────────────
-- DEFAULT SKILL DEFINITIONS
-- Inserted once at DB init. Tenants enable/configure them.
-- ─────────────────────────────────────────────────────────

INSERT INTO skills (slug, name, version, depends_on) VALUES
  ('crm',        'CRM',               '1.0.0', '{}'),
  ('documents',  'Documents',         '1.0.0', '{crm}'),
  ('tasks',      'Tasks',             '1.0.0', '{crm}'),
  ('calendar',   'Calendar',          '1.0.0', '{crm}'),
  ('messaging',  'Messaging',         '1.0.0', '{crm}'),
  ('compliance', 'Compliance',        '1.0.0', '{crm,documents}'),
  ('workflows',  'Workflow Builder',  '1.0.0', '{crm}'),
  ('audit',      'Audit Center',      '1.0.0', '{crm,documents,compliance}'),
  ('portal',     'Client Portal',     '1.0.0', '{crm,documents,workflows}'),
  ('ai',         'AI Assistant',      '1.0.0', '{crm,documents,messaging}'),
  ('reports',    'Reports',           '1.0.0', '{crm}')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- INDEXES FOR PERFORMANCE
-- ─────────────────────────────────────────────────────────

-- Client current version lookup (used constantly)
CREATE INDEX IF NOT EXISTS clients_current_idx
  ON clients (tenant_id, id, version DESC)
  WHERE archived_at IS NULL;

-- Active compliance items (dashboard query)
CREATE INDEX IF NOT EXISTS ci_open_severity_idx
  ON compliance_items (tenant_id, severity, due_at)
  WHERE resolved_at IS NULL AND (snoozed_until IS NULL OR snoozed_until < NOW());

-- Upcoming calendar events
CREATE INDEX IF NOT EXISTS events_upcoming_tenant_idx
  ON calendar_events (tenant_id, due_at ASC)
  WHERE completed_at IS NULL;

-- Workflow runs by status (dashboard)
CREATE INDEX IF NOT EXISTS runs_tenant_status_idx
  ON workflow_runs (tenant_id, status)
  WHERE status != 'complete';
