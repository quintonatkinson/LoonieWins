# LoonieWins

Canadian + American contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript (web Vite + Expo mobile)
- Tailwind CSS (glassmorphism dark theme)
- React Router (web)
- Supabase Auth + Postgres (multi-schema: `public`, `tracking`, `giveaways`)
- Edge Function `ingest-giveaways` for server-side Hive Mind refresh

## Setup

> **Owner?** Start with [`docs/OWNER_SETUP.md`](./docs/OWNER_SETUP.md) — a click-by-click checklist (database, shared web/app config, deploys, ad + survey accounts).

1. `npm install`
2. Copy `.env.example` → `.env`:
   - `VITE_SUPABASE_URL=https://oftunznsumfidavvbqz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=…`
   - Optional: `VITE_RSS2JSON_API_KEY` for fatter RSS pages (50–100 vs ~10 free)
3. Run **`supabase/setup/full_setup.sql`** in the SQL Editor (schema + every migration; re-runnable). Existing projects: `supabase/setup/latest_update.sql`. Expose schemas `public`, `tracking`, `giveaways`. Enable Email auth (Confirm email off for local testing).
4. `npm run dev` — with Supabase configured: Create account / Log in; without keys: guest mode.
5. **Server ingest (recommended):** follow [`docs/ingest-deploy.md`](./docs/ingest-deploy.md) (`supabase functions deploy ingest-giveaways` + cron / GitHub Action).
6. **Additive migrations** (after bootstrap): run every file in `supabase/migrations/` in filename order — freemium, UGC, push, feed leveling, Pro/IAP, and **`20260925_economy_hardening.sql` (required: makes points / Pro / XP server-owned)**.
7. **Scheduled functions** (`ingest-giveaways`, `send-push-alerts`, `send-weekly-digest`) reject callers without `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (or `<CRON_SECRET>` if you set that function secret).

## Features

- **Auth:** Sign-up, login, session restore, logout (web + Expo). Guest mode when env keys are missing.
- **Dashboard:** Contest feed, geo filter (CA / US / ANY), Québec-safe, Entered badges, Daily Routine / Enter-next home modes (honours every hide preference), Hive Mind search (accent-insensitive, matches tags too), sorts: ending soon / high value / most popular / best odds.
- **Smart-Fill / entry:** Hardened autofill injection, expanded copy chips, Open & Enter with mark-entered / submitted prompts, share.
- **Tracking:** Per-account `tracking.contest_entries` (entered / submitted / won / lost / expired) with local fallback.
- **Profile:** Plan, applied contests with status actions, autofill, geo/Quebec prefs, export, delete account.
- **Submit a contest (moderated UGC):** `/submit` — title, URL, country eligibility, optional expiry. Mods approve via `/moderate` → Hive Mind `contests` (`source = user-submitted`). SQL: `supabase/migrations/20260920_user_contest_submissions.sql`.
- **Push notifications:** Profile prefs (`newContestsCA` / `newContestsUS` / `endingTonight` / `weeklyDigestEmail`) + Expo token registration; Edge Functions `send-push-alerts` (Pro priority ending-tonight) + `send-weekly-digest` (Resend). SQL: `supabase/migrations/20260920_push_notifications.sql`, `20260920_weekly_digest_email.sql`. Ops: [`docs/push-digest.md`](./docs/push-digest.md).
- **Freemium / earn:** Weekly entry caps, Smart-Fill paywall, AdGem offerwall (sandbox demo offers credit guests only; signed-in balances change only via RPCs / AdGem postbacks), XP/streak on enter/submit (idempotent, 60 XP entries/day cap), paid referrals. SQL: `supabase/migrations/20260320000000_freemium_monetization.sql`.
- **Referrals / Winners / Earn:** Backed by `giveaways.*` and `tracking.transactions`.
- **Legal / store:** `/privacy`, `/terms`, `/support`, `/delete-account` + `public/legal/*.html`.
- **Account deletion:** `public.delete_own_account()` in bootstrap (also `supabase/account_deletion.sql`).

## Development checks

- `npm test` — unit tests (tagging, expiry parsing, feed filters / sorts, entry costs, sources, enrichment, autofill engine in jsdom)
- `npm run check` — lint + types + tests + autofill sync check (what CI runs for web)
- `supabase/tests/` — schema + economy security assertions against plain Postgres (see `.github/workflows/ci.yml`)
- Mobile: `cd mobile && npx tsc --noEmit -p . && npx expo export --platform android`

## Autofill engine (shared)

`shared/autofill/engine.js` is the single form-filling engine used by the web app, the Expo WebView and the browser extension. Edit it there, then run `npm run sync:shared` to regenerate `src/lib/autofill/engine.generated.ts`, `mobile/src/lib/autofill/engine.generated.ts` and `extension/lib/engine.generated.js` (CI fails if they drift). It never overwrites values the user typed, skips friend/referral, promo, username, company and address-line-2 fields, maps province/state codes ↔ names (EN/FR) for selects, fills country, and formats postal codes / phone numbers to the field's length.

## Browser extension

Chrome/Edge Manifest V3 autofill for giveaway forms lives in [`extension/`](./extension/). Load unpacked from that folder; see [`extension/README.md`](./extension/README.md) for install, sync (`looniewins_autofill` / Supabase anon), and security notes.

## Database

Canonical bootstrap: `supabase/schema.sql` (TEXT-id Hive Mind `public.contests` + account/tracking/giveaways tables + RLS + delete RPC).

## Giveaway sources

Canonical inventory: `src/lib/data/sources.ts` (mirrored in `mobile/`).

- Explicit `country: 'CA' | 'US' | 'BOTH'`
- `enabled` flag + optional `includeKeywords`, `fetchStrategy: 'rss2json_first'`
- Purchase / buy-to-enter tagging via `tagger.ts` (+ source `defaultRequirements` for purchase-category feeds)
- Curated daily/brand promos (Tims, McD, Scene+, PCH, OEM/Nike/telecom hubs, …): `src/lib/data/seasonalPromos.ts`

### Active pools (high level)

- **CA:** RedFlagDeals Contests (brand/OEM drops land here; Atom ~15 newest), Contest Canada (.net), CFS contests/daily, ContestScoop, Reddit CA subs
- **US:** Sweepstakes Bible (+ daily / IW / ending / no-purchase / purchase-required), Online Sweepstakes (+ daily), Sweeties, FreebieShark, Hip2Save, Southern Savers, Contest Bee, FreeStuffFinder giveaways (rss2json), Reddit US subs

### Blocked / scaffolds

- SmartCanucks contests category: Cloudflare — needs partnership
- Gleam / ViralSweep / Woobox directories & retailer hubs: no public listing API — scaffold only

Refresh: client mount + 30 min while open; Edge Function / GitHub Action / pg_cron for Hive Mind with app closed.
