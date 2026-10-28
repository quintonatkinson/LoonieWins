-- Inbox Shield (Phase 1) — additive profile columns for consent + entry email prefs.
-- Run in Supabase SQL Editor when ready; app also persists to localStorage offline.

alter table public.profiles
  add column if not exists inbox_shield_enabled boolean not null default false,
  add column if not exists entry_email_for_giveaways text,
  add column if not exists inbox_shield_consent_at timestamptz,
  add column if not exists inbox_shield_mode text not null default 'none'
    check (inbox_shield_mode in ('none', 'local', 'gmail'));

comment on column public.profiles.inbox_shield_enabled is
  'User opted into Inbox Shield (local rules now; Gmail sync Phase 2).';
comment on column public.profiles.entry_email_for_giveaways is
  'Email used on contest forms — may differ from auth email.';
comment on column public.profiles.inbox_shield_consent_at is
  'When user accepted, skipped, or chose local-only Inbox Shield.';
comment on column public.profiles.inbox_shield_mode is
  'none | local (device prefs) | gmail (OAuth planned Phase 2).';
