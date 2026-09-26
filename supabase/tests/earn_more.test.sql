-- Earn/spend RPCs from 20260927_earn_more.sql. Run after economy_hardening.test.sql.
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'c@example.com')
  on conflict do nothing;
update public.profiles set points_balance = 7000 where id = '33333333-3333-3333-3333-333333333333';

do $$
declare
  uid constant uuid := '33333333-3333-3333-3333-333333333333';
  r jsonb;
  p public.profiles;
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;

  -- Clients cannot self-grant a pass or check-in state
  update public.profiles set pro_pass_until = now() + interval '1 year', checkin_streak = 99 where id = uid;
  select * into p from public.profiles where id = uid;
  assert p.pro_pass_until is null and p.checkin_streak = 0, 'pass/check-in columns are server-owned';

  -- Daily check-in: once per day, day 1 = 20 pts
  r := public.claim_daily_checkin();
  assert (r->>'points_awarded')::int = 20 and (r->>'streak')::int = 1, 'first check-in ' || r;
  assert public.claim_daily_checkin()->>'reason' = 'already_claimed', 'second check-in same day refused';

  -- Smart-Fill packs
  r := public.buy_smart_fills(5);
  assert (r->>'smart_fills_remaining')::int = 8, 'pack adds 5 fills ' || r;
  assert public.buy_smart_fills(3)->>'reason' = 'bad_pack', 'only 5/15 packs';

  -- Pro Pass unlocks unlimited entries + smart fills server-side
  assert public.redeem_pro_pass(2)->>'reason' = 'bad_pass', 'only 1/7 day passes';
  r := public.redeem_pro_pass(1);
  assert (r->>'ok')::boolean and (r->>'balance')::int = 7000 + 20 - 200 - 1000, 'pass costs 1000 ' || r;
  assert (public.consume_free_entry(7)->>'is_pro')::boolean, 'pass counts as Pro for entries';
  assert (public.consume_smart_fill()->>'unlimited')::boolean, 'pass counts as Pro for smart fills';
  r := public.redeem_pro_pass(7);
  select * into p from public.profiles where id = uid;
  assert p.pro_pass_until > now() + interval '7 days 23 hours', 'passes stack';
  assert public.redeem_pro_pass(7)->>'reason' = 'insufficient_points', 'cannot overspend';

  -- Service-only RPCs
  begin
    perform public.credit_rewarded_video(uid, 'tx', 20, 30, '{}');
    raise exception 'client credited itself a video';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reverse_offerwall_completion('cpx', 'x');
    raise exception 'client ran a reversal';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Rewarded video cap + reversal (as the Edge Function / service role)
do $$
declare
  uid constant uuid := '33333333-3333-3333-3333-333333333333';
  before int;
  r jsonb;
begin
  select points_balance into before from public.profiles where id = uid;
  for i in 1..32 loop
    r := public.credit_rewarded_video(uid, 'vid-' || i, 20, 30, '{}');
  end loop;
  assert (r->>'capped')::boolean, 'video cap reached';
  assert (select points_balance from public.profiles where id = uid) = before + 30 * 20, 'exactly 30 videos paid';
  assert (public.credit_rewarded_video(uid, 'vid-1', 20, 100, '{}')->>'duplicate')::boolean, 'replayed tx id ignored';

  perform public.credit_offerwall_completion('cpx', 'survey-1', uid, 400, 0.4, null, '{}');
  r := public.reverse_offerwall_completion('cpx', 'survey-1');
  assert (r->>'points_reversed')::int = 400, 'reversal debits ' || r;
  assert (public.reverse_offerwall_completion('cpx', 'survey-1')->>'duplicate')::boolean, 'reversal is idempotent';
  assert (select points_balance from public.profiles where id = uid) = before + 600, 'net balance after reversal';
end $$;
select 'earn_more: all assertions passed' as result;
