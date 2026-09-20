# LoonieWins

Canadian + American contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript (web Vite + Expo mobile)
- Tailwind CSS (glassmorphism dark theme)
- React Router (web)
- Supabase Auth + Postgres (multi-schema: `public`, `tracking`, `giveaways`)
- Edge Function `ingest-giveaways` for server-side Hive Mind refresh

## Setup

1. `npm install`
2. Copy `.env.example` → `.env`:
   - `VITE_SUPABASE_URL=https://oftunznsumfidavvbqz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=…`
   - Optional: `VITE_RSS2JSON_API_KEY` for fatter RSS pages (50–100 vs ~10 free)
3. Run **`supabase/schema.sql`** in the SQL Editor (full bootstrap). Expose schemas `public`, `tracking`, `giveaways`. Enable Email auth (Confirm email off for local testing).
4. `npm run dev` — with Supabase configured: Create account / Log in; without keys: guest mode.
5. **Server ingest (recommended):** follow [`docs/ingest-deploy.md`](./docs/ingest-deploy.md) (`supabase functions deploy ingest-giveaways` + cron / GitHub Action).
6. **Additive migrations** (after bootstrap): UGC, push, freemium SQL under `supabase/migrations/`.

## Features

- **Auth:** Sign-up, login, session restore, logout (web + Expo). Guest mode when env keys are missing.
- **Dashboard:** Contest feed, geo filter (CA / US / ANY), Entered badges, Daily Routine / Enter-next home modes, Hive Mind search, ending-soon sort.
- **Smart-Fill / entry:** Hardened autofill injection, expanded copy chips, Open & Enter with mark-entered / submitted prompts, share.
- **Tracking:** Per-account `tracking.contest_entries` (entered / submitted / won / lost / expired) with local fallback.
- **Profile:** Plan, applied contests with status actions, autofill, geo/Quebec prefs, export, delete account.
- **Submit a contest (moderated UGC):** `/submit` — title, URL, country eligibility, optional expiry. Mods approve via `/moderate` → Hive Mind `contests` (`source = user-submitted`). SQL: `supabase/migrations/20260920_user_contest_submissions.sql`.
- **Push notifications:** Profile prefs (`newContestsCA` / `newContestsUS` / `endingTonight`) + Expo token registration; Edge Function `send-push-alerts`. SQL: `supabase/migrations/20260920_push_notifications.sql`.
- **Freemium / earn:** Weekly entry caps, Smart-Fill paywall, AdGem offerwall (sandbox without keys), XP/streak on enter/submit, paid referrals. SQL: `supabase/migrations/20260320000000_freemium_monetization.sql`.
- **Referrals / Winners / Earn:** Backed by `giveaways.*` and `tracking.transactions`.
- **Legal / store:** `/privacy`, `/terms`, `/support`, `/delete-account` + `public/legal/*.html`.
- **Account deletion:** `public.delete_own_account()` in bootstrap (also `supabase/account_deletion.sql`).

## Browser extension

Chrome/Edge Manifest V3 autofill for giveaway forms lives in [`extension/`](./extension/). Load unpacked from that folder; see [`extension/README.md`](./extension/README.md) for install, sync (`looniewins_autofill` / Supabase anon), and security notes.

## Database

Canonical bootstrap: `supabase/schema.sql` (TEXT-id Hive Mind `public.contests` + account/tracking/giveaways tables + RLS + delete RPC).

## Giveaway sources

Canonical inventory: `src/lib/data/sources.ts` (mirrored in `mobile/`).

- Explicit `country: 'CA' | 'US' | 'BOTH'`
- `enabled` flag + optional `includeKeywords`, `fetchStrategy: 'rss2json_first'`
- Purchase / buy-to-enter tagging via `tagger.ts` (+ source `defaultRequirements` for purchase-category feeds)
- Curated daily/brand promos (Tims, McD Monopoly, Scene+, PCH, RAM hub, …): `src/lib/data/seasonalPromos.ts`

### Active pools (high level)

- **CA:** RedFlagDeals Contests (brand/OEM drops land here; Atom ~15 newest), Contest Canada (.net), CFS contests/daily, ContestScoop, Reddit CA subs
- **US:** Sweepstakes Bible (+ daily / IW / ending / no-purchase / purchase-required), Online Sweepstakes (+ daily), Sweeties, FreebieShark, Hip2Save, Southern Savers, Contest Bee, FreeStuffFinder giveaways (rss2json), Reddit US subs

### Blocked / scaffolds

- SmartCanucks contests category: Cloudflare — needs partnership
- Gleam / ViralSweep / Woobox directories & retailer hubs: no public listing API — scaffold only

Refresh: client mount + 30 min while open; Edge Function / GitHub Action / pg_cron for Hive Mind with app closed.
