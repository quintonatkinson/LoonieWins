-- =============================================================================
-- Security hardening (idempotent; safe to re-run)
-- =============================================================================
-- 1) public.contests: writes are service_role only (ingest / verify Edge Functions).
-- 2) SECURITY DEFINER RPCs: no EXECUTE for anon/PUBLIC; authenticated only where
--    the function scopes itself to auth.uid(); service-only RPCs locked to service_role.
-- 3) ensure_week_reset: internal helper — caller check + no client EXECUTE.
-- 4) consume_free_entry: client-supplied weekly cap can only lower the free cap.
-- 5) profiles: clients cannot grant themselves entitlements, points, or fill credits.
-- 6) claim_welcome_bonus(): one-time server-side welcome points.
-- 7) Social tables readable by signed-in users only.
-- 8) User-supplied links (referrals, wins) must be http(s).
-- =============================================================================

-- 1) Contests write lockdown ---------------------------------------------------
drop policy if exists "Allow public insert contests" on public.contests;
drop policy if exists "Allow public update contests" on public.contests;
drop policy if exists "Allow public read live contests" on public.contests;
create policy "Allow public read live contests"
  on public.contests for select
  to anon, authenticated
  using (expiry_date > now() or expiry_date is null);
revoke insert, update, delete, truncate on public.contests from anon, authenticated;

comment on table public.contests is
  'Hive Mind contests. Reads: anon+auth (live rows). Writes: service_role Edge Functions only.';

-- 3) ensure_week_reset ---------------------------------------------------------
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
  if auth.role() in ('anon', 'authenticated') and p_uid is distinct from auth.uid() then
    raise exception 'Not allowed';
  end if;
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

-- 4) consume_free_entry: cap is clamped to the free-tier cap ------------------
create or replace function public.consume_free_entry(p_weekly_cap int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.profiles;
  cap int := least(greatest(coalesce(p_weekly_cap, 7), 0), 7);
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

-- 5) profiles: server-owned columns -------------------------------------------
-- Direct PostgREST writes run as anon/authenticated. SECURITY DEFINER RPCs run as
-- their owner and service_role bypasses this guard, so server paths keep working.
-- jsonb is used so columns added by later migrations (iap_*) are covered too.
create or replace function public.protect_profile_entitlements()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  frozen constant text[] := array[
    'subscription_tier', 'is_premium', 'feature_flags', 'iap_product_id', 'iap_expires_at',
    'referral_code', 'referred_by', 'weekly_entries_reset_at'
  ];
  new_j jsonb;
  old_j jsonb;
  k text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  new_j := to_jsonb(new);

  if tg_op = 'INSERT' then
    new_j := new_j || jsonb_build_object(
      'subscription_tier', 'free',
      'is_premium', false,
      'feature_flags', '{}'::jsonb,
      'iap_product_id', null,
      'iap_expires_at', null,
      'referral_code', null,
      'referred_by', null,
      'points_balance', 0,
      'smart_fills_remaining', 3,
      'weekly_entries_used', 0,
      'weekly_entries_reset_at', date_trunc('week', timezone('utc', now()))
    );
    return jsonb_populate_record(new, new_j);
  end if;

  old_j := to_jsonb(old);
  foreach k in array frozen loop
    if old_j ? k then
      new_j := jsonb_set(new_j, array[k], old_j -> k);
    end if;
  end loop;

  -- Clients may spend points / fill credits and record entries, never mint them.
  if coalesce(new.points_balance, 0) > coalesce(old.points_balance, 0) then
    new_j := jsonb_set(new_j, '{points_balance}', to_jsonb(old.points_balance));
  end if;
  if coalesce(new.smart_fills_remaining, 0) > coalesce(old.smart_fills_remaining, 0) then
    new_j := jsonb_set(new_j, '{smart_fills_remaining}', to_jsonb(old.smart_fills_remaining));
  end if;
  if coalesce(new.weekly_entries_used, 0) < coalesce(old.weekly_entries_used, 0) then
    new_j := jsonb_set(new_j, '{weekly_entries_used}', to_jsonb(old.weekly_entries_used));
  end if;

  -- The one-time welcome bonus marker cannot be cleared to claim it again.
  if coalesce((old.settings ->> 'welcome_granted')::boolean, false) then
    new_j := jsonb_set(
      new_j, '{settings}',
      coalesce(new.settings, '{}'::jsonb) || '{"welcome_granted": true}'::jsonb
    );
  end if;

  return jsonb_populate_record(new, new_j);
end;
$$;

drop trigger if exists profiles_protect_entitlements on public.profiles;
create trigger profiles_protect_entitlements
  before insert or update on public.profiles
  for each row execute function public.protect_profile_entitlements();

-- 6) One-time welcome points ---------------------------------------------------
create or replace function public.claim_welcome_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  uid uuid := auth.uid();
  pts constant int := 1250;
  row public.profiles;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  update public.profiles
    set points_balance = coalesce(points_balance, 0) + pts,
        settings = coalesce(settings, '{}'::jsonb) || '{"welcome_granted": true}'::jsonb,
        updated_at = now()
    where id = uid
      and not coalesce((settings ->> 'welcome_granted')::boolean, false)
    returning * into row;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (uid, pts, 'bonus', 'Welcome bonus', '{"source": "welcome"}'::jsonb);

  return jsonb_build_object('ok', true, 'points_awarded', pts, 'points_balance', row.points_balance);
end;
$$;

-- 2) EXECUTE grants on SECURITY DEFINER functions ------------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare
  f record;
  client_rpcs constant text[] := array[
    'apply_referral_code', 'award_entry_progress', 'claim_welcome_bonus', 'consume_free_entry',
    'consume_smart_fill', 'credit_referral_click', 'delete_own_account', 'ensure_referral_code',
    'is_contest_moderator', 'moderate_contest_submission', 'submit_contest_suggestion'
  ];
  aggregate_rpcs constant text[] := array[
    'platform_contest_count', 'platform_live_contest_count', 'contest_entries_today', 'hive_entries_today'
  ];
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
    if f.proname = any (client_rpcs) then
      execute format('grant execute on function %s to authenticated', f.sig);
    elsif f.proname = any (aggregate_rpcs) then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    end if;
  end loop;
end;
$$;

-- 7) Social tables: signed-in readers only --------------------------------------
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'giveaways'
      and tablename in ('user_wins', 'referral_pool')
      and cmd = 'SELECT'
      and 'anon' = any (roles)
  loop
    execute format('alter policy %I on %I.%I to authenticated', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- 8) User-supplied links shown to other users must be http(s) ------------------
alter table giveaways.referral_pool drop constraint if exists referral_pool_url_http;
alter table giveaways.referral_pool
  add constraint referral_pool_url_http check (url ~* '^https?://') not valid;
alter table giveaways.user_wins drop constraint if exists user_wins_contest_url_http;
alter table giveaways.user_wins
  add constraint user_wins_contest_url_http check (contest_url is null or contest_url ~* '^https?://') not valid;
