# LoonieWins Mobile Config

Copy these files into `mobile/` after running `npx create-expo-app mobile --template blank-typescript`.

## Files to copy

- `.env` → `mobile/.env`
- `app.json` → `mobile/app.json` (replace the default)
- `eas.json` → `mobile/eas.json`
- `src/lib/supabase.ts` → `mobile/src/lib/supabase.ts`

## Store readiness (Apple + Google Play)

Canonical legal HTML lives in the repo root at `public/legal/` (privacy, terms, support, delete-account). Host that folder on HTTPS, then:

1. Replace `REPLACE_WITH_*` in `mobile/app.json` → `extra.legal` and in `mobile/src/lib/legal/constants.ts`.
2. Paste the same privacy / support / delete-account URLs into App Store Connect and Play Console.
3. Run `supabase/account_deletion.sql` so in-app Delete Account can remove auth users.
4. See project docs `app-store-readiness.md` for the dual-store checklist.

## Post-copy: install packages

```bash
cd mobile
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

## EAS Update (post `eas init`)

After running `eas init`, add your project ID to `app.json` under `expo.extra.eas.projectId` so OTA updates work. EAS init will prompt to link the project.
