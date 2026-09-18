# LoonieWins

Canadian + American contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS (glassmorphism dark theme)
- React Router
- Supabase (client + schema in `supabase/schema.sql`; Hive Mind contests in `supabase_schema.sql`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment (optional for Supabase)**

   Copy `.env.example` to `.env` and set:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Optional: `VITE_RSS2JSON_API_KEY` (larger RSS pages)

3. **Run dev server**

   ```bash
   npm run dev
   ```

4. **Database**

   Run `supabase_schema.sql` (Hive Mind contests) and/or `supabase/schema.sql` in your Supabase SQL editor.

5. **Scheduled ingest (optional but recommended)**

   Deploy the Edge Function and cron (see docs):

   ```bash
   supabase functions deploy ingest-giveaways
   ```

   Then schedule every 30 minutes (`supabase/cron_ingest.sql` or GitHub Action `.github/workflows/ingest-giveaways.yml`).

## Features

- **Dashboard:** Daily Routine, geo filter (CA / US / ANY), contest feed from multi-source RSS, ENTER opens Smart-Fill overlay.
- **Smart-Fill overlay:** Resolves contest URL, auto-fill preview, iframe form, mark as entered.
- **Referrals / Earn / Winners / Profile:** karma, offerwall, wins grid, plan meter.

## RSS / giveaway sources

Canonical list: `src/lib/data/sources.ts` (mirrored in `mobile/`).

Add a feed by appending to `MASTER_SOURCES` with `country: 'CA' | 'US' | 'BOTH'`, `enabled: true`, and optional `includeKeywords` for mixed blogs.

Full inventory + refresh plan: project docs `giveaway-sources.md` (Agent Store) and README section below.

### Active pools (high level)

- **Canada:** RedFlagDeals Contests, Contest Canada (.net), Canadian Free Stuff (contests + daily), ContestScoop, Reddit CA contest subs.
- **United States:** Sweeties Sweeps, Sweepstakes Bible (+ daily / instant-win), FreebieShark, Hip2Save sweeps, Online Sweepstakes, Contest Bee, Sweepstakes Lovers / Mag, Reddit US giveaway subs.

Refresh: Dashboard mount + every 30 minutes while open; optional Edge Function / GitHub Action for continuous cloud refresh.
