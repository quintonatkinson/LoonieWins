-- =============================================================================
-- LoonieWins — Additive: user-submitted contests (moderated) → Hive Mind
-- =============================================================================
-- Safe to re-run. Apply after bootstrap (profiles + contests TEXT-id Hive Mind).
-- Fresh installs: also folded into docs/supabase-bootstrap companion + schema tip.
--
-- Flow:
--   1. Authenticated user calls submit_contest_suggestion(...)
--   2. Moderators/admins call moderate_contest_submission(id, 'approve'|'reject')
--   3. Approve upserts into public.contests (source = 'user-submitted')
--
-- Bootstrap first admin (SQL Editor as postgres / service role):
--   update public.profiles set is_admin = true where email = 'you@example.com';
-- =============================================================================

create extension if not exists "pgcrypto";

-- Shared updated_at helper (no-op if already present from bootstrap)
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
-- Profiles: moderation flags (service-role / SQL editor only; clients blocked)
-- Requires public.profiles (full bootstrap / auth migration).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles
  add column if not exists is_moderator boolean not null default false;

comment on column public.profiles.is_admin is
  'Platform admin. Set only via SQL Editor / service role — clients cannot self-promote.';
comment on column public.profiles.is_moderator is
  'Can approve/reject contest submissions. Set only via SQL Editor / service role.';

create or replace function public.protect_profile_moderation_roles()
returns trigger
language plpgsql
as $$
begin
  -- Authenticated PostgREST sessions cannot escalate or clear role flags.
  -- Dashboard SQL (auth.uid() null) and service_role can set them.
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
      new.is_moderator := old.is_moderator;
    elsif tg_op = 'INSERT' then
      new.is_admin := false;
      new.is_moderator := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_moderation_roles on public.profiles;
create trigger profiles_protect_moderation_roles
  before insert or update on public.profiles
  for each row execute function public.protect_profile_moderation_roles();

-- ---------------------------------------------------------------------------
-- Staff check (security definer — avoids RLS recursion on profiles)
-- ---------------------------------------------------------------------------
create or replace function public.is_contest_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_admin or p.is_moderator
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.is_contest_moderator() from public;
grant execute on function public.is_contest_moderator() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- public.contest_submissions — moderated UGC queue
-- ---------------------------------------------------------------------------
create table if not exists public.contest_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  url text not null,
  url_normalized text not null,
  eligibility text not null
    check (eligibility in ('CA', 'US', 'NA', 'Unknown')),
  expiry_date timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  contest_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contest_submissions_title_len
    check (char_length(trim(title)) between 3 and 200),
  constraint contest_submissions_url_len
    check (char_length(url) between 12 and 2048)
);

create index if not exists idx_contest_submissions_submitter
  on public.contest_submissions (submitter_id, created_at desc);

create index if not exists idx_contest_submissions_status
  on public.contest_submissions (status, created_at desc);

create index if not exists idx_contest_submissions_url_norm
  on public.contest_submissions (url_normalized);

create unique index if not exists idx_contest_submissions_pending_url
  on public.contest_submissions (url_normalized)
  where status = 'pending';

drop trigger if exists contest_submissions_updated_at on public.contest_submissions;
create trigger contest_submissions_updated_at
  before update on public.contest_submissions
  for each row execute function public.update_updated_at();

grant select, insert, update, delete on public.contest_submissions
  to anon, authenticated;

alter table public.contest_submissions enable row level security;

drop policy if exists "Users read own submissions" on public.contest_submissions;
create policy "Users read own submissions"
  on public.contest_submissions for select
  to authenticated
  using (auth.uid() = submitter_id or public.is_contest_moderator());

drop policy if exists "Users insert own submissions" on public.contest_submissions;
create policy "Users insert own submissions"
  on public.contest_submissions for insert
  to authenticated
  with check (auth.uid() = submitter_id);

