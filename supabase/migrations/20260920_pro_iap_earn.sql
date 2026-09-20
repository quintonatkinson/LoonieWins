-- =============================================================================
-- LoonieWins — Pro IAP / AdGem postbacks / streak protection (ADDITIVE)
-- Requires freemium migration (20260320000000_freemium_monetization.sql) first.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: streak grace + comeback tracking + IAP entitlement mirror
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists streak_grace_available boolean default true,
  add column if not exists last_comeback_bonus_at date,
  add column if not exists iap_product_id text,
  add column if not exists iap_expires_at timestamptz;

comment on column public.profiles.streak_grace_available is
  'One free miss day; consumed when last_streak_at is exactly 2 UTC days ago.';
comment on column public.profiles.last_comeback_bonus_at is
  'UTC date of last comeback bonus after a broken streak.';

-- ---------------------------------------------------------------------------
-- Expand transaction types
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
    'offerwall', 'referral_click', 'referral_signup', 'streak_bonus',
    'comeback_bonus', 'iap'
  ));

-- ---------------------------------------------------------------------------
-- Idempotent offerwall completions (AdGem postbacks)
-- ---------------------------------------------------------------------------
create table if not exists tracking.offerwall_completions (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'adgem',
  external_id text not null,
  player_id uuid not null references auth.users (id) on delete cascade,
  amount_points int not null check (amount_points >= 0),
  payout_usd numeric,
  campaign_id text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (provider, external_id)
);

create index if not exists idx_offerwall_completions_player
  on tracking.offerwall_completions (player_id, created_at desc);

alter table tracking.offerwall_completions enable row level security;

drop policy if exists "Users read own offerwall completions" on tracking.offerwall_completions;
create policy "Users read own offerwall completions"
  on tracking.offerwall_completions for select
  using (auth.uid() = player_id);

-- No insert/update for authenticated — only service_role via Edge Function
grant select on tracking.offerwall_completions to authenticated;
grant all on tracking.offerwall_completions to service_role;

-- ---------------------------------------------------------------------------
-- RPC: credit_offerwall_completion — security definer; called with service role
-- ---------------------------------------------------------------------------
create or replace function public.credit_offerwall_completion(
  p_provider text,
  p_external_id text,
  p_player_id uuid,
  p_amount_points int,
  p_payout_usd numeric default null,
  p_campaign_id text default null,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  pts int := greatest(coalesce(p_amount_points, 0), 0);
begin
  if p_provider is null or length(trim(p_provider)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_provider');
  end if;
  if p_external_id is null or length(trim(p_external_id)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_external_id');
  end if;
  if p_player_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_player_id');
  end if;
  if pts <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_amount');
  end if;

  begin
    insert into tracking.offerwall_completions (
      provider, external_id, player_id, amount_points, payout_usd, campaign_id, raw
    ) values (
      lower(trim(p_provider)), trim(p_external_id), p_player_id, pts,
      p_payout_usd, p_campaign_id, coalesce(p_raw, '{}'::jsonb)
    );
  exception when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true, 'points_awarded', 0);
  end;

  update public.profiles
    set points_balance = coalesce(points_balance, 0) + pts,
        updated_at = now()
    where id = p_player_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'player_not_found');
  end if;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (
    p_player_id,
    pts,
    'offerwall',
    'Offerwall credit (' || lower(trim(p_provider)) || ')',
    jsonb_build_object(
      'provider', lower(trim(p_provider)),
      'external_id', trim(p_external_id),
      'campaign_id', p_campaign_id,
      'payout_usd', p_payout_usd
    )
  );

  return jsonb_build_object('ok', true, 'duplicate', false, 'points_awarded', pts);
end;
$$;

revoke all on function public.credit_offerwall_completion(text, text, uuid, int, numeric, text, jsonb) from public;
-- Invoked by Edge Function with service role (bypasses grant) or explicitly:
grant execute on function public.credit_offerwall_completion(text, text, uuid, int, numeric, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: apply_iap_entitlement — mirror store entitlement onto profile
-- ---------------------------------------------------------------------------
create or replace function public.apply_iap_entitlement(
  p_user_id uuid,
  p_tier text,
  p_product_id text default null,
  p_expires_at timestamptz default null,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, tracking
as $$
declare
  tier text := lower(coalesce(p_tier, 'free'));
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_user');
  end if;

  if not p_active or tier = 'free' or tier not in ('weekly', 'monthly') then
    update public.profiles
      set subscription_tier = 'free',
          is_premium = false,
          iap_product_id = null,
          iap_expires_at = null,
          updated_at = now()
      where id = p_user_id;
    return jsonb_build_object('ok', true, 'active', false, 'tier', 'free');
  end if;

  update public.profiles
    set subscription_tier = tier,
        is_premium = true,
        iap_product_id = p_product_id,
        iap_expires_at = p_expires_at,
        feature_flags = coalesce(feature_flags, '{}'::jsonb) ||
          jsonb_build_object(
            'unlimited_entries', true,
            'unlimited_smart_fills', true,
            'priority_sources', true
          ),
        updated_at = now()
    where id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  insert into tracking.transactions (user_id, amount, type, description, metadata)
  values (
    p_user_id,
    0,
    'iap',
    'Pro entitlement synced',
    jsonb_build_object('tier', tier, 'product_id', p_product_id, 'expires_at', p_expires_at)
  );

  return jsonb_build_object('ok', true, 'active', true, 'tier', tier);
end;
$$;

revoke all on function public.apply_iap_entitlement(uuid, text, text, timestamptz, boolean) from public;
grant execute on function public.apply_iap_entitlement(uuid, text, text, timestamptz, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Replace award_entry_progress with grace miss + comeback bonus
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
  grace_day date := (timezone('utc', now()))::date - 2;
  existing tracking.contest_entries;
  first_enter boolean := false;
  first_submit boolean := false;
  used_grace boolean := false;
  comeback_pts int := 0;
  comeback_xp int := 0;
  prev_streak int;
  grace_left boolean;
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
      -- One-day grace miss: keep streak continuity
      new_streak := coalesce(row.streak, 0) + 1;
      grace_left := false;
      used_grace := true;
    else
      -- Broken streak — reset + optional comeback bonus
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
          last_comeback_bonus_at = case
            when comeback_pts > 0 then today
            else row.last_comeback_bonus_at
          end,
          points_balance = case
            when comeback_pts > 0 then coalesce(points_balance, 0) + comeback_pts
            else points_balance
          end,
          updated_at = now()
      where id = uid
      returning * into row;

    if comeback_pts > 0 then
      insert into tracking.transactions (user_id, amount, type, description, metadata)
      values (
        uid,
        comeback_pts,
        'comeback_bonus',
        'Comeback bonus after returning to your streak',
        jsonb_build_object('prev_streak', prev_streak, 'xp_bonus', comeback_xp)
      );
    end if;

    if used_grace then
      insert into tracking.transactions (user_id, amount, type, description, metadata)
      values (
        uid,
        0,
        'streak_bonus',
        'Streak protection used (grace miss)',
        jsonb_build_object('streak', new_streak)
      );
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
    'streak_grace_available', grace_left
  );
end;
$$;

revoke all on function public.award_entry_progress(text, text) from public;
grant execute on function public.award_entry_progress(text, text) to authenticated;
