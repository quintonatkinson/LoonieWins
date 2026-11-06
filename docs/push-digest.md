# Push live + weekly digest — Quinton setup

Finish the path from prefs + `send-push-alerts` so **real devices** get FCM/APNs delivery, Pro gets **priority ending-tonight**, and opted-in users get a **weekly digest email**.

Project: Expo `looniewins` (`dadf1677-cf3d-4425-a302-dc8d9378d952`) · Supabase `oftunznsumfidavvbqz`

---

## A. Database (SQL Editor — run once each)

1. [ ] `supabase/migrations/20260920_push_notifications.sql` (if not already)
2. [ ] `supabase/migrations/20260920_weekly_digest_email.sql` ← **new** (`email_digest_log` + `weeklyDigestEmail` seed)
3. [ ] Confirm tables: `push_tokens`, `push_alert_log`, `email_digest_log`

---

## B. Expo push credentials (required for live Android/iOS)

### B1. Firebase (Android / FCM)

1. [ ] Firebase Console → create/select project → add Android app package `com.quinton.looniewins`
2. [ ] Download **`google-services.json`** → copy to `mobile/google-services.json`  
   (gitignored; template: `mobile/google-services.json.example`)  
   `mobile/app.config.js` wires `android.googleServicesFile` **only when the file exists**.
3. [ ] Firebase → Project settings → **Service accounts** → Generate new private key (JSON)
4. [ ] [Expo dashboard](https://expo.dev) → project **looniewins** → **Credentials** → Android → **FCM V1** → upload that service-account JSON

### B2. Apple (iOS / APNs)

1. [ ] Apple Developer → Keys → create **APNs** key (`.p8`), note Key ID + Team ID
2. [ ] Expo → Credentials → iOS → bundle `com.quinton.looniewins` → upload APNs key
3. [ ] Confirm `UIBackgroundModes` includes `remote-notification` (already in `mobile/app.json`)

### B3. Expo access token (recommended)

1. [ ] Expo → Account settings → Access tokens → create token
2. [ ] Set Edge secret:

```bash
npx supabase secrets set EXPO_ACCESS_TOKEN=your_expo_token --project-ref oftunznsumfidavvbqz
```

### B4. Native rebuild

1. [ ] `cd mobile && npx eas build --platform all --profile preview` (or production)  
   Expo Go is **not** enough for production FCM/APNs.
2. [ ] Install build → Sign in → Settings → enable alerts → **Register this device**  
   (App also auto-registers on login + when returning to foreground.)

---

## C. Deploy push Edge Function + schedule

```bash
npx supabase functions deploy send-push-alerts --project-ref oftunznsumfidavvbqz
```

**Schedule** (Dashboard → Edge Functions → `send-push-alerts` → Schedules, or `supabase/cron_push_alerts.sql`):

| When | Body |
|------|------|
| Every 30–60 min | `{"modes":["new_contests","ending_tonight"]}` |
| Optional ~6 PM Toronto | `{"modes":["ending_tonight"]}` |

Manual test:

```bash
curl -sS -X POST \
  'https://oftunznsumfidavvbqz.supabase.co/functions/v1/send-push-alerts' \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"modes":["new_contests","ending_tonight"]}'
```

Expect JSON with `ok: true`, `expo`, and `endingTonight: { pro, free, freeCap }`.

### Pro priority ending-tonight

| Tier | Behavior |
|------|----------|
| **Pro** (`is_premium` / `weekly` / `monthly` / `feature_flags.priority_sources`) | High priority Expo push, Android channel `looniewins-ending-pro`, iOS `timeSensitive`, **no per-run cap** (guaranteed) |
| **Free** | Normal priority, channel `looniewins-alerts`, **max 3** ending alerts per cron run |

Prefs still gate delivery (`enabled` + `endingTonight`).

---

## D. Weekly digest email (Resend)

### D1. Resend account + keys

1. [ ] Sign up at [resend.com](https://resend.com) → verify sending domain (or use `onboarding@resend.dev` for smoke tests to *your* inbox only)
2. [ ] Create API key
3. [ ] Set secrets:

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxxx \
  RESEND_FROM_EMAIL='LoonieWins <digest@your-verified-domain.com>' \
  DIGEST_APP_URL='https://YOUR_HTTPS_ORIGIN' \
  --project-ref oftunznsumfidavvbqz
```

| Secret | Required | Notes |
|--------|----------|-------|
| `RESEND_API_KEY` | **yes** for live send | From Resend dashboard |
| `RESEND_FROM_EMAIL` | recommended | Must be a verified Resend domain/sender |
| `DIGEST_APP_URL` | optional | Link in email footer |
| `DIGEST_DRY_RUN` | optional | `true` = count recipients, no send |

**Supabase Auth email** is for auth (confirm/reset), not marketing digests — use Resend via this Edge Function.

### D2. Deploy + schedule

```bash
npx supabase functions deploy send-weekly-digest --project-ref oftunznsumfidavvbqz
```

Schedule Sundays ~14:00 UTC (see `supabase/cron_weekly_digest.sql`), or Dashboard schedule with body `{}`.

Dry-run test:

```bash
curl -sS -X POST \
  'https://oftunznsumfidavvbqz.supabase.co/functions/v1/send-weekly-digest' \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"dryRun":true}'
```

### D3. User prefs

Profile / Settings → **Weekly digest email** (`settings.notifications.weeklyDigestEmail`, default **off**).  
Email copy: **“N new CA contests + M ending tonight”**.

---

## Preference keys (final)

```json
{
  "enabled": true,
  "newContestsCA": true,
  "newContestsUS": false,
  "endingTonight": true,
  "weeklyDigestEmail": false
}
```

---

## Code map

| Area | Path |
|------|------|
| Push migration | `supabase/migrations/20260920_push_notifications.sql` |
| Digest migration | `supabase/migrations/20260920_weekly_digest_email.sql` |
| Push function | `supabase/functions/send-push-alerts/index.ts` |
| Digest function | `supabase/functions/send-weekly-digest/index.ts` |
| Expo config (FCM file) | `mobile/app.config.js`, `mobile/google-services.json.example` |
| Token register (hardened) | `mobile/src/lib/notifications/registerPush.ts`, `mobile/App.tsx` |
| Prefs UI | `src/components/NotificationPreferences.tsx`, mobile twin |
| Cron templates | `supabase/cron_push_alerts.sql`, `supabase/cron_weekly_digest.sql` |