-- No direct UPDATE/DELETE for clients — moderation via RPC only
drop policy if exists "Mods update submissions" on public.contest_submissions;
create policy "Mods update submissions"
  on public.contest_submissions for update
  to authenticated
  using (public.is_contest_moderator())
  with check (public.is_contest_moderator());

-- ---------------------------------------------------------------------------
-- URL helpers + validation
-- ---------------------------------------------------------------------------
create or replace function public.normalize_contest_url(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  u text;
begin
  u := lower(trim(p_url));
  u := regexp_replace(u, '/+$', '');
  u := regexp_replace(u, '#.*$', '');
  u := regexp_replace(u, '\?.*$', '');
  -- strip common feed suffixes
  u := regexp_replace(u, '/(feed|rss|atom|atom\.xml)$', '');
  return u;
end;
$$;

create or replace function public.validate_contest_submission_url(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  u text := trim(p_url);
begin
  if u is null or char_length(u) < 12 or char_length(u) > 2048 then
    raise exception 'URL must be between 12 and 2048 characters';
  end if;
  if u !~* '^https?://' then
    raise exception 'URL must start with http:// or https://';
  end if;
  if u ~* '^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])' then
    raise exception 'Localhost URLs are not allowed';
  end if;
  if u ~* '(javascript:|data:|file:|vbscript:)' then
    raise exception 'URL scheme not allowed';
  end if;
  -- Require a hostname with a dot (blocks bare IPs without TLD edge cases lightly)
  if u !~* '^https?://[^/\s]+\.[^/\s]+' then
    raise exception 'URL must include a valid hostname';
  end if;
  return u;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit RPC (rate limit + validation + insert)
-- ---------------------------------------------------------------------------
create or replace function public.submit_contest_suggestion(
  p_title text,
  p_url text,
  p_eligibility text default 'Unknown',
  p_expiry_date timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_url text;
  norm text;
  elig text;
  title_clean text;
  recent_count int;
  new_id uuid;
  max_per_day constant int := 5;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  title_clean := trim(p_title);
  if title_clean is null or char_length(title_clean) < 3 or char_length(title_clean) > 200 then
    raise exception 'Title must be 3–200 characters';
  end if;

  elig := coalesce(nullif(trim(p_eligibility), ''), 'Unknown');
  if elig not in ('CA', 'US', 'NA', 'Unknown') then
    raise exception 'eligibility must be CA, US, NA, or Unknown';
  end if;

  if p_expiry_date is not null and p_expiry_date < now() - interval '1 day' then
    raise exception 'Expiry date is already in the past';
  end if;

  clean_url := public.validate_contest_submission_url(p_url);
  norm := public.normalize_contest_url(clean_url);

  select count(*) into recent_count
  from public.contest_submissions s
  where s.submitter_id = uid
    and s.created_at > now() - interval '24 hours';

  if recent_count >= max_per_day then
    raise exception 'Rate limit: at most % submissions per 24 hours', max_per_day;
  end if;

  if exists (
    select 1 from public.contest_submissions s
    where s.url_normalized = norm
      and s.status in ('pending', 'approved')
  ) then
    raise exception 'This URL was already submitted';
  end if;

  if exists (
    select 1 from public.contests c
    where public.normalize_contest_url(c.url) = norm
  ) then
    raise exception 'This contest is already in the Hive Mind feed';
  end if;

  insert into public.contest_submissions (
    submitter_id, title, url, url_normalized, eligibility, expiry_date, status
  ) values (
    uid, title_clean, clean_url, norm, elig, p_expiry_date, 'pending'
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_contest_suggestion(text, text, text, timestamptz) from public;
grant execute on function public.submit_contest_suggestion(text, text, text, timestamptz) to authenticated;

comment on function public.submit_contest_suggestion(text, text, text, timestamptz) is
  'Authenticated users submit a contest for moderation. Rate-limited; validates URL.';

-- ---------------------------------------------------------------------------
-- Moderate RPC — approve → Hive Mind contests; reject → status only
-- ---------------------------------------------------------------------------
create or replace function public.moderate_contest_submission(
  p_submission_id uuid,
  p_action text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sub public.contest_submissions%rowtype;
  action_clean text := lower(trim(p_action));
  hive_id text;
  contest_row public.contests%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_contest_moderator() then
    raise exception 'Moderator access required';
  end if;

  if action_clean not in ('approve', 'reject') then
    raise exception 'action must be approve or reject';
  end if;

  select * into sub
  from public.contest_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found';
  end if;

  if sub.status <> 'pending' then
    raise exception 'Submission is already %', sub.status;
  end if;

  if action_clean = 'reject' then
    update public.contest_submissions
    set
      status = 'rejected',
      rejection_reason = nullif(trim(coalesce(p_rejection_reason, '')), ''),
      moderated_by = uid,
      moderated_at = now()
    where id = p_submission_id;

    return jsonb_build_object(
      'ok', true,
      'status', 'rejected',
      'submission_id', p_submission_id
    );
  end if;

  -- approve → upsert Hive Mind contest
  hive_id := 'ugc-' || replace(sub.id::text, '-', '');

  insert into public.contests (
    id, title, url, source, expiry_date, is_estimated_expiry,
    prize_value, eligibility, tags, requirements, link_status, is_locked
  ) values (
    hive_id,
    sub.title,
    sub.url,
    'user-submitted',
    sub.expiry_date,
    sub.expiry_date is null,
    null,
    sub.eligibility,
    array['Community', 'User Submitted']::text[],
    '{}'::text[],
    null,
    false
  )
  on conflict (id) do update set
    title = excluded.title,
    url = excluded.url,
    source = excluded.source,
    expiry_date = excluded.expiry_date,
    is_estimated_expiry = excluded.is_estimated_expiry,
    eligibility = excluded.eligibility,
    tags = excluded.tags,
    updated_at = now()
  returning * into contest_row;

  update public.contest_submissions
  set
    status = 'approved',
    contest_id = hive_id,
    moderated_by = uid,
    moderated_at = now(),
    rejection_reason = null
  where id = p_submission_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'submission_id', p_submission_id,
    'contest_id', hive_id,
    'contest', jsonb_build_object(
      'id', contest_row.id,
      'title', contest_row.title,
      'url', contest_row.url,
      'source', contest_row.source,
      'eligibility', contest_row.eligibility,
      'expiry_date', contest_row.expiry_date
    )
  );
end;
$$;

revoke all on function public.moderate_contest_submission(uuid, text, text) from public;
grant execute on function public.moderate_contest_submission(uuid, text, text) to authenticated;

comment on function public.moderate_contest_submission(uuid, text, text) is
  'Mods/admins approve (→ public.contests Hive Mind) or reject a user submission.';

-- ---------------------------------------------------------------------------
-- Account deletion: wipe submissions when delete_own_account exists
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_own_account'
  ) then
    execute $fn$
      create or replace function public.delete_own_account()
      returns void
      language plpgsql
      security definer
      set search_path = public, tracking, giveaways, auth
      as $body$
      declare
        uid uuid := auth.uid();
      begin
        if uid is null then
          raise exception 'Not authenticated';
        end if;

        delete from public.contest_submissions where submitter_id = uid;
        if to_regclass('tracking.contest_entries') is not null then
          delete from tracking.contest_entries where user_id = uid;
        end if;
        if to_regclass('tracking.transactions') is not null then
          delete from tracking.transactions where user_id = uid;
        end if;
        if to_regclass('giveaways.user_wins') is not null then
          delete from giveaways.user_wins where user_id = uid;
        end if;
        if to_regclass('giveaways.referral_pool') is not null then
          delete from giveaways.referral_pool where referrer_id = uid;
        end if;
        delete from public.profiles where id = uid;
        delete from auth.users where id = uid;
      end;
      $body$;
    $fn$;
    revoke all on function public.delete_own_account() from public;
    grant execute on function public.delete_own_account() to authenticated;
  end if;
end;
$$;
