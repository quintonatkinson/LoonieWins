-- =============================================================================
-- LoonieWins — link health (last_verified) + platform all-time contest count
-- ADDITIVE. Safe to re-run. No secrets. Does not drop tables.
-- Depends on: public.contests (bootstrap / schema.sql)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- last_verified — when a server or client last probed contest.url
-- Used by Edge Function verify-contest-links + optional ingest-time updates.
-- Client dead-link flush still works without this column (local vault).
-- ---------------------------------------------------------------------------
alter table public.contests
  add column if not exists last_verified timestamptz;

comment on column public.contests.last_verified is
  'UTC timestamp of last HTTP probe of contests.url (Edge verify-contest-links or ingest). Null = never server-verified.';

comment on column public.contests.link_status is
  'Last known HTTP status from probe (403/404/410/5xx = dead/blocked). Null = unknown.';

create index if not exists idx_contests_last_verified
  on public.contests (last_verified nulls first);

create index if not exists idx_contests_link_recheck
  on public.contests (last_verified asc nulls first)
  where (expiry_date is null or expiry_date > now());

-- ---------------------------------------------------------------------------
-- Platform all-time Hive Mind inventory (anon-safe scalar for Home counter)
-- ---------------------------------------------------------------------------
create or replace function public.platform_contest_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.contests;
$$;

comment on function public.platform_contest_count() is
  'All-time count(*) of public.contests for Home platform counter. No PII. Safe for anon.';

grant execute on function public.platform_contest_count() to anon, authenticated;

-- Live (non-expired) subset — optional companion for "active Hive" UI.
create or replace function public.platform_live_contest_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint
  from public.contests
  where expiry_date is null or expiry_date > now();
$$;

comment on function public.platform_live_contest_count() is
  'Count of contests with null or future expiry_date. Companion to platform_contest_count().';

grant execute on function public.platform_live_contest_count() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS sanity notes (no policy change in this migration)
-- ---------------------------------------------------------------------------
-- Contests: bootstrap keeps anon/authenticated INSERT+UPDATE so the web app
-- can sync Hive Mind before server ingest is live. Once ingest-giveaways +
-- verify-contest-links run with service_role, operators MAY tighten writes to
-- service_role only (see migration 20261019_rls_contests_write_lockdown.sql
-- — commented / opt-in). Do not enable lockdown until Priority 3 ingest works.
--
-- tracking.contest_entries: own-row RLS already correct (select/insert/update/delete).
-- expires_at column: see 20261019_contest_entries_expires_at.sql
--
-- Webhook tables (offerwall_completions, push_alert_log, email_digest_log):
-- users read-own; writes via service_role Edge Functions only.
