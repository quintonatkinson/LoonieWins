-- public.contests is server-written only (20260926_instant_feed.sql).
do $$
begin
  insert into public.contests (id, title, url, source) values ('c_test_lock', 'Real', 'https://real.example', 'Test');
  set local role anon;
  begin
    update public.contests set url = 'https://scam.example' where id = 'c_test_lock';
    raise exception 'anon rewrote a contest';
  exception when insufficient_privilege then null;
  end;
  set local role authenticated;
  begin
    insert into public.contests (id, title, url, source) values ('c_evil', 'x', 'https://scam.example', 'x');
    raise exception 'user inserted a contest';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.contests where id = 'c_test_lock') = 1, 'anon/auth can still read';
  begin
    perform public.retire_stale_contests();
    raise exception 'user ran retire_stale_contests';
  exception when insufficient_privilege then null;
  end;
  reset role;
  delete from public.contests where id = 'c_test_lock';
end $$;
select 'feed_lockdown: all assertions passed' as result;
