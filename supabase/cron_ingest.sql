-- LoonieWins: schedule Hive Mind ingest every 30 minutes (pg_cron + pg_net).
-- Project ref: ofutnznsyumfidavvbqz
--
-- Prerequisites:
--   1) Edge Function `ingest-giveaways` deployed
--   2) Edge secret CRON_SECRET set (the handler accepts it as Bearer)
--   3) Vault secret `looniewins_cron_secret` holding the same value — create once
--      in SQL Editor (never commit the value):
--        select vault.create_secret('<CRON_SECRET value>', 'looniewins_cron_secret');
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

-- pg_net defaults to a 5s timeout; ingest takes ~20-30s.
SELECT cron.schedule(
  'looniewins-ingest-giveaways',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ofutnznsyumfidavvbqz.supabase.co/functions/v1/ingest-giveaways',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'looniewins_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Verify: SELECT * FROM cron.job WHERE jobname = 'looniewins-ingest-giveaways';
