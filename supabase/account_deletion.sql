-- LoonieWins: self-serve account deletion (Apple 5.1.1(v) + Google Play)
--
-- PREFERRED: already included in supabase/schema.sql (full bootstrap).
-- This file is a standalone re-runnable patch if you only need the RPC.
--
-- Clients call:  supabase.rpc('delete_own_account')

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

  -- Multi-schema cleanup (also covered by ON DELETE CASCADE where configured)
  delete from tracking.contest_entries where user_id = uid;
  delete from tracking.transactions where user_id = uid;
  delete from giveaways.user_wins where user_id = uid;
  delete from giveaways.referral_pool where referrer_id = uid;
  delete from public.profiles where id = uid;

  -- Legacy public table names (no-op if migrated away)
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

comment on function public.delete_own_account() is
  'Deletes the calling user account and associated personal rows. Used by in-app Delete Account.';
