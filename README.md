# LoonieWins

Canadian contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS (glassmorphism dark theme)
- React Router
- Supabase (client + full bootstrap schema in `supabase/schema.sql`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment (required for Hive Mind / cloud contest sync)**

   Copy `.env.example` to `.env` and set:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Mobile / Expo uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

3. **Run dev server**

   ```bash
   npm run dev
   ```

4. **Database**

   In a fresh Supabase project, paste and run all of `supabase/schema.sql` in the SQL Editor (tables, indexes, RLS, triggers). Contests are filled by the app’s vault sync — no seed SQL required. Do not use the deprecated root `supabase_schema.sql` stub.

## Features

- **Dashboard:** Daily Routine (big cards), sticky search, filters, contest feed (thin cards) from real RSS (Reddit, RedFlagDeals). ENTER opens Smart-Fill overlay.
- **Smart-Fill overlay:** Resolves contest URL, shows auto-fill preview, iframe form, “Auto-Fill Form” button, mark as entered.
- **Referrals:** Community link list, add link, click-for-karma.
- **Earn:** Tasks/surveys (points), Pro Pass (1000 pts), Subscribe ($4.99/mo).
- **Winners:** Grid of recent wins.
- **Profile:** Plan meter (Smart-Fills remaining), Applied Contests, Settings (Auto-Fill Data, Preferences, Export, Delete Account).

## RSS sources

- Reddit: `r/contestsofcanada`
- RedFlagDeals: Contests forum (34)
- CanadianFreeStuff / ContestScoop: add RSS URLs in `src/lib/rssFetcher.ts` when available.
