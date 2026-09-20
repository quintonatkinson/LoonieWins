-- =============================================================================
-- LoonieWins — Supabase bootstrap (fresh project) — FULL migration
-- =============================================================================
-- Copy-paste into: Supabase Dashboard → SQL Editor → New query → Run
--
-- Schemas:
--   public     — profiles (auth-linked) + contests Hive Mind (TEXT id)
--   tracking   — per-account contest entries + points transactions
--   giveaways  — referral pool + community wins
--
-- After running: Dashboard → Settings → API → Exposed schemas
--   add: tracking, giveaways  (public is already exposed)
-- =============================================================================

create extension if not exists "pgcrypto";

create schema if not exists tracking;
create schema if not exists giveaways;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema tracking to anon, authenticated, service_role;
grant usage on schema giveaways to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at fresh (shared)
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- public.profiles — one row per auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  is_premium boolean default false,
  points_balance int default 0,
  xp int default 0,
  level int default 1,
  streak int default 0,
  auto_fill_data jsonb default '{}'::jsonb,
  settings jsonb default '{}'::jsonb,
  smart_fills_remaining int default 3,
  last_daily_entry_at timestamptz,
  subscription_tier text default 'free'
    check (subscription_tier in ('free', 'weekly', 'monthly')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------------
-- public.contests — Hive Mind vault (TEXT id; matches useContestVault)
-- ---------------------------------------------------------------------------
create table if not exists public.contests (
  id text primary key,
  title text not null,
  url text not null,
  source text not null,
  expiry_date timestamptz,
  is_estimated_expiry boolean default false,
  prize_value numeric,
  eligibility text,
  tags text[] default '{}'::text[],
  requirements text[] default '{}'::text[],
  link_status integer,
  is_locked boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contests_expiry on public.contests (expiry_date);
create index if not exists idx_contests_url on public.contests (url);

drop trigger if exists contests_updated_at on public.contests;
create trigger contests_updated_at
  before update on public.contests
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------------
-- tracking.contest_entries — per-account entered/submitted contests
-- ---------------------------------------------------------------------------
create table if not exists tracking.contest_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  title text,
  contest_url text,
  prize_value numeric,
  status text not null default 'entered'
    check (status in ('entered', 'submitted', 'won', 'lost', 'expired')),
  entered_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, contest_id)
);

create index if not exists idx_contest_entries_user
  on tracking.contest_entries (user_id);
create index if not exists idx_contest_entries_status
  on tracking.contest_entries (user_id, status);

drop trigger if exists contest_entries_updated_at on tracking.contest_entries;
create trigger contest_entries_updated_at
  before update on tracking.contest_entries
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------------
-- tracking.transactions — points / earn ledger
-- ---------------------------------------------------------------------------
create table if not exists tracking.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  type text not null
    check (type in ('survey', 'purchase', 'referral', 'pro_pass', 'bonus', 'entry_spend')),
  description text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_transactions_user on tracking.transactions (user_id);

-- ---------------------------------------------------------------------------
-- giveaways.referral_pool
-- ---------------------------------------------------------------------------
create table if not exists giveaways.referral_pool (
  id uuid primary key default gen_random_uuid(),
  contest_id text references public.contests (id) on delete set null,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  title text,
  clicks_received int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_referral_pool_referrer
  on giveaways.referral_pool (referrer_id);

drop trigger if exists referral_pool_updated_at on giveaways.referral_pool;
create trigger referral_pool_updated_at
  before update on giveaways.referral_pool
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------------
-- giveaways.user_wins — Winners feed (community-readable)
-- ---------------------------------------------------------------------------
create table if not exists giveaways.user_wins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text references public.contests (id) on delete set null,
  contest_name text,
  winner_display text,
  won_at timestamptz default now(),
  prize_description text,
  prize_value_estimate int,
  contest_source text,
  contest_url text,
  entry_method text,
  winner_region text
);

create index if not exists idx_user_wins_user on giveaways.user_wins (user_id);
create index if not exists idx_user_wins_won_at on giveaways.user_wins (won_at desc);

