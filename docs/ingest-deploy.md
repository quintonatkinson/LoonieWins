# Deploy server ingest (Hive Mind) — project `oftunznsumfidavvbqz`

Keeps `public.contests` filled every 30 minutes **even when nobody has the app open**.

## 1. Deploy Edge Function

```bash
# From repo root (requires Supabase CLI + login)
npx supabase login
npx supabase link --project-ref oftunznsumfidavvbqz
npx supabase functions deploy ingest-giveaways --project-ref oftunznsumfidavvbqz
```

`supabase/config.toml` sets `verify_jwt = false` so GitHub Action / pg_cron can POST with the service role bearer token.

## 2. Secrets (Supabase)

Dashboard → **Project Settings → Edge Functions → Secrets** (or CLI):

| Secret | Required | Notes |
|--------|----------|-------|
| `SUPABASE_URL` | auto | `https://oftunznsumfidavvbqz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | auto | Injected for functions |
| `RSS2JSON_API_KEY` | optional | Paid [rss2json](https://rss2json.com/) key → `count=100` (fatter pages). Free tier ≈10 items. |

```bash
npx supabase secrets set RSS2JSON_API_KEY=your_key --project-ref oftunznsumfidavvbqz
```

## 3. Pick ONE scheduler (or both)

### A) GitHub Action (simplest)

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | `https://oftunznsumfidavvbqz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` (secret) |

Workflow: `.github/workflows/ingest-giveaways.yml` — cron `*/30 * * * *` + manual **Run workflow**.

### B) pg_cron inside Supabase

1. Database → Extensions → enable **pg_cron** and **pg_net**
2. SQL Editor → paste `supabase/cron_ingest.sql`
3. Replace `SERVICE_ROLE_KEY_REPLACE_ME` with the real `service_role` JWT
4. Confirm: `SELECT * FROM cron.job WHERE jobname = 'looniewins-ingest-giveaways';`

Same SQL lives as additive migration: `supabase/migrations/20260920_cron_ingest_giveaways.sql`.

## 4. Smoke test

```bash
curl -sS -X POST \
  'https://oftunznsumfidavvbqz.supabase.co/functions/v1/ingest-giveaways' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

Expect `ok: true`, non-zero `upserted`, and `perSource` counts for CA/US feeds.

## 5. Client optional key

Web `.env` / Expo env:

```bash
VITE_RSS2JSON_API_KEY=your_key          # web
# EXPO_PUBLIC_RSS2JSON_API_KEY if you wire mobile later — mobile currently uses same engine via import.meta if bundled
```

## Notes

- This agent’s Supabase MCP is linked to other projects, **not** `oftunznsumfidavvbqz` — Quinton must deploy from his CLI/dashboard.
- SmartCanucks contests category remains blocked (Cloudflare); FreeStuffFinder giveaways uses `rss2json_first`.
- No ToS-violating scrapers; Gleam/retailer hubs are scaffolds until partner APIs exist.
