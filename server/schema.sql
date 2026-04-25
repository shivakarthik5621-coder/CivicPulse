-- CivicPulse Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== ISSUES TABLE =====
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id VARCHAR(20) UNIQUE NOT NULL,
  photo_url TEXT,
  category VARCHAR(50) NOT NULL,
  ai_category VARCHAR(50),
  ai_confidence DECIMAL(5,2),
  description TEXT,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Unknown',
  ward VARCHAR(100) DEFAULT 'Unknown',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  citizen_id UUID,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ADMINS TABLE =====
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'city_potholes',
  city VARCHAR(100),
  ward VARCHAR(100),
  category VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CITIZENS TABLE =====
CREATE TABLE IF NOT EXISTS citizens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_issues_ticket_id ON issues(ticket_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_city ON issues(city);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_citizen_id ON issues(citizen_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_citizens_email ON citizens(email);

-- ===== ROW LEVEL SECURITY =====
-- Disable RLS for now (using service key from backend)
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service role (backend)
CREATE POLICY "Allow all for service role" ON issues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON citizens FOR ALL USING (true) WITH CHECK (true);

-- ─── Migration: Add disputed status support ───────────────────────────────
-- The 'status' column is VARCHAR(20) with no CHECK constraint, so no ALTER is
-- needed. The new 'disputed' value is written by the server when a citizen
-- disputes a resolved issue. The index below speeds up dashboard queries that
-- filter on disputed issues.

CREATE INDEX IF NOT EXISTS idx_issues_disputed ON issues(status, city)
  WHERE status = 'disputed';

-- Backfill: any resolved issues where citizen_reaction = 'disputed' but status
-- was not updated (pre-feature data). Run once after deploying the server change.
-- UPDATE issues SET status = 'disputed' WHERE citizen_reaction = 'disputed' AND status = 'resolved';

-- ─── Migration: Add deadline + resolution proof + citizen reaction ─────────
-- Run these ALTER statements if you already have the issues table:

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS citizen_reaction TEXT CHECK (citizen_reaction IN ('confirmed', 'disputed', 'no_change')),
  ADD COLUMN IF NOT EXISTS deadline_alert_sent BOOLEAN DEFAULT FALSE;

-- Backfill deadline for existing pending/in-progress issues (6 days from creation)
UPDATE issues
SET deadline_at = created_at + INTERVAL '6 days'
WHERE deadline_at IS NULL AND status NOT IN ('resolved', 'invalid');

-- Index for fast overdue checks
CREATE INDEX IF NOT EXISTS idx_issues_deadline ON issues(deadline_at, status, deadline_alert_sent);
