-- =============================================================================
-- LoonieWins — more ways to earn and spend points (run after 20260926_instant_feed.sql)
-- =============================================================================
-- Earn (no subscription needed):
--   claim_daily_checkin()                 7-day ladder 20→150 pts, once per UTC day
--   credit_rewarded_video(...)            AdMob SSV (service_role), 20 pts, 30/day cap
--   reverse_offerwall_completion(...)     survey/offer chargebacks (service_role)
-- Spend:
--   redeem_pro_pass(p_days 1|7)           1,000 / 5,000 pts → Pro perks without subscribing
--   buy_smart_fills(p_pack 5|15)          200 / 500 pts
-- Pro checks on the server now honour an active pass (profile_is_pro).
-- Idempotent: safe to re-run.
-- =============================================================================

alter table public.profiles add column if not exists pro_pass_until timestamptz;
alter table public.profiles add column if not exists checkin_streak int not null default 0;
alter table public.profiles add column if not exists last_checkin_on date;
alter table tracking.offerwall_completions add column if not exists reversed_at timestamptz;

alter table tracking.transactions drop constraint if exists transactions_type_check;
alter table tracking.transactions add constraint transactions_type_check check (type in (
  'survey', 'purchase', 'referral', 'pro_pass', 'bonus', 'entry_spend', 'offerwall',
  'referral_click', 'referral_signup', 'streak_bonus', 'comeback_bonus', 'iap',
  'checkin', 'rewarded_video', 'smart_fill_pack', 'reversal'
));

-- Keep the new economy columns server-owned too (extends 20260925 trigger).
create or replace function public.protect_profile_economy()
returns trigger
language plpgsql
as $$
begin
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
    new.pro_pass_until := old.pro_pass_until;
    new.checkin_streak := old.checkin_streak;
    new.last_checkin_on := old.last_checkin_on;
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
    new.pro_pass_until := null;
    new.checkin_streak := 0;
    new.last_checkin_on := null;
  end if;
  return new;
end;
$$;

create or replace function public.profile_is_pro(p public.profiles)
returns boolean
language sql
stable
as $$
  select public.is_pro_tier(p.subscription_tier, p.is_premium)
      or coalesce(p.pro_pass_until > now(), false)
$$;

-- ---------------------------------------------------------------------------
-- Daily check-in
-- ---------------------------------------------------------------------------
create or replace function public.claim_daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  today date := (timezone('utc', now()))::date;
  ladder constant int[] := array[20, 30, 40, 50, 60, 80, 150];
  new_streak int;
  pts int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select * into p from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;
  if p.last_checkin_on = today then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed', 'streak', p.checkin_streak,
      'next_points', ladder[least(p.checkin_streak, 6) + 1]);
  end if;

  new_streak := case when p.last_checkin_on = today - 1 then coalesce(p.checkin_streak, 0) + 1 else 1 end;
  pts := ladder[((new_streak - 1) % 7) + 1];

  update public.profiles
    set checkin_streak = new_streak,
        last_checkin_on = today,
        points_balance = coalesce(points_balance, 0) + pts,
        updated_at = now()
    where id = uid;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (uid, pts, 'checkin', 'Daily check-in (day ' || new_streak || ')',
          jsonb_build_object('streak', new_streak));

  return jsonb_build_object('ok', true, 'points_awarded', pts, 'streak', new_streak,
    'next_points', ladder[(new_streak % 7) + 1]);
end;
$$;
revoke all on function public.claim_daily_checkin() from public, anon;
grant execute on function public.claim_daily_checkin() to authenticated;

-- ---------------------------------------------------------------------------
-- Pro Pass (spend points instead of subscribing)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_pro_pass(p_days int)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  cost int;
  bal int;
  until timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  cost := case p_days when 1 then 1000 when 7 then 5000 else null end;
  if cost is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_pass');
  end if;

  update public.profiles
    set points_balance = points_balance - cost,
        pro_pass_until = greatest(coalesce(pro_pass_until, now()), now()) + make_interval(days => p_days),
        updated_at = now()
    where id = uid and coalesce(points_balance, 0) >= cost
    returning points_balance, pro_pass_until into bal, until;
  if not found then
    select coalesce(points_balance, 0) into bal from public.profiles where id = uid;
    return jsonb_build_object('ok', false, 'reason', 'insufficient_points', 'balance', coalesce(bal, 0), 'cost', cost);
  end if;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (uid, -cost, 'pro_pass', p_days || '-day Pro Pass', jsonb_build_object('until', until));

  return jsonb_build_object('ok', true, 'balance', bal, 'pro_pass_until', until);
