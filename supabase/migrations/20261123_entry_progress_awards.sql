-- =============================================================================
-- award_entry_progress: award XP once per (user, contest, milestone)
-- =============================================================================
-- Clients upsert tracking.contest_entries before calling this RPC, so "no entry
-- row yet" can never mean "first enter". Awards are recorded in a server-only
-- ledger instead, which also makes double-taps and multi-device calls idempotent.
-- Idempotent; safe to re-run. Supersedes earlier definitions of the function.
-- =============================================================================

create table if not exists tracking.entry_progress_awards (
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  kind text not null check (kind in ('enter', 'submit')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, contest_id, kind)
);

alter table tracking.entry_progress_awards enable row level security;
revoke all on tracking.entry_progress_awards from public, anon, authenticated;
grant all on tracking.entry_progress_awards to service_role;

comment on table tracking.entry_progress_awards is
  'XP milestones already granted per contest. Written only by award_entry_progress.';

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
  first_enter boolean := false;
  first_submit boolean := false;
  n int;
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

  -- Only contests the user actually tracks earn XP.
  perform 1 from tracking.contest_entries
    where user_id = uid and contest_id = p_contest_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'entry_missing');
  end if;

  select * into row from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  insert into tracking.entry_progress_awards (user_id, contest_id, kind)
    values (uid, p_contest_id, 'enter')
    on conflict do nothing;
  get diagnostics n = row_count;
  first_enter := n > 0;

  if p_status in ('submitted', 'won') then
    insert into tracking.entry_progress_awards (user_id, contest_id, kind)
      values (uid, p_contest_id, 'submit')
      on conflict do nothing;
    get diagnostics n = row_count;
    first_submit := n > 0;
  end if;

  if first_enter then
    xp_gain := xp_gain + 15;
  end if;
  if first_submit then
    xp_gain := xp_gain + 35;
  end if;

  new_xp := coalesce(row.xp, 0) + xp_gain;
  new_streak := coalesce(row.streak, 0);

  if xp_gain > 0 then
    if row.last_streak_at = today then
      new_streak := greatest(coalesce(row.streak, 0), 1);
    elsif row.last_streak_at = yesterday then
      new_streak := coalesce(row.streak, 0) + 1;
    else
      new_streak := 1;
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

revoke all on function public.award_entry_progress(text, text) from public, anon;
grant execute on function public.award_entry_progress(text, text) to authenticated, service_role;
