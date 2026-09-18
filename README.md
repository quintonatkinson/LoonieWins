# LoonieWins

Canadian contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript (web Vite + Expo mobile)
- Tailwind CSS
- React Router (web)
- Supabase Auth + Postgres (multi-schema)

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

   Mobile: `EXPO_PUBLIC_SUPABASE_*` in `mobile/.env`.

4. **Run**

   ```bash
   npm run dev
   ```

   App launch shows **Create account / Log in**. Session persists across reloads.

## Features

- **Auth:** Sign-up, login, session restore, logout (web + Expo).
- **Dashboard:** Contest feed + per-account entered tracking (`tracking.contest_entries`).
- **Profile:** Plan, applied contests, autofill (saved on `profiles`), export, delete account.
- **Referrals / Winners / Earn:** Backed by `giveaways.*` and `tracking.transactions` (task board still simulates surveys but credits the account ledger).
- **Legal / store:** `/privacy`, `/terms`, `/support`, `/delete-account` + `public/legal/*.html`.
- **Account deletion:** `public.delete_own_account()` included in bootstrap (also `supabase/account_deletion.sql`).

## Database

Canonical bootstrap: `supabase/schema.sql` (TEXT-id Hive Mind `public.contests` + account/tracking/giveaways tables + RLS + delete RPC).
