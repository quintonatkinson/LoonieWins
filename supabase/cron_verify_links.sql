-- LoonieWins: schedule contest URL recheck every 2 hours (pg_cron + pg_net).
-- Project ref: ofutnznsyumfidavvbqz
--
-- Prerequisites:
--   1) Migration 20261019_link_health_and_platform_count.sql applied (last_verified)
--   2) Edge Function `verify-contest-links` deployed
--   3) Vault secret `looniewins_cron_secret` (see supabase/cron_ingest.sql)
--
-- ADDITIVE — does not drop tables.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('looniewins-verify-contest-links');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'looniewins-verify-contest-links',
  '15 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ofutnznsyumfidavvbqz.supabase.co/functions/v1/verify-contest-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'looniewins_cron_secret'
      )
    ),
    body := '{"limit":40,"olderThanHours":24}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Verify: SELECT * FROM cron.job WHERE jobname = 'looniewins-verify-contest-links';
