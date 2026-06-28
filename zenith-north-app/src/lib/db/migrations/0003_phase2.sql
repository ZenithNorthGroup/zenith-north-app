-- Migration 0003: Phase 2 tables
-- Run in Neon SQL Editor after 0002_roles.sql

-- WSP Documents
CREATE TABLE IF NOT EXISTS wsp_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  version      INTEGER NOT NULL DEFAULT 1,
  content      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  signed_by    UUID REFERENCES users(id),
  signed_at    TIMESTAMP,
  effective_at TIMESTAMP,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at  TIMESTAMP
);

-- DEO Undertakings
CREATE TABLE IF NOT EXISTS deo_undertakings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  signed_at    TIMESTAMP,
  expires_at   TIMESTAMP,
  version      INTEGER NOT NULL DEFAULT 1,
  channels     TEXT[],
  document_url TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Marketing content (Rule 206(4)-1)
CREATE TABLE IF NOT EXISTS marketing_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  submitted_by  UUID NOT NULL REFERENCES users(id),
  content_type  TEXT NOT NULL,
  platform      TEXT,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  attachments   JSONB DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'pending',
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMP,
  review_notes  TEXT,
  published_at  TIMESTAMP,
  scheduled_for TIMESTAMP,
  tags          TEXT[],
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at   TIMESTAMP
);

-- Annual reviews
CREATE TABLE IF NOT EXISTS annual_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  client_id        UUID NOT NULL,
  advisor_id       UUID REFERENCES users(id),
  due_at           TIMESTAMP NOT NULL,
  scheduled_at     TIMESTAMP,
  completed_at     TIMESTAMP,
  completed_by     UUID REFERENCES users(id),
  notes            TEXT,
  outcome          TEXT,
  alert_60_sent    BOOLEAN NOT NULL DEFAULT false,
  alert_30_sent    BOOLEAN NOT NULL DEFAULT false,
  alert_7_sent     BOOLEAN NOT NULL DEFAULT false,
  next_review_due  TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Incidents & complaints
CREATE TABLE IF NOT EXISTS incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  client_id         UUID,
  reported_by       UUID REFERENCES users(id),
  assigned_to       UUID REFERENCES users(id),
  incident_type     TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'medium',
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  response_deadline TIMESTAMP,
  responded_at      TIMESTAMP,
  resolved_at       TIMESTAMP,
  resolution        TEXT,
  regulatory_ref    TEXT,
  attachments       JSONB DEFAULT '[]',
  timeline          JSONB DEFAULT '[]',
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at       TIMESTAMP
);

-- Fee disclosures
CREATE TABLE IF NOT EXISTS fee_disclosures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  client_id        UUID NOT NULL,
  fee_type         TEXT NOT NULL,
  fee_amount       TEXT NOT NULL,
  billing_cycle    TEXT,
  disclosed_at     TIMESTAMP,
  acknowledged_at  TIMESTAMP,
  document_id      UUID,
  effective_from   TIMESTAMP NOT NULL,
  effective_to     TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  name              TEXT NOT NULL,
  vendor_type       TEXT NOT NULL,
  website           TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  dd_status         TEXT NOT NULL DEFAULT 'pending',
  dd_completed_at   TIMESTAMP,
  dd_next_review_at TIMESTAMP,
  contract_start    TIMESTAMP,
  contract_end      TIMESTAMP,
  notes             TEXT,
  risk_level        TEXT DEFAULT 'medium',
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at       TIMESTAMP
);

-- Channel events
CREATE TABLE IF NOT EXISTS channel_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  platform     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed_at TIMESTAMP,
  error        TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS annual_reviews_tenant_due ON annual_reviews(tenant_id, due_at);
CREATE INDEX IF NOT EXISTS annual_reviews_client ON annual_reviews(client_id);
CREATE INDEX IF NOT EXISTS incidents_tenant ON incidents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_tenant_status ON marketing_content(tenant_id, status);
CREATE INDEX IF NOT EXISTS vendors_tenant ON vendors(tenant_id, dd_status);
CREATE INDEX IF NOT EXISTS deo_tenant_user ON deo_undertakings(tenant_id, user_id);

SELECT 'Migration 0003 complete' as result;
