# LoonieWins — owner setup checklist (plain English)

Do these once. Each step says where to click. Nothing here needs the command line.

## 1. Database (Supabase SQL Editor)
1. Supabase Dashboard → your project → **SQL Editor** → **New query**.
2. Paste all of `supabase/setup/latest_update.sql` → **Run**.
   - If it errors with "does not exist", paste `supabase/setup/full_setup.sql` instead → **Run** (safe even if you ran parts before).

## 2. Same database for web + app
Both apps must use the same Supabase project URL + **anon public** key
(Supabase → Project Settings → API).
- Web: `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Mobile: `mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (and the same two in EAS → Project → Environment variables for store builds)

## 3. Let GitHub deploy the server functions
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → avatar (top-right) → Account → Access Tokens → Generate |
| `SUPABASE_PROJECT_REF` | the part before `.supabase.co` in your project URL |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` (used by the 30-min contest refresh) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (secret — never put it in the app) |

Then GitHub → **Actions → Deploy Supabase functions → Run workflow**.
After that, **Actions → Ingest giveaways** runs every 30 minutes and fills the contest feed
(run it once by hand to fill it right away).

## 4. Money: ad + survey accounts (sign up, then paste keys)
Supabase → **Edge Functions → Secrets** (server keys) and `mobile/.env` / EAS env (app ids).

| Earns from | Sign up | Server secrets (Supabase) | App settings | Callback URL to paste in their dashboard |
|---|---|---|---|---|
| Rewarded videos (mobile) | admob.google.com | — | `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS` | Rewarded ad unit → Server-side verification: `https://<ref>.supabase.co/functions/v1/admob-ssv` |
| Surveys | bitlabs.ai | `BITLABS_TOKEN`, `BITLABS_SECRET` | — | `https://<ref>.supabase.co/functions/v1/offerwall-postback?provider=bitlabs&uid=[%USER:ID%]&tx=[%TX%]&raw=[%RAW%]&type=[%TYPE%]` |
| Surveys | cpx-research.com | `CPX_APP_ID`, `CPX_SECURE_HASH` | — | `https://<ref>.supabase.co/functions/v1/offerwall-postback?provider=cpx&status={status}&trans_id={trans_id}&user_id={user_id}&amount_usd={amount_usd}&offer_id={offer_id}&hash={secure_hash}` |
| Games & app offers | adgem.com | `ADGEM_APP_ID`, `ADGEM_POSTBACK_KEY` | `VITE_ADGEM_APP_ID` | see `supabase/functions/adgem-postback/index.ts` |
| Pro subscriptions | revenuecat.com + App Store / Play | `REVENUECAT_WEBHOOK_AUTH` | `EXPO_PUBLIC_REVENUECAT_*` | `https://<ref>.supabase.co/functions/v1/revenuecat-webhook` |

Optional tuning secrets: `OFFERWALL_POINTS_PER_USD` (default 1000), `ADMOB_POINTS_PER_VIDEO` (20),
`ADMOB_DAILY_CAP` (30), `CRON_SECRET`.

Rewarded videos only work in a real app build (EAS), not in Expo Go.

## 5. Store listing blanks
Replace the `REPLACE_WITH_…` placeholders (operator name, support + privacy email, website)
in `src/lib/legal/constants.ts` and `public/legal/*.html`. With ads on, update the store
privacy answers: the app now uses the advertising ID for rewarded video ads.
