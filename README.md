# LoonieWins

Canadian + American contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript (web Vite + Expo mobile)
- Tailwind CSS (glassmorphism dark theme)
- React Router (web)
- Supabase Auth + Postgres (multi-schema: `public`, `tracking`, `giveaways`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Supabase (required for auth + account data)**

   - Create a project, then run **`supabase/schema.sql`** in the SQL Editor (full bootstrap).
   - Expose schemas `public`, `tracking`, `giveaways` under Settings → API.
   - Enable Email auth; for local testing turn **Confirm email** off.
   - Add redirect URLs (`http://localhost:5173`, production origin).

3. **Environment**

   Copy `.env.example` → `.env` and set:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Optional: `VITE_RSS2JSON_API_KEY` (larger RSS pages)

   Mobile: `EXPO_PUBLIC_SUPABASE_*` in `mobile/.env`.

4. **Run**

   ```bash
   npm run dev
   ```

   With Supabase configured, launch shows **Create account / Log in**. Without keys, the app boots in guest mode with local entry tracking.

5. **Scheduled ingest (optional but recommended)**

   Deploy the Edge Function and cron:

   ```bash
   supabase functions deploy ingest-giveaways
   ```

   Then schedule every 30 minutes (`supabase/cron_ingest.sql` or GitHub Action `.github/workflows/ingest-giveaways.yml`).

## Features

- **Auth:** Sign-up, login, session restore, logout (web + Expo). Guest mode when env keys are missing.
- **Dashboard:** Contest feed, geo filter (CA / US / ANY), Entered badges, Daily Routine from tracked entries.
- **Smart-Fill / entry:** Hardened autofill injection, expanded copy chips, Open & Enter with mark-entered / submitted prompts.
- **Tracking:** Per-account `tracking.contest_entries` (entered / submitted / won / lost / expired) with local fallback.
- **Profile:** Plan, applied contests with status actions, autofill, export, delete account.
- **Referrals / Winners / Earn:** Backed by `giveaways.*` and `tracking.transactions`.
- **Legal / store:** `/privacy`, `/terms`, `/support`, `/delete-account` + `public/legal/*.html`.
- **Account deletion:** `public.delete_own_account()` in bootstrap (also `supabase/account_deletion.sql`).

## Database

Canonical bootstrap: `supabase/schema.sql` (TEXT-id Hive Mind `public.contests` + account/tracking/giveaways tables + RLS + delete RPC).

## RSS / giveaway sources

Canonical list: `src/lib/data/sources.ts` (mirrored in `mobile/`).

Add a feed by appending to `MASTER_SOURCES` with `country: 'CA' | 'US' | 'BOTH'`, `enabled: true`, and optional `includeKeywords` for mixed blogs.

### Active pools (high level)

- **Canada:** RedFlagDeals Contests, Contest Canada (.net), Canadian Free Stuff (contests + daily), ContestScoop, and additional CA feeds.
- **United States:** Sweeties Sweeps, Sweepstakes Bible (+ daily / instant-win), FreebieShark, Hip2Save sweeps, Online Sweepstakes, Contest Bee, Sweepstakes Lovers / Mag, and additional US feeds.

Refresh: Dashboard mount + every 30 minutes while open; optional Edge Function / GitHub Action for continuous cloud refresh.
