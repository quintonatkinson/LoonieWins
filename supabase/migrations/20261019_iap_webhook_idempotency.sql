-- =============================================================================
-- RevenueCat webhook idempotency log (ADDITIVE)
-- =============================================================================
create table if not exists tracking.iap_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'revenuecat',
  event_id text not null,
  event_type text,
  app_user_id uuid,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists idx_iap_webhook_events_user
  on tracking.iap_webhook_events (app_user_id, created_at desc);

alter table tracking.iap_webhook_events enable row level security;

-- No client policies — service_role only (Edge Function revenuecat-webhook)
-- Ensure tracking is in Project Settings → API → Exposed schemas (ops checklist Start here #4)
grant usage on schema tracking to service_role;
revoke all on tracking.iap_webhook_events from anon, authenticated;
grant all on tracking.iap_webhook_events to service_role;

comment on table tracking.iap_webhook_events is
  'Idempotency log for RevenueCat (and future IAP) webhooks. Unique (provider, event_id).';
