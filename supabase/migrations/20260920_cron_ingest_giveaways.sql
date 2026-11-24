-- ADDITIVE: schedule server ingest for Hive Mind contests (project ofutnznsyumfidavvbqz).
-- Does not modify contests schema or bootstrap tables owned by other tracks.
-- Requires Vault secret `looniewins_cron_secret` (see supabase/cron_ingest.sql);
-- until it exists the job runs but the Edge Function returns 401.
-- Companion: supabase/cron_verify_links.sql (link_status + last_verified recheck).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

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
