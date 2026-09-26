-- =============================================================================
-- LoonieWins — instant feed (run after 20260925_economy_hardening.sql)
-- =============================================================================
-- 1. public.contests becomes server-written only. It previously allowed ANY visitor
--    (even signed out) to insert or rewrite any contest, e.g. swap a link for a scam.
--    The ingest-giveaways Edge Function (service_role) and moderated submissions
--    (security definer) remain the only writers.
-- 2. retire_stale_contests(): called by ingest to expire undated posts after 45 days
--    and delete rows that ended more than 60 days ago.
-- 3. One-time cleanup of rows stored with the old position-based ids (the next ingest
--    re-creates them with stable URL-based ids, so they no longer duplicate).
-- Idempotent: safe to re-run.
-- =============================================================================

drop policy if exists "Allow public insert contests" on public.contests;
drop policy if exists "Allow public update contests" on public.contests;
revoke insert, update, delete on public.contests from anon, authenticated;

-- Feed query: live rows newest first.
create index if not exists idx_contests_live_created
  on public.contests (created_at desc)
  where link_status is null or link_status not in (404, 410);

create or replace function public.retire_stale_contests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_undated int;
  deleted int;
begin
  update public.contests
    set expiry_date = created_at + interval '45 days',
        is_estimated_expiry = true,
        updated_at = now()
    where expiry_date is null
      and source <> 'user-submitted'
      and created_at < now() - interval '45 days';
  get diagnostics expired_undated = row_count;

  delete from public.contests c
    where c.expiry_date < now() - interval '60 days'
      and not exists (select 1 from giveaways.referral_pool r where r.contest_id = c.id)
      and not exists (select 1 from giveaways.user_wins w where w.contest_id = c.id);
  get diagnostics deleted = row_count;

  return jsonb_build_object('expired_undated', expired_undated, 'deleted', deleted);
end;
$$;

revoke all on function public.retire_stale_contests() from public, anon, authenticated;
grant execute on function public.retire_stale_contests() to service_role;

-- Old ingest ids looked like "<source>-<feed position>-<url tail>" and changed whenever a feed
-- shifted. Stable ids start with "c_"; user submissions keep their own ids.
delete from public.contests c
  where c.id not like 'c\_%'
    and c.source <> 'user-submitted'
    and not exists (select 1 from giveaways.referral_pool r where r.contest_id = c.id)
    and not exists (select 1 from giveaways.user_wins w where w.contest_id = c.id);
