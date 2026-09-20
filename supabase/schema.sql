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
-- Additive migrations (run after this bootstrap / full Hive Mind schema):
--   supabase/migrations/20260920_user_contest_submissions.sql
--   → public.contest_submissions + is_admin/is_moderator + submit/moderate RPCs
-- =============================================================================