-- ---------------------------------------------------------------------------
-- Auth trigger: create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'Contester'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grants (PostgREST / client)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema tracking to anon, authenticated;
grant select, insert, update, delete on all tables in schema giveaways to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant usage, select on all sequences in schema tracking to anon, authenticated;
grant usage, select on all sequences in schema giveaways to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema tracking
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema giveaways
  grant select, insert, update, delete on tables to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.contests enable row level security;
alter table tracking.contest_entries enable row level security;
alter table tracking.transactions enable row level security;
alter table giveaways.referral_pool enable row level security;
alter table giveaways.user_wins enable row level security;

-- ---- profiles ----
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---- contests (Hive Mind: anon + authenticated read live + upsert) ----
drop policy if exists "Allow public read live contests" on public.contests;
drop policy if exists "Contests are readable by all" on public.contests;
create policy "Allow public read live contests"
  on public.contests for select
  to anon, authenticated
  using (expiry_date > now() or expiry_date is null);

drop policy if exists "Allow public insert contests" on public.contests;
create policy "Allow public insert contests"
  on public.contests for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow public update contests" on public.contests;
create policy "Allow public update contests"
  on public.contests for update
  to anon, authenticated
  using (true)
  with check (true);

-- ---- tracking.contest_entries (own data only) ----
drop policy if exists "Users read own entries" on tracking.contest_entries;
create policy "Users read own entries"
  on tracking.contest_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own entries" on tracking.contest_entries;
create policy "Users insert own entries"
  on tracking.contest_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own entries" on tracking.contest_entries;
create policy "Users update own entries"
  on tracking.contest_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own entries" on tracking.contest_entries;
create policy "Users delete own entries"
  on tracking.contest_entries for delete
  using (auth.uid() = user_id);

-- ---- tracking.transactions ----
drop policy if exists "Users read own transactions" on tracking.transactions;
create policy "Users read own transactions"
  on tracking.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own transactions" on tracking.transactions;
create policy "Users insert own transactions"
  on tracking.transactions for insert
  with check (auth.uid() = user_id);

-- ---- giveaways.referral_pool ----
drop policy if exists "Referral pool readable by all" on giveaways.referral_pool;
create policy "Referral pool readable by all"
  on giveaways.referral_pool for select
  to anon, authenticated
  using (true);

drop policy if exists "Users insert own referral" on giveaways.referral_pool;
create policy "Users insert own referral"
  on giveaways.referral_pool for insert
  with check (auth.uid() = referrer_id);

drop policy if exists "Users update own referral" on giveaways.referral_pool;
create policy "Users update own referral"
  on giveaways.referral_pool for update
  using (auth.uid() = referrer_id)
  with check (auth.uid() = referrer_id);

drop policy if exists "Users delete own referral" on giveaways.referral_pool;
create policy "Users delete own referral"
  on giveaways.referral_pool for delete
  using (auth.uid() = referrer_id);

-- ---- giveaways.user_wins ----
drop policy if exists "User wins readable by all" on giveaways.user_wins;
create policy "User wins readable by all"
  on giveaways.user_wins for select
  to anon, authenticated
  using (true);

drop policy if exists "Users insert own win" on giveaways.user_wins;
create policy "Users insert own win"
  on giveaways.user_wins for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own win" on giveaways.user_wins;
create policy "Users update own win"
  on giveaways.user_wins for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own win" on giveaways.user_wins;
create policy "Users delete own win"
  on giveaways.user_wins for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Account deletion RPC (Apple 5.1.1(v) + Play account deletion)
-- Clients: supabase.rpc('delete_own_account')
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

  delete from tracking.contest_entries where user_id = uid;
  delete from tracking.transactions where user_id = uid;
  delete from giveaways.user_wins where user_id = uid;
  delete from giveaways.referral_pool where referrer_id = uid;
  delete from public.profiles where id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account() is
  'Deletes the calling user account and associated personal rows across public/tracking/giveaways.';

-- =============================================================================
-- Done.
-- Next:
--   1. Auth → Providers → Email: enable Email. For easiest local testing,
--      turn OFF "Confirm email" (or leave ON and use the in-app confirm message).
--   2. Auth → URL Configuration: add http://localhost:5173 and your Expo scheme.
--   3. Settings → API → Exposed schemas: include tracking, giveaways.
--   4. Set VITE_SUPABASE_* / EXPO_PUBLIC_SUPABASE_* and restart the app.
-- =============================================================================

