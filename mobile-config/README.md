# LoonieWins Mobile Config

Copy these files into `mobile/` after running `npx create-expo-app mobile --template blank-typescript`.

## Files to copy

- `.env` → `mobile/.env`
- `app.json` → `mobile/app.json` (replace the default)
- `eas.json` → `mobile/eas.json`
- `src/lib/supabase.ts` → `mobile/src/lib/supabase.ts`

## Post-copy: install packages

```bash
cd mobile
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

## EAS Update (post `eas init`)

After running `eas init`, add your project ID to `app.json` under `expo.extra.eas.projectId` so OTA updates work. EAS init will prompt to link the project.
