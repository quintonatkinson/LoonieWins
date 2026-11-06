-- Additive: store contest end date on Applied Contests rows so Profile / My Giveaways
-- can show "Ends …" and Current vs All-time without re-joining Hive Mind. Safe to re-run.
-- Required for overnight backend tracking schema (do not skip if running Priority 2 SQL).
alter table tracking.contest_entries
  add column if not exists expires_at timestamptz;

comment on column tracking.contest_entries.expires_at is
  'Contest expiry snapshot at mark-entered time (ISO). Null when unknown.';

create index if not exists idx_contest_entries_expires_at
  on tracking.contest_entries (user_id, expires_at)
  where expires_at is not null;
