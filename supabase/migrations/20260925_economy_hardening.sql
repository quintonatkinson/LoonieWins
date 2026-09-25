-- =============================================================================
-- LoonieWins — economy hardening (run after the 20260920_* migrations)
-- =============================================================================
-- 1. Profiles: economy columns (points, Pro, XP, streaks, caps, IAP) are
--    server-owned. PostgREST sessions (anon/authenticated) can no longer write
--    them directly; security-definer RPCs, service_role and the SQL editor can.
-- 2. award_entry_progress: idempotent per (user, contest) via tracking.entry_awards,
--    so it works whether the client upserts the entry before or after the RPC
--    (previously cloud users got 0 XP because the row already existed), cannot be
--    farmed by repeating the same id, and caps XP-earning entries per UTC day.
-- 3. consume_free_entry: server clamps the weekly cap (client could pass 999999).
-- 4. New RPCs: spend_points_for_entry, claim_welcome_bonus.
-- 5. Clients no longer insert ledger rows directly; ensure_week_reset is internal.
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lock economy columns against direct client writes
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_economy()
returns trigger
language plpgsql
as $$
begin
  -- Security-definer RPCs run as the function owner, service_role as itself;
  -- only raw PostgREST writes run as anon/authenticated.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.points_balance := old.points_balance;
    new.is_premium := old.is_premium;
    new.subscription_tier := old.subscription_tier;
    new.xp := old.xp;
    new.level := old.level;
    new.streak := old.streak;
    new.smart_fills_remaining := old.smart_fills_remaining;
    new.weekly_entries_used := old.weekly_entries_used;
    new.weekly_entries_reset_at := old.weekly_entries_reset_at;
    new.last_streak_at := old.last_streak_at;
    new.streak_grace_available := old.streak_grace_available;
    new.last_comeback_bonus_at := old.last_comeback_bonus_at;
    new.feature_flags := old.feature_flags;
    new.iap_product_id := old.iap_product_id;
    new.iap_expires_at := old.iap_expires_at;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
  elsif tg_op = 'INSERT' then
    new.points_balance := 0;
    new.is_premium := false;
    new.subscription_tier := 'free';
    new.xp := 0;
    new.level := 1;
    new.streak := 0;
    new.smart_fills_remaining := 3;
    new.weekly_entries_used := 0;
    new.weekly_entries_reset_at := null;
    new.last_streak_at := null;
    new.streak_grace_available := true;
    new.last_comeback_bonus_at := null;
    new.feature_flags := '{}'::jsonb;
    new.iap_product_id := null;
    new.iap_expires_at := null;
    new.referral_code := null;
    new.referred_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_economy on public.profiles;
create trigger profiles_protect_economy
  before insert or update on public.profiles
  for each row execute function public.protect_profile_economy();

-- Ledger rows are written by RPCs / Edge Functions only.
drop policy if exists "Users insert own transactions" on tracking.transactions;

