-- Migration 0002: Role-based access control
-- Run in Neon SQL Editor after 0001_initial.sql

-- Add role fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_cco         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_scope   TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS permissions    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT;

-- Add assigned advisor to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS assigned_advisor_id UUID REFERENCES users(id);

-- Update the demo user to be owner + CCO
UPDATE users
SET
  role         = 'owner',
  is_cco       = true,
  client_scope = 'all',
  title        = 'Managing Partner & CCO'
WHERE clerk_user_id = 'user_3Fk3Rfw25egzAyk3b5cHT2Xjlry';

-- Index for advisor client lookups
CREATE INDEX IF NOT EXISTS clients_advisor_idx ON clients(assigned_advisor_id)
  WHERE assigned_advisor_id IS NOT NULL;

SELECT 'Migration 0002 complete' as result;
