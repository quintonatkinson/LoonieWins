-- =============================================================================
-- LoonieWins — ADDITIVE migration: push tokens + alert dedupe
-- =============================================================================
-- Safe to run on a project that already has the full bootstrap (profiles,
-- contests, tracking.*, giveaways.*). Does NOT drop or rewrite existing tables.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Then: deploy Edge Function `send-push-alerts` and schedule it (see docs).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- public.push_tokens — Expo / device push token registration
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown'
    check (platform in ('ios', 'android', 'web', 'unknown')),
  device_id text,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists idx_push_tokens_user
  on public.push_tokens (user_id);

create index if not exists idx_push_tokens_token
  on public.push_tokens (expo_push_token);

drop trigger if exists push_tokens_updated_at on public.push_tokens;
create trigger push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.update_updated_at();

alter table public.push_tokens enable row level security;

drop policy if exists "Users read own push tokens" on public.push_tokens;
create policy "Users read own push tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own push tokens" on public.push_tokens;
create policy "Users insert own push tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own push tokens" on public.push_tokens;
create policy "Users update own push tokens"
  on public.push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own push tokens" on public.push_tokens;
create policy "Users delete own push tokens"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

comment on table public.push_tokens is
  'Expo push tokens per signed-in user/device. Prefs live in profiles.settings.notifications.';

-- ---------------------------------------------------------------------------
-- public.push_alert_log — prevent duplicate new/ending alerts per contest
-- ---------------------------------------------------------------------------
create table if not exists public.push_alert_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  alert_type text not null
    check (alert_type in ('new_contest', 'ending_tonight')),
  sent_at timestamptz not null default now(),
  unique (user_id, contest_id, alert_type)
);

create index if not exists idx_push_alert_log_user
  on public.push_alert_log (user_id);

create index if not exists idx_push_alert_log_sent
  on public.push_alert_log (sent_at desc);

alter table public.push_alert_log enable row level security;

-- Authenticated users can read their own delivery history (optional UI later).
-- Inserts/updates are service_role only (Edge Function).
drop policy if exists "Users read own push alert log" on public.push_alert_log;
create policy "Users read own push alert log"
  on public.push_alert_log for select
  using (auth.uid() = user_id);

grant select on public.push_alert_log to authenticated;
grant all on public.push_alert_log to service_role;

comment on table public.push_alert_log is
  'Dedup log for Expo push alerts (new contest / ending tonight).';

-- ---------------------------------------------------------------------------
-- Seed default notification prefs for existing profiles (additive jsonb merge)
-- Does not overwrite keys already present under settings.notifications
-- ---------------------------------------------------------------------------
update public.profiles
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{notifications}',
  coalesce(settings->'notifications', '{}'::jsonb) || jsonb_build_object(
    'enabled', coalesce((settings->'notifications'->>'enabled')::boolean, true),
    'newContestsCA', coalesce((settings->'notifications'->>'newContestsCA')::boolean, true),
    'newContestsUS', coalesce((settings->'notifications'->>'newContestsUS')::boolean, false),
    'endingTonight', coalesce((settings->'notifications'->>'endingTonight')::boolean, true)
  ),
  true
)
where settings->'notifications' is null
   or settings->'notifications' = '{}'::jsonb
   or settings->'notifications'->>'enabled' is null;

-- ---------------------------------------------------------------------------
-- Account deletion: also wipe push rows (redefines RPC — same signature)
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

  delete from public.push_alert_log where user_id = uid;
  delete from public.push_tokens where user_id = uid;
  delete from tracking.contest_entries where user_id = uid;
  delete from tracking.transactions where user_id = uid;
  delete from giveaways.user_wins where user_id = uid;
  delete from giveaways.referral_pool where referrer_id = uid;
  delete from public.profiles where id = uid;

  -- Legacy public tables if present on older projects
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
  'Deletes the calling user account and associated personal rows (incl. push tokens/alerts).';

-- =============================================================================
-- Done (additive). Next Quinton steps: see docs/push-notifications.md
-- =============================================================================