-- =============================================================================
-- Freemium / progression / earn (ADDITIVE) — mirror of migrations/20260320000000_freemium_monetization.sql
-- =============================================================================

-- =============================================================================
-- LoonieWins — Freemium / progression / earn (ADDITIVE)
-- Safe to run on projects that already applied the full bootstrap.
-- Does NOT drop auth tables or existing public/tracking/giveaways data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: weekly caps, referral, streak, feature flags
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users (id) on delete set null,
  add column if not exists weekly_entries_used int default 0,
  add column if not exists weekly_entries_reset_at timestamptz
    default date_trunc('week', timezone('utc', now())),
  add column if not exists last_streak_at date,
  add column if not exists feature_flags jsonb default '{}'::jsonb;

create unique index if not exists idx_profiles_referral_code
  on public.profiles (referral_code)
  where referral_code is not null;

-- ---------------------------------------------------------------------------
-- Expand transaction types for offerwall + referral credits
-- ---------------------------------------------------------------------------
do $$
begin
  alter table tracking.transactions drop constraint if exists transactions_type_check;
exception when undefined_table then null;
end $$;

alter table tracking.transactions
  drop constraint if exists transactions_type_check;

alter table tracking.transactions
  add constraint transactions_type_check
  check (type in (
    'survey', 'purchase', 'referral', 'pro_pass', 'bonus', 'entry_spend',
    'offerwall', 'referral_click', 'referral_signup', 'streak_bonus'
  ));

-- ---------------------------------------------------------------------------
-- giveaways.referral_click_credits — one paid click per clicker per link
-- ---------------------------------------------------------------------------
create table if not exists giveaways.referral_click_credits (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references giveaways.referral_pool (id) on delete cascade,
  clicker_id uuid not null references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  points_awarded int not null default 50,
  created_at timestamptz default now(),
  unique (referral_id, clicker_id)
);

create index if not exists idx_referral_click_credits_referrer
  on giveaways.referral_click_credits (referrer_id);

alter table giveaways.referral_click_credits enable row level security;

drop policy if exists "Users read own referral credits" on giveaways.referral_click_credits;
create policy "Users read own referral credits"
  on giveaways.referral_click_credits for select
  using (auth.uid() = clicker_id or auth.uid() = referrer_id);

grant select, insert on giveaways.referral_click_credits to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_pro_tier(p_tier text, p_premium boolean)
returns boolean
language sql
immutable
as $$
  select coalesce(p_premium, false)
    or coalesce(p_tier, 'free') in ('weekly', 'monthly');
$$;

