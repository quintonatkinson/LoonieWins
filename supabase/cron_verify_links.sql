-- LoonieWins: schedule contest URL recheck every 2 hours (pg_cron + pg_net).
-- Project ref placeholder: oftunznsumfidavvbqz (replace if Quinton creates a new project)
--
-- Prerequisites:
--   1) Migration 20261019_link_health_and_platform_count.sql applied (last_verified)
--   2) Edge Function `verify-contest-links` deployed
--   3) Extensions: pg_cron, pg_net
--   4) Replace SERVICE_ROLE_KEY_REPLACE_ME (Settings → API → service_role)
--      Prefer Vault: https://supabase.com/docs/guides/database/vault
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
    url := 'https://oftunznsumfidavvbqz.supabase.co/functions/v1/verify-contest-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_REPLACE_ME'
    ),
    body := '{"limit":40,"olderThanHours":24}'::jsonb
  );
  $$
);

-- Verify: SELECT * FROM cron.job WHERE jobname = 'looniewins-verify-contest-links';
