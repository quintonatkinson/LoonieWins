-- =============================================================================
-- LoonieWins — ADDITIVE: weekly digest email log + weeklyDigestEmail pref seed
-- =============================================================================
-- Safe on projects that already ran 20260920_push_notifications.sql.
-- Run in: Supabase Dashboard → SQL Editor
-- Then: deploy Edge Function `send-weekly-digest` + set RESEND_API_KEY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- public.email_digest_log — one weekly digest email per user per week key
-- ---------------------------------------------------------------------------
create table if not exists public.email_digest_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  digest_week text not null,
  new_ca_count integer not null default 0,
  ending_tonight_count integer not null default 0,
  sent_at timestamptz not null default now(),
  unique (user_id, digest_week)
);

create index if not exists idx_email_digest_log_user
  on public.email_digest_log (user_id);

create index if not exists idx_email_digest_log_sent
  on public.email_digest_log (sent_at desc);

alter table public.email_digest_log enable row level security;

drop policy if exists "Users read own digest log" on public.email_digest_log;
create policy "Users read own digest log"
  on public.email_digest_log for select
  using (auth.uid() = user_id);

grant select on public.email_digest_log to authenticated;
grant all on public.email_digest_log to service_role;

comment on table public.email_digest_log is
  'Dedup log for weekly digest emails (send-weekly-digest Edge Function).';

-- ---------------------------------------------------------------------------
-- Seed weeklyDigestEmail default (false) without clobbering existing keys
-- ---------------------------------------------------------------------------
update public.profiles
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{notifications}',
  coalesce(settings->'notifications', '{}'::jsonb) || jsonb_build_object(
    'weeklyDigestEmail',
    coalesce((settings->'notifications'->>'weeklyDigestEmail')::boolean, false)
  ),
  true
)
where settings->'notifications'->>'weeklyDigestEmail' is null;

-- ---------------------------------------------------------------------------
-- Account deletion: also wipe digest log (redefines RPC — same signature)
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, tracking, giveaways, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.email_digest_log where user_id = uid;
  delete from public.push_alert_log where user_id = uid;
  delete from public.push_tokens where user_id = uid;
  delete from tracking.contest_entries where user_id = uid;
  delete from tracking.transactions where user_id = uid;
  delete from giveaways.user_wins where user_id = uid;
  delete from giveaways.referral_pool where referrer_id = uid;
  delete from public.profiles where id = uid;

  begin
    delete from public.applied_contests where user_id = uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.transactions where user_id = uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.user_wins where user_id = uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.referral_pool where referrer_id = uid;
  exception when undefined_table then null;
  end;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account() is
  'Deletes the calling user account and associated personal rows (incl. push + digest logs).';

-- =============================================================================
-- Done. Next: deploy send-weekly-digest + set RESEND_API_KEY / RESEND_FROM_EMAIL
-- =============================================================================
