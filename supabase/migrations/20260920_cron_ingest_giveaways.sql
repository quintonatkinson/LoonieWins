-- ADDITIVE: schedule server ingest for Hive Mind contests (project oftunznsumfidavvbqz).
-- Does not modify contests schema or bootstrap tables owned by other tracks.
-- After deploy of Edge Function ingest-giveaways, replace SERVICE_ROLE_KEY_REPLACE_ME
-- and run this in SQL Editor (or rely on supabase/cron_ingest.sql).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('looniewins-ingest-giveaways');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- NOTE: Operator must substitute the real service_role JWT before this job can auth.
SELECT cron.schedule(
  'looniewins-ingest-giveaways',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oftunznsumfidavvbqz.supabase.co/functions/v1/ingest-giveaways',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_REPLACE_ME'
    ),
    body := '{}'::jsonb
  );
  $$
);
