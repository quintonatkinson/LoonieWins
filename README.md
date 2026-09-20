# LoonieWins

Canadian contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS (glassmorphism dark theme)
- React Router
- Supabase (client + schema in `supabase/schema.sql`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment (optional for Supabase)**

   Copy `.env.example` to `.env` and set:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Run dev server**

   ```bash
   npm run dev
   ```

4. **Database**

   Run `supabase/schema.sql` in your Supabase project SQL editor to create tables and RLS.

## Features

- **Dashboard:** Daily Routine (big cards), sticky search, filters, contest feed (thin cards) from real RSS (Reddit, RedFlagDeals). ENTER opens Smart-Fill overlay.
- **Smart-Fill overlay:** Resolves contest URL, shows auto-fill preview, iframe form, “Auto-Fill Form” button, mark as entered.
- **Referrals:** Community link list, add link, click-for-karma.
- **Earn:** Tasks/surveys (points), Pro Pass (1000 pts), Subscribe ($4.99/mo).
- **Winners:** Grid of recent wins.
- **Profile:** Plan meter (Smart-Fills remaining), Applied Contests, Settings (Auto-Fill Data, Preferences, Export, Delete Account).

## Browser extension

Chrome/Edge Manifest V3 autofill for giveaway forms lives in [`extension/`](./extension/). Load unpacked from that folder; see [`extension/README.md`](./extension/README.md) for install, sync (`looniewins_autofill` / Supabase anon), and security notes.

## RSS sources

- Reddit: `r/contestsofcanada`
- RedFlagDeals: Contests forum (34)
- CanadianFreeStuff / ContestScoop: add RSS URLs in `src/lib/rssFetcher.ts` when available.
