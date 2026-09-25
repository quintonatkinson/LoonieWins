-- Economy / RLS regression tests. Run after 00_supabase_stub.sql, schema.sql and migrations.
-- Every check is an ASSERT: psql -v ON_ERROR_STOP=1 exits non-zero on the first failure.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, false), set_config('role', 'authenticated', false)
$$;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

do $$
declare
  p public.profiles;
  r jsonb;
  ok_count int := 0;
begin
  -- Clients cannot grant themselves points / Pro / XP / flags
  update public.profiles
    set points_balance = 999999, is_premium = true, subscription_tier = 'monthly', xp = 100000,
        feature_flags = '{"unlimited_entries": true}'
    where id = auth.uid();
  select * into p from public.profiles where id = auth.uid();
  assert p.points_balance = 0 and not p.is_premium and p.subscription_tier = 'free'
     and p.xp = 0 and p.feature_flags = '{}'::jsonb, 'economy columns must be read-only to clients';

  -- ...but ordinary profile fields stay editable
  update public.profiles set display_name = 'Q', settings = '{"geoFilter":"CA"}' where id = auth.uid();
  select * into p from public.profiles where id = auth.uid();
  assert p.display_name = 'Q' and p.settings->>'geoFilter' = 'CA', 'profile fields must stay writable';

  -- Welcome bonus: once
  assert (public.claim_welcome_bonus()->>'ok')::boolean, 'first welcome claim succeeds';
  assert public.claim_welcome_bonus()->>'reason' = 'already_claimed', 'second welcome claim refused';
  assert (select points_balance from public.profiles where id = auth.uid()) = 1250, 'welcome = 1250';

  -- Spending: bounds + balance
  assert (public.spend_points_for_entry(250, 'c1')->>'balance')::int = 1000, 'spend debits';
  assert public.spend_points_for_entry(5, 'c1')->>'reason' = 'bad_cost', 'cost floor';
  assert public.spend_points_for_entry(-100, 'c1')->>'reason' = 'bad_cost', 'negative cost';
  assert public.spend_points_for_entry(3000, 'c1')->>'reason' = 'insufficient_points', 'overspend';

  -- XP works in the app's real order (entry row upserted BEFORE the RPC) and is not repeatable
  insert into tracking.contest_entries (user_id, contest_id, status) values (auth.uid(), 'c1', 'entered');
  assert (public.award_entry_progress('c1', 'entered')->>'xp_gained')::int = 15, 'first enter awards XP';
  assert (public.award_entry_progress('c1', 'entered')->>'xp_gained')::int = 0, 'repeat enter awards nothing';
  assert (public.award_entry_progress('c1', 'submitted')->>'xp_gained')::int = 35, 'first submit awards XP';
  assert (public.award_entry_progress('c1', 'submitted')->>'xp_gained')::int = 0, 'repeat submit awards nothing';

  -- Farming distinct ids is capped per day (60 XP-earning entries)
  for i in 1..80 loop perform public.award_entry_progress('farm' || i, 'entered'); end loop;
  assert (select xp from public.profiles where id = auth.uid()) = 50 + 59 * 15, 'daily XP entry cap';

  -- Weekly free cap is clamped server-side no matter what the client passes
  for i in 1..20 loop
    r := public.consume_free_entry(999999);
    if (r->>'ok')::boolean then ok_count := ok_count + 1; end if;
  end loop;
  assert ok_count = 7, 'free weekly cap clamped to 7, got ' || ok_count;
end $$;

-- Ledger rows cannot be forged by clients
do $$
begin
  begin
    insert into tracking.transactions (user_id, amount, type, description)
    values (auth.uid(), 5000, 'referral', 'forged');
    raise exception 'client inserted a ledger row';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Server-only RPCs are not callable by clients
do $$
begin
  begin
    perform public.apply_iap_entitlement(auth.uid(), 'monthly');
    raise exception 'client granted itself Pro';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ensure_week_reset(auth.uid());
    raise exception 'client called ensure_week_reset';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'economy_hardening: all assertions passed' as result;