create or replace function public.ensure_week_reset(p_uid uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.profiles;
  week_start timestamptz := date_trunc('week', timezone('utc', now()));
begin
  select * into row from public.profiles where id = p_uid for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  if row.weekly_entries_reset_at is null
     or row.weekly_entries_reset_at < week_start then
    update public.profiles
      set weekly_entries_used = 0,
          weekly_entries_reset_at = week_start,
          updated_at = now()
      where id = p_uid
      returning * into row;
  end if;
  return row;
end;
$$;

create or replace function public.level_for_xp(p_xp int)
returns int
language sql
immutable
as $$
  select greatest(1, (greatest(coalesce(p_xp, 0), 0) / 100) + 1);
$$;

-- ---------------------------------------------------------------------------
-- RPC: consume_free_entry — enforces weekly free-tier cap (default 7)
-- Returns JSON: { ok, reason, weekly_used, weekly_cap, is_pro }
-- ---------------------------------------------------------------------------
create or replace function public.consume_free_entry(p_weekly_cap int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
  cap int := greatest(coalesce(p_weekly_cap, 7), 0);
  flags jsonb;
  effective_cap int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  row := public.ensure_week_reset(uid);
  flags := coalesce(row.feature_flags, '{}'::jsonb);

  if public.is_pro_tier(row.subscription_tier, row.is_premium)
     or coalesce((flags->>'unlimited_entries')::boolean, false) then
    update public.profiles
      set last_daily_entry_at = now(), updated_at = now()
      where id = uid;
    return jsonb_build_object(
      'ok', true, 'is_pro', true,
      'weekly_used', row.weekly_entries_used,
      'weekly_cap', null
    );
  end if;

  effective_cap := cap;
  if coalesce((flags->>'higher_entry_caps')::boolean, false) then
    effective_cap := cap * 2;
  end if;

  if coalesce(row.weekly_entries_used, 0) >= effective_cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'weekly_cap_reached',
      'weekly_used', row.weekly_entries_used,
      'weekly_cap', effective_cap,
      'is_pro', false
    );
  end if;

  update public.profiles
    set weekly_entries_used = coalesce(weekly_entries_used, 0) + 1,
        last_daily_entry_at = now(),
        updated_at = now()
    where id = uid
    returning * into row;

  return jsonb_build_object(
    'ok', true,
    'is_pro', false,
    'weekly_used', row.weekly_entries_used,
    'weekly_cap', effective_cap
  );
end;
$$;

revoke all on function public.consume_free_entry(int) from public;
grant execute on function public.consume_free_entry(int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: award_entry_progress — XP + streak when entered/submitted
-- ---------------------------------------------------------------------------
create or replace function public.award_entry_progress(
  p_contest_id text,
  p_status text default 'entered'
)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
  xp_gain int := 0;
  new_xp int;
  new_streak int;
  today date := (timezone('utc', now()))::date;
  yesterday date := (timezone('utc', now()))::date - 1;
  existing tracking.contest_entries;
  first_enter boolean := false;
  first_submit boolean := false;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_contest_id is null or length(trim(p_contest_id)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_contest_id');
  end if;
  if p_status not in ('entered', 'submitted', 'won', 'lost', 'expired') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;

  select * into existing
    from tracking.contest_entries
    where user_id = uid and contest_id = p_contest_id;

  if not found then
    first_enter := true;
    if p_status = 'submitted' then
      first_submit := true;
    end if;
  else
    if existing.status is distinct from 'submitted'
       and existing.status is distinct from 'won'
       and p_status in ('submitted', 'won') then
      first_submit := true;
    end if;
  end if;

  if first_enter then
    xp_gain := xp_gain + 15;
  end if;
  if first_submit then
    xp_gain := xp_gain + 35;
  end if;

  select * into row from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  new_xp := coalesce(row.xp, 0) + xp_gain;
  new_streak := coalesce(row.streak, 0);

  if xp_gain > 0 then
    if row.last_streak_at is null or row.last_streak_at < yesterday then
      new_streak := 1;
    elsif row.last_streak_at = yesterday then
      new_streak := coalesce(row.streak, 0) + 1;
    end if;
    -- same-day re-entry keeps streak
    if row.last_streak_at = today then
      new_streak := greatest(coalesce(row.streak, 0), 1);
    end if;

    update public.profiles
      set xp = new_xp,
          level = public.level_for_xp(new_xp),
          streak = new_streak,
          last_streak_at = today,
          updated_at = now()
      where id = uid
      returning * into row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'xp_gained', xp_gain,
    'xp', row.xp,
    'level', row.level,
    'streak', row.streak,
    'first_enter', first_enter,
    'first_submit', first_submit
  );
end;
$$;

revoke all on function public.award_entry_progress(text, text) from public;
grant execute on function public.award_entry_progress(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: credit_referral_click — pays referrer points (not karma-only)
-- Rules: auth required; no self-click; one credit per clicker per link; +50 pts
-- ---------------------------------------------------------------------------
create or replace function public.credit_referral_click(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking, giveaways
as $$
declare
  uid uuid := auth.uid();
  link giveaways.referral_pool;
  pts int := 50;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into link from giveaways.referral_pool where id = p_referral_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'link_not_found');
  end if;
  if link.referrer_id = uid then
    return jsonb_build_object('ok', false, 'reason', 'self_click');
  end if;

  begin
    insert into giveaways.referral_click_credits (referral_id, clicker_id, referrer_id, points_awarded)
    values (p_referral_id, uid, link.referrer_id, pts);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_credited');
  end;

  update giveaways.referral_pool
    set clicks_received = coalesce(clicks_received, 0) + 1,
        updated_at = now()
    where id = p_referral_id;

  update public.profiles
    set points_balance = coalesce(points_balance, 0) + pts,
        updated_at = now()
    where id = link.referrer_id;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (
    link.referrer_id,
    pts,
    'referral_click',
    'Referral click credit',
    jsonb_build_object('referral_id', p_referral_id, 'clicker_id', uid)
  );

  return jsonb_build_object('ok', true, 'points_awarded', pts, 'referrer_id', link.referrer_id);
end;
$$;

revoke all on function public.credit_referral_click(uuid) from public;
grant execute on function public.credit_referral_click(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: apply_referral_code — signup bonus (referrer +500, referee +250 once)
-- ---------------------------------------------------------------------------
create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  code text := lower(trim(coalesce(p_code, '')));
  referrer public.profiles;
  me public.profiles;
  pts_ref int := 500;
  pts_new int := 250;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if code = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_code');
  end if;

  select * into me from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;
  if me.referred_by is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_referred');
  end if;

  select * into referrer
    from public.profiles
    where lower(referral_code) = code
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;
  if referrer.id = uid then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  update public.profiles
    set referred_by = referrer.id,
        points_balance = coalesce(points_balance, 0) + pts_new,
        updated_at = now()
    where id = uid;

  update public.profiles
    set points_balance = coalesce(points_balance, 0) + pts_ref,
        updated_at = now()
    where id = referrer.id;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values
    (uid, pts_new, 'referral_signup', 'Referral signup bonus (you)',
      jsonb_build_object('referrer_id', referrer.id, 'code', code)),
    (referrer.id, pts_ref, 'referral_signup', 'Referral signup bonus (friend joined)',
      jsonb_build_object('referee_id', uid, 'code', code));

  return jsonb_build_object(
    'ok', true,
    'referee_points', pts_new,
    'referrer_points', pts_ref,
    'referrer_id', referrer.id
  );
end;
$$;

revoke all on function public.apply_referral_code(text) from public;
grant execute on function public.apply_referral_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: ensure_referral_code — generate share code if missing
-- ---------------------------------------------------------------------------
create or replace function public.ensure_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing text;
  candidate text;
  i int := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  select referral_code into existing from public.profiles where id = uid;
  if existing is not null and length(existing) > 0 then
    return existing;
  end if;
  loop
    candidate := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.profiles
        set referral_code = candidate, updated_at = now()
        where id = uid and (referral_code is null or referral_code = '');
      exit;
    exception when unique_violation then
      i := i + 1;
      if i > 8 then
        raise exception 'Could not allocate referral code';
      end if;
    end;
  end loop;
  select referral_code into existing from public.profiles where id = uid;
  return existing;
end;
$$;

revoke all on function public.ensure_referral_code() from public;
grant execute on function public.ensure_referral_code() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: consume_smart_fill — free daily/weekly smart-fill paywall
-- ---------------------------------------------------------------------------
create or replace function public.consume_smart_fill()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
  flags jsonb;
  remaining int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select * into row from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;
  flags := coalesce(row.feature_flags, '{}'::jsonb);

  if public.is_pro_tier(row.subscription_tier, row.is_premium)
     or coalesce((flags->>'extra_smart_fills')::boolean, false)
     or coalesce((flags->>'unlimited_smart_fills')::boolean, false) then
    return jsonb_build_object('ok', true, 'unlimited', true, 'remaining', null);
  end if;

  remaining := coalesce(row.smart_fills_remaining, 0);
  if remaining <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'smart_fills_exhausted', 'remaining', 0);
  end if;

  update public.profiles
    set smart_fills_remaining = remaining - 1, updated_at = now()
    where id = uid;

  return jsonb_build_object('ok', true, 'unlimited', false, 'remaining', remaining - 1);
end;
$$;

revoke all on function public.consume_smart_fill() from public;
grant execute on function public.consume_smart_fill() to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion: include referral_click_credits
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

  delete from giveaways.referral_click_credits where clicker_id = uid or referrer_id = uid;
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
