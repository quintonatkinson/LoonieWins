-- Feed leveling: anonymized social-proof aggregates + link/created indexes.
-- Additive only. Safe to re-run. Does not drop or rewrite existing tables.
-- Depends on: public.contests, tracking.contest_entries (bootstrap / prior migrations).

-- ---------------------------------------------------------------------------
-- Indexes for dead-link hygiene + New rail + entry aggregates
-- ---------------------------------------------------------------------------
create index if not exists idx_contests_link_status
  on public.contests (link_status)
  where link_status is not null;

create index if not exists idx_contests_created_at
  on public.contests (created_at desc);

create index if not exists idx_contest_entries_entered_at
  on tracking.contest_entries (entered_at desc);

create index if not exists idx_contest_entries_contest_day
  on tracking.contest_entries (contest_id, entered_at);

-- Optional denormalized daily count on Hive Mind (clients may also use RPC live).
alter table public.contests
  add column if not exists entries_today int not null default 0;

comment on column public.contests.entries_today is
  'Optional denormalized anonymized entry count for the Toronto calendar day; refresh via RPC/cron.';

comment on column public.profiles.settings is
  'jsonb: geoFilter, quebecSafe, ageConfirmed, notifications, welcome_granted, …';

-- ---------------------------------------------------------------------------
-- Anonymized daily entry counts (no usernames / user_ids returned)
-- ---------------------------------------------------------------------------
create or replace function public.contest_entries_today(p_contest_id text default null)
returns table (contest_id text, entries_today bigint)
language sql
security definer
set search_path = public, tracking
stable
as $$
  select e.contest_id, count(*)::bigint as entries_today
  from tracking.contest_entries e
  where e.entered_at >= (date_trunc('day', timezone('America/Toronto', now()))
                         at time zone 'America/Toronto')
    and e.status in ('entered', 'submitted', 'won')
    and (p_contest_id is null or e.contest_id = p_contest_id)
  group by e.contest_id;
$$;

comment on function public.contest_entries_today(text) is
  'Privacy-safe aggregate: contest_id + count of entries today (Toronto day). No user identity.';

grant execute on function public.contest_entries_today(text) to anon, authenticated;

-- Global Hive Mind total for today (single scalar for home social proof).
create or replace function public.hive_entries_today()
returns bigint
language sql
security definer
set search_path = public, tracking
stable
as $$
  select count(*)::bigint
  from tracking.contest_entries e
  where e.entered_at >= (date_trunc('day', timezone('America/Toronto', now()))
                         at time zone 'America/Toronto')
    and e.status in ('entered', 'submitted', 'won');
$$;

comment on function public.hive_entries_today() is
  'Anonymized count of all contest entries marked today (Toronto day). No usernames.';

grant execute on function public.hive_entries_today() to anon, authenticated;
