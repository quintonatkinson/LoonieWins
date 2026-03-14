-- LoonieWins contests table for Hive Mind vault
-- Run this in Supabase SQL Editor to create the schema

CREATE TABLE IF NOT EXISTS contests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  expiry_date TIMESTAMPTZ,
  is_estimated_expiry BOOLEAN DEFAULT false,
  prize_value NUMERIC,
  eligibility TEXT,
  tags TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  link_status INTEGER,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for live contests query (expiry_date > NOW() OR expiry_date IS NULL)
CREATE INDEX IF NOT EXISTS idx_contests_expiry ON contests (expiry_date);

-- RLS: allow anonymous read for live contests, upsert via service role or anon with policy
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;

-- Allow anon to SELECT (for fetchFromCloud)
CREATE POLICY "Allow public read live contests"
  ON contests FOR SELECT
  TO anon
  USING (expiry_date > NOW() OR expiry_date IS NULL);

-- Allow anon to INSERT (for new contests)
CREATE POLICY "Allow public insert contests"
  ON contests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to UPDATE (for upsert - existing rows)
CREATE POLICY "Allow public update contests"
  ON contests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contests_updated_at ON contests;
CREATE TRIGGER contests_updated_at
  BEFORE UPDATE ON contests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
