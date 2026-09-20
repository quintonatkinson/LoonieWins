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
