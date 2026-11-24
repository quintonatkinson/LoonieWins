-- =============================================================================
-- Lock public.contests writes to service_role only
-- =============================================================================
-- Writes go through ingest-giveaways / verify-contest-links (service_role key,
-- bypasses RLS) and moderate_contest_submission (SECURITY DEFINER). Clients only
-- read live rows; the web app's RSS refresh stays in the browser's local vault.
-- Superseded by 20261123_security_hardening.sql, which repeats this block.
-- =============================================================================

drop policy if exists "Allow public insert contests" on public.contests;
drop policy if exists "Allow public update contests" on public.contests;

drop policy if exists "Allow public read live contests" on public.contests;
create policy "Allow public read live contests"
  on public.contests for select
  to anon, authenticated
  using (expiry_date > now() or expiry_date is null);

revoke insert, update, delete, truncate on public.contests from anon, authenticated;

comment on table public.contests is
  'Hive Mind contests. Reads: anon+auth (live rows). Writes: service_role Edge Functions only.';