-- Internal helper (takes an arbitrary uid) — not callable from the API.
revoke execute on function public.ensure_week_reset(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Idempotent entry awards
-- ---------------------------------------------------------------------------
create table if not exists tracking.entry_awards (
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  entered_awarded_at timestamptz,
  submitted_awarded_at timestamptz,
  primary key (user_id, contest_id)
);
alter table tracking.entry_awards enable row level security;
-- No policies: only security-definer RPCs touch it.
create index if not exists idx_entry_awards_user_day
  on tracking.entry_awards (user_id, entered_awarded_at);

-- Back-fill so existing entries are not re-awarded.
insert into tracking.entry_awards (user_id, contest_id, entered_awarded_at, submitted_awarded_at)
select user_id, contest_id, entered_at,
       case when status in ('submitted', 'won') then coalesce(submitted_at, entered_at) end
from tracking.contest_entries
on conflict (user_id, contest_id) do nothing;

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
  award tracking.entry_awards;
  xp_gain int := 0;
  new_xp int;
  new_streak int;
  today date := (timezone('utc', now()))::date;
  yesterday date := (timezone('utc', now()))::date - 1;
  grace_day date := (timezone('utc', now()))::date - 2;
  first_enter boolean := false;
  first_submit boolean := false;
  used_grace boolean := false;
  comeback_pts int := 0;
  comeback_xp int := 0;
  prev_streak int;
  grace_left boolean;
  awards_today int;
  daily_xp_entry_cap constant int := 60;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_contest_id is null or length(trim(p_contest_id)) = 0 or length(p_contest_id) > 512 then
    return jsonb_build_object('ok', false, 'reason', 'missing_contest_id');
  end if;
  if p_status not in ('entered', 'submitted', 'won', 'lost', 'expired') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;

  select * into row from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  insert into tracking.entry_awards (user_id, contest_id)
  values (uid, p_contest_id)
  on conflict (user_id, contest_id) do nothing;
  select * into award from tracking.entry_awards
    where user_id = uid and contest_id = p_contest_id
    for update;

  select count(*) into awards_today
    from tracking.entry_awards
    where user_id = uid
      and entered_awarded_at >= timezone('utc', now())::date::timestamp at time zone 'utc';

  if award.entered_awarded_at is null and awards_today < daily_xp_entry_cap then
    first_enter := true;
    xp_gain := xp_gain + 15;
  end if;
  if p_status in ('submitted', 'won') and award.submitted_awarded_at is null
     and (first_enter or award.entered_awarded_at is not null) then
    first_submit := true;
    xp_gain := xp_gain + 35;
  end if;

  if first_enter or first_submit then
    update tracking.entry_awards
      set entered_awarded_at = coalesce(entered_awarded_at, now()),
          submitted_awarded_at = case when first_submit then now() else submitted_awarded_at end
      where user_id = uid and contest_id = p_contest_id;
  end if;

  new_xp := coalesce(row.xp, 0) + xp_gain;
  new_streak := coalesce(row.streak, 0);
  prev_streak := coalesce(row.streak, 0);
  grace_left := coalesce(row.streak_grace_available, true);

  if xp_gain > 0 then
    if row.last_streak_at is null then
      new_streak := 1;
      grace_left := true;
    elsif row.last_streak_at = today then
      new_streak := greatest(coalesce(row.streak, 0), 1);
    elsif row.last_streak_at = yesterday then
      new_streak := coalesce(row.streak, 0) + 1;
    elsif row.last_streak_at = grace_day and grace_left then
      new_streak := coalesce(row.streak, 0) + 1;
      grace_left := false;
      used_grace := true;
    else
      new_streak := 1;
      grace_left := true;
      if prev_streak >= 3
         and (row.last_comeback_bonus_at is null or row.last_comeback_bonus_at < today) then
        comeback_xp := 50;
        comeback_pts := 100;
        new_xp := new_xp + comeback_xp;
      end if;
    end if;

    update public.profiles
      set xp = new_xp,
          level = public.level_for_xp(new_xp),
          streak = new_streak,
          last_streak_at = today,
          streak_grace_available = grace_left,
          last_comeback_bonus_at = case when comeback_pts > 0 then today else row.last_comeback_bonus_at end,
          points_balance = coalesce(points_balance, 0) + comeback_pts,
          updated_at = now()
      where id = uid
      returning * into row;

    if comeback_pts > 0 then
      insert into tracking.transactions (user_id, amount, type, description, metadata)
      values (uid, comeback_pts, 'comeback_bonus', 'Comeback bonus after returning to your streak',
              jsonb_build_object('prev_streak', prev_streak, 'xp_bonus', comeback_xp));
    end if;
    if used_grace then
      insert into tracking.transactions (user_id, amount, type, description, metadata)
      values (uid, 0, 'streak_bonus', 'Streak protection used (grace miss)',
              jsonb_build_object('streak', new_streak));
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'xp_gained', xp_gain + comeback_xp,
    'xp', row.xp,
    'level', row.level,
    'streak', row.streak,
    'first_enter', first_enter,
    'first_submit', first_submit,
    'used_grace', used_grace,
    'comeback_points', comeback_pts,
    'comeback_xp', comeback_xp,
    'streak_grace_available', grace_left,
    'daily_cap_reached', awards_today >= daily_xp_entry_cap
  );
end;
$$;

