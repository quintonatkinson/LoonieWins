-- LoonieWins: schedule Hive Mind ingest every 30 minutes (pg_cron + pg_net).
-- Project ref: oftunznsumfidavvbqz
--
-- Prerequisites:
--   1) Edge Function `ingest-giveaways` deployed
--   2) Extensions: pg_cron, pg_net (Database → Extensions)
--   3) Replace SERVICE_ROLE_KEY below (Project Settings → API → service_role)
--      Prefer Vault: https://supabase.com/docs/guides/database/vault
--
-- This file is ADDITIVE — it does not drop tables or wipe bootstrap schema.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule prior job if re-running
DO $$
BEGIN
  PERFORM cron.unschedule('looniewins-ingest-giveaways');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

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

-- Verify: SELECT * FROM cron.job WHERE jobname = 'looniewins-ingest-giveaways';