end;
$$;
revoke all on function public.redeem_pro_pass(int) from public, anon;
grant execute on function public.redeem_pro_pass(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Smart-Fill packs
-- ---------------------------------------------------------------------------
create or replace function public.buy_smart_fills(p_pack int)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  cost int;
  bal int;
  fills int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  cost := case p_pack when 5 then 200 when 15 then 500 else null end;
  if cost is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_pack');
  end if;

  update public.profiles
    set points_balance = points_balance - cost,
        smart_fills_remaining = coalesce(smart_fills_remaining, 0) + p_pack,
        updated_at = now()
    where id = uid and coalesce(points_balance, 0) >= cost
    returning points_balance, smart_fills_remaining into bal, fills;
  if not found then
    select coalesce(points_balance, 0) into bal from public.profiles where id = uid;
    return jsonb_build_object('ok', false, 'reason', 'insufficient_points', 'balance', coalesce(bal, 0), 'cost', cost);
  end if;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (uid, -cost, 'smart_fill_pack', p_pack || ' Smart-Fills', jsonb_build_object('pack', p_pack));

  return jsonb_build_object('ok', true, 'balance', bal, 'smart_fills_remaining', fills);
end;
$$;
revoke all on function public.buy_smart_fills(int) from public, anon;
grant execute on function public.buy_smart_fills(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Rewarded video credits (AdMob server-side verification → Edge Function)
-- ---------------------------------------------------------------------------
create or replace function public.credit_rewarded_video(
  p_player_id uuid,
  p_transaction_id text,
  p_points int default 20,
  p_daily_cap int default 30,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  today_count int;
  res jsonb;
begin
  -- Serialize per player so parallel callbacks cannot slip past the cap.
  perform 1 from public.profiles where id = p_player_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'player_not_found');
  end if;
  select count(*) into today_count
    from tracking.offerwall_completions
    where player_id = p_player_id and provider = 'admob'
      and created_at >= timezone('utc', now())::date::timestamp at time zone 'utc';
  if today_count >= p_daily_cap then
    return jsonb_build_object('ok', true, 'capped', true, 'points_awarded', 0);
  end if;
  res := public.credit_offerwall_completion('admob', p_transaction_id, p_player_id,
    least(greatest(p_points, 1), 200), null, 'rewarded_video', p_raw);
  return res || jsonb_build_object('today', today_count + 1, 'cap', p_daily_cap);
end;
$$;
revoke all on function public.credit_rewarded_video(uuid, text, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.credit_rewarded_video(uuid, text, int, int, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Chargebacks (CPX status=2, BitLabs reconciliation, AdGem reversals)
-- ---------------------------------------------------------------------------
create or replace function public.reverse_offerwall_completion(p_provider text, p_external_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  c tracking.offerwall_completions;
begin
  select * into c from tracking.offerwall_completions
    where provider = lower(trim(p_provider)) and external_id = trim(p_external_id)
    for update;
  if not found then
    return jsonb_build_object('ok', true, 'reason', 'unknown_transaction');
  end if;
  if c.reversed_at is not null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  update tracking.offerwall_completions set reversed_at = now() where id = c.id;
  update public.profiles
    set points_balance = greatest(coalesce(points_balance, 0) - c.amount_points, 0), updated_at = now()
    where id = c.player_id;
  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (c.player_id, -c.amount_points, 'reversal', 'Offer reversed by ' || c.provider,
          jsonb_build_object('provider', c.provider, 'external_id', c.external_id));
  return jsonb_build_object('ok', true, 'points_reversed', c.amount_points);
end;
$$;
revoke all on function public.reverse_offerwall_completion(text, text) from public, anon, authenticated;
grant execute on function public.reverse_offerwall_completion(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Server Pro checks honour an active Pro Pass
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

  if public.profile_is_pro(row) or coalesce((flags->>'unlimited_entries')::boolean, false) then
    update public.profiles set last_daily_entry_at = now(), updated_at = now() where id = uid;
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

  if public.profile_is_pro(row)
     or coalesce((flags->>'extra_smart_fills')::boolean, false)
     or coalesce((flags->>'unlimited_smart_fills')::boolean, false) then
    return jsonb_build_object('ok', true, 'unlimited', true, 'remaining', null);
  end if;

  remaining := coalesce(row.smart_fills_remaining, 0);
  if remaining <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'smart_fills_exhausted', 'remaining', 0);
  end if;

  update public.profiles set smart_fills_remaining = remaining - 1, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true, 'unlimited', false, 'remaining', remaining - 1);
end;
$$;
revoke all on function public.consume_smart_fill() from public, anon;
grant execute on function public.consume_smart_fill() to authenticated;