revoke all on function public.award_entry_progress(text, text) from public, anon;
grant execute on function public.award_entry_progress(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. consume_free_entry — never trust a client-supplied cap above the free tier
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
  free_cap constant int := 7;
  cap int := least(greatest(coalesce(p_weekly_cap, free_cap), 0), free_cap);
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
    return jsonb_build_object('ok', true, 'is_pro', true,
      'weekly_used', row.weekly_entries_used, 'weekly_cap', null);
  end if;

  effective_cap := cap;
  if coalesce((flags->>'higher_entry_caps')::boolean, false) then
    effective_cap := cap * 2;
  end if;

  if coalesce(row.weekly_entries_used, 0) >= effective_cap then
    return jsonb_build_object('ok', false, 'reason', 'weekly_cap_reached',
      'weekly_used', row.weekly_entries_used, 'weekly_cap', effective_cap, 'is_pro', false);
  end if;

  update public.profiles
    set weekly_entries_used = coalesce(weekly_entries_used, 0) + 1,
        last_daily_entry_at = now(),
        updated_at = now()
    where id = uid
    returning * into row;

  return jsonb_build_object('ok', true, 'is_pro', false,
    'weekly_used', row.weekly_entries_used, 'weekly_cap', effective_cap);
end;
$$;

revoke all on function public.consume_free_entry(int) from public, anon;
grant execute on function public.consume_free_entry(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4a. spend_points_for_entry — atomic debit + ledger row
-- ---------------------------------------------------------------------------
create or replace function public.spend_points_for_entry(
  p_cost int,
  p_contest_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  bal int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  -- Bounds mirror ENTRY_COST_BY_TIER (micro 50 … mega 3000).
  if p_cost is null or p_cost < 50 or p_cost > 3000 then
    return jsonb_build_object('ok', false, 'reason', 'bad_cost');
  end if;

  update public.profiles
    set points_balance = points_balance - p_cost, updated_at = now()
    where id = uid and coalesce(points_balance, 0) >= p_cost
    returning points_balance into bal;

  if not found then
    select coalesce(points_balance, 0) into bal from public.profiles where id = uid;
    return jsonb_build_object('ok', false, 'reason', 'insufficient_points', 'balance', coalesce(bal, 0));
  end if;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (uid, -p_cost, 'entry_spend', 'Contest entry',
          jsonb_build_object('contest_id', left(coalesce(p_contest_id, ''), 512)));

  return jsonb_build_object('ok', true, 'balance', bal);
end;
$$;

revoke all on function public.spend_points_for_entry(int, text) from public, anon;
grant execute on function public.spend_points_for_entry(int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4b. claim_welcome_bonus — once per account, keyed on the ledger
-- ---------------------------------------------------------------------------
create or replace function public.claim_welcome_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  bonus constant int := 1250;
  bal int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- Serialize per user so two tabs cannot both claim.
  perform 1 from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  if exists (
    select 1 from tracking.transactions
    where user_id = uid and type = 'bonus' and metadata->>'kind' = 'welcome'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  update public.profiles
    set points_balance = coalesce(points_balance, 0) + bonus,
        settings = coalesce(settings, '{}'::jsonb) || '{"welcome_granted": true}'::jsonb,
        updated_at = now()
    where id = uid
    returning points_balance into bal;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (uid, bonus, 'bonus', 'Welcome bonus', '{"kind": "welcome"}'::jsonb);

  return jsonb_build_object('ok', true, 'points_awarded', bonus, 'balance', bal);
end;
$$;

revoke all on function public.claim_welcome_bonus() from public, anon;
grant execute on function public.claim_welcome_bonus() to authenticated;

-- Accounts that got the old client-side welcome grant: record it so it is not paid twice.
insert into tracking.transactions (user_id, amount, type, description, metadata)
select p.id, 0, 'bonus', 'Welcome bonus (granted before ledger)', '{"kind": "welcome", "backfill": true}'::jsonb
from public.profiles p
where coalesce(p.settings->>'welcome_granted', '') = 'true'
  and not exists (
    select 1 from tracking.transactions t
    where t.user_id = p.id and t.type = 'bonus' and t.metadata->>'kind' = 'welcome'
  );
