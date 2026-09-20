-- LoonieWins Supabase schema
-- Run in Supabase SQL editor or via migrations.

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_premium boolean default false,
  points_balance int default 0,
  xp int default 0,
  level int default 1,
  streak int default 0,
  auto_fill_data jsonb default '{}',
  settings jsonb default '{}',
  smart_fills_remaining int default 3,
  last_daily_entry_at timestamptz,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'weekly', 'monthly')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Contests (can be synced from RSS or stored for history)
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  original_url text,
  image_url text,
  prize_value numeric,
  expiry_date timestamptz,
  category text,
  restrictions text[] default '{}',
  win_score numeric,
  source text,
  created_at timestamptz default now()
);

-- Referral pool: user-submitted links, click tracking
create table if not exists public.referral_pool (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references public.contests (id) on delete set null,
  referrer_id uuid references auth.users (id) on delete cascade,
  url text not null,
  clicks_received int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transactions: points, purchases, referrals
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  type text not null check (type in ('survey', 'purchase', 'referral', 'pro_pass', 'bonus')),
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- User wins (Winners tab)
create table if not exists public.user_wins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id uuid references public.contests (id) on delete set null,
  won_at timestamptz default now(),
  prize_description text,
  prize_value_estimate int,
  contest_source text,
  contest_url text,
  winner_region text
);

-- Applied contests (Routine + Hide Entered)
create table if not exists public.applied_contests (
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  entered_at timestamptz default now(),
  primary key (user_id, contest_id)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.contests enable row level security;
alter table public.referral_pool enable row level security;
alter table public.transactions enable row level security;
alter table public.user_wins enable row level security;
alter table public.applied_contests enable row level security;

-- Profiles: user can read/update own
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Contests: read for all (feed)
create policy "Contests are readable by all"
  on public.contests for select
  using (true);

-- Referral pool: read all, insert/update own
create policy "Referral pool readable by all"
  on public.referral_pool for select
  using (true);

create policy "Users can insert own referral"
  on public.referral_pool for insert
  with check (auth.uid() = referrer_id);

create policy "Users can update own referral clicks"
  on public.referral_pool for update
  using (auth.uid() = referrer_id);

-- Transactions: user can read own
create policy "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- User wins: readable by all for Winners tab
create policy "User wins readable by all"
  on public.user_wins for select
  using (true);

create policy "Users can insert own win"
  on public.user_wins for insert
  with check (auth.uid() = user_id);

-- Applied contests: user can manage own
create policy "Users can read own applied"
  on public.applied_contests for select
  using (auth.uid() = user_id);

create policy "Users can insert own applied"
  on public.applied_contests for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own applied"
  on public.applied_contests for delete
  using (auth.uid() = user_id);

-- Trigger: create profile on signup (optional)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- Additive migrations (run after this bootstrap / full Hive Mind schema):
--   supabase/migrations/20260920_user_contest_submissions.sql
--   → public.contest_submissions + is_admin/is_moderator + submit/moderate RPCs
-- =============================================================================
