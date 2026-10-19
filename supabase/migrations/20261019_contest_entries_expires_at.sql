-- Additive: store contest end date on Applied Contests rows so Profile cards
-- can show "Ends …" without re-joining Hive Mind. Safe to re-run.
alter table tracking.contest_entries
  add column if not exists expires_at timestamptz;

comment on column tracking.contest_entries.expires_at is
  'Contest expiry snapshot at mark-entered time (ISO). Null when unknown.';
