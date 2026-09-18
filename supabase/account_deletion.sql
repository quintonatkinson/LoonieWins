-- LoonieWins: self-serve account deletion (Apple Guideline 5.1.1(v) + Google Play account deletion)
-- Run in Supabase SQL editor AFTER auth + profiles schema exist.
--
-- Clients call:  select public.delete_own_account();
-- via supabase.rpc('delete_own_account')

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Explicit cleanup (also covered by ON DELETE CASCADE from auth.users where configured)
  delete from public.applied_contests where user_id = uid;
  delete from public.transactions where user_id = uid;
  delete from public.user_wins where user_id = uid;
  delete from public.referral_pool where referrer_id = uid;
  delete from public.profiles where id = uid;

  -- Remove the auth user (requires security definer owned by a role that can delete auth.users)
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account() is
  'Deletes the calling user account and associated personal rows. Used by in-app Delete Account.';
