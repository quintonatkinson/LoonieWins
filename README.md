# LoonieWins

Canadian + American contest aggregator & offerwall — Win More, Work Less.

## Stack

- React 18 + TypeScript + Vite + Tailwind
- Supabase (Hive Mind `contests` + auth schemas)
- Edge Function `ingest-giveaways` for server-side refresh

## Setup

1. `npm install`
2. Copy `.env.example` → `.env`:
   - `VITE_SUPABASE_URL=https://oftunznsumfidavvbqz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=…`
   - Optional: `VITE_RSS2JSON_API_KEY` for fatter RSS pages (50–100 vs ~10 free)
3. `npm run dev`
4. Run Hive Mind / bootstrap SQL as needed (`supabase_schema.sql`, `supabase/schema.sql`)
5. **Server ingest (recommended):** follow [`docs/ingest-deploy.md`](./docs/ingest-deploy.md)

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
