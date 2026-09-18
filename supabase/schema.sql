-- =============================================================================
-- LoonieWins — Supabase bootstrap (fresh project)
-- =============================================================================
-- Copy-paste into: Supabase Dashboard → SQL Editor → New query → Run
--
-- Sources reconciled (app code wins on conflicts):
--   - supabase_schema.sql          → contests Hive Mind shape (TEXT id + vault cols)
--   - supabase/schema.sql          → profiles, referral_pool, transactions,
--                                    user_wins, applied_contests, auth trigger
--   - src/hooks/useContestVault.ts → ContestRow / upsert onConflict: 'id'
--   - mobile/src/hooks/useContestVault.ts (same)
--
-- Conflict resolution:
--   contests.id is TEXT (not UUID). Contest IDs are generated in the app as
--   `${source.id}-${index}-${slug}` and upserted by id.
--   referral_pool.contest_id / user_wins.contest_id therefore reference TEXT.
--
-- No storage buckets, views, or seed rows are defined in the codebase.
-- Contests are populated at runtime via client syncToCloud (RSS pipeline).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions (gen_random_uuid is available by default on Supabase)
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. Helper: keep updated_at fresh
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
-- 3. Profiles (extends auth.users) — from supabase/schema.sql
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
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
-- 4. Contests — Hive Mind vault (authoritative; matches useContestVault)
--    Prefer this over the UUID/minimal shape in supabase/schema.sql.
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
-- 5. Referral pool — from supabase/schema.sql (contest_id → text)
-- ---------------------------------------------------------------------------
create table if not exists public.referral_pool (
  id uuid primary key default gen_random_uuid(),
  contest_id text references public.contests (id) on delete set null,
  referrer_id uuid references auth.users (id) on delete cascade,
  url text not null,
  clicks_received int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_referral_pool_referrer on public.referral_pool (referrer_id);

drop trigger if exists referral_pool_updated_at on public.referral_pool;
create trigger referral_pool_updated_at
  before update on public.referral_pool
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Transactions — from supabase/schema.sql
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  type text not null
    check (type in ('survey', 'purchase', 'referral', 'pro_pass', 'bonus')),
  description text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_transactions_user on public.transactions (user_id);

-- ---------------------------------------------------------------------------
-- 7. User wins — from supabase/schema.sql (contest_id → text)
-- ---------------------------------------------------------------------------
create table if not exists public.user_wins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text references public.contests (id) on delete set null,
  won_at timestamptz default now(),
  prize_description text,
  prize_value_estimate int,
  contest_source text,
  contest_url text,
  winner_region text
);

create index if not exists idx_user_wins_user on public.user_wins (user_id);

-- ---------------------------------------------------------------------------
-- 8. Applied contests — from supabase/schema.sql
-- ---------------------------------------------------------------------------
create table if not exists public.applied_contests (
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  entered_at timestamptz default now(),
  primary key (user_id, contest_id)
);

-- ---------------------------------------------------------------------------
-- 9. Auth trigger: create profile on signup — from supabase/schema.sql
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.contests enable row level security;
alter table public.referral_pool enable row level security;
alter table public.transactions enable row level security;
alter table public.user_wins enable row level security;
alter table public.applied_contests enable row level security;

-- ---- profiles ----
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---- contests (Hive Mind: anon read live + upsert; also allow authenticated) ----
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

-- ---- referral_pool ----
drop policy if exists "Referral pool readable by all" on public.referral_pool;
create policy "Referral pool readable by all"
  on public.referral_pool for select
  using (true);

drop policy if exists "Users can insert own referral" on public.referral_pool;
create policy "Users can insert own referral"
  on public.referral_pool for insert
  with check (auth.uid() = referrer_id);

drop policy if exists "Users can update own referral clicks" on public.referral_pool;
create policy "Users can update own referral clicks"
  on public.referral_pool for update
  using (auth.uid() = referrer_id);

-- ---- transactions ----
drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- ---- user_wins ----
drop policy if exists "User wins readable by all" on public.user_wins;
create policy "User wins readable by all"
  on public.user_wins for select
  using (true);

drop policy if exists "Users can insert own win" on public.user_wins;
create policy "Users can insert own win"
  on public.user_wins for insert
  with check (auth.uid() = user_id);

-- ---- applied_contests ----
drop policy if exists "Users can read own applied" on public.applied_contests;
create policy "Users can read own applied"
  on public.applied_contests for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own applied" on public.applied_contests;
create policy "Users can insert own applied"
  on public.applied_contests for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own applied" on public.applied_contests;
create policy "Users can delete own applied"
  on public.applied_contests for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- Done. Next: set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (web) or
-- EXPO_PUBLIC_SUPABASE_* (mobile), then run the app — contests sync via vault.
-- =============================================================================
