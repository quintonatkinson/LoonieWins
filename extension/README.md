# LoonieWins Smart-Fill (Chrome / Edge MV3)

Browser extension that **best-effort** fills matching giveaway / contest fields from your LoonieWins profile. It does **not** submit forms, solve skill-tests, or guarantee every field. Chrome / Edge only (not Firefox).

## Install (unpacked)

In-app Smart-Fill usually **cannot** inject into sponsor iframes. This extension fills matching fields on the **real** tab after **Open & Enter**. You still review and submit.

1. Clone the repo (or copy the `extension/` folder).
2. Chrome: open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → choose the folder that contains `manifest.json` (repo path `…/LoonieWins/extension`).
3. Edge: open `edge://extensions` → same steps (enable Developer mode first).
4. Pin the LoonieWins icon. Optional: open **Options** → paste Supabase project URL + **anon** key only.
5. Smoke-test: open `extension/demo/form.html` (file URL is fine) → save a profile in the popup → click **Try fill this page**. Expect fields filled + pink skill-test highlight.
6. Real use: save Profile autofill in the web app (`npm run dev`, usually `http://localhost:5173`) → **focus that LoonieWins tab** → **Sync from LoonieWins tab** → open the contest form → **Try fill this page** (or Alt+Shift+L / right-click). Review every field before submit.

If Alt+Shift+L does not bind, set it under `chrome://extensions/shortcuts`.

First fill on an HTTPS contest host may prompt for **site access** (`optional_host_permissions`) — allow the contest origin when Chrome asks.

## Use

1. Save fields in the popup (or sync — see below).
2. Open a giveaway entry form (top-level page, not a blocked iframe preview).
3. Click **Try fill this page**, press **Alt+Shift+L**, or right-click → **LoonieWins: Try fill this form**.
4. Skill-testing / math fields are highlighted in pink (not solved). Zero matches show a warning — retry after the form finishes loading, or use Open & Enter copy chips.

## Sync

| Source | How |
|--------|-----|
| **localStorage** | Keep the LoonieWins web app tab **focused**, then click **Sync from LoonieWins tab**. Reads `looniewins_autofill`. A content bridge also pushes that key on localhost. |
| **Supabase session** | Options → set project URL + **anon** key. Sign in on the LoonieWins tab, focus it, then sync / **Pull from Supabase**. The extension copies `sb-*-auth-token` and GETs `profiles.auto_fill_data` under RLS. |
| **Manual** | Edit fields in the popup and Save. |

Profile shape matches `AutoFillData` in `src/types/profile.ts` (`name`, optional `firstName`/`lastName`, `email`, `address`, `phone`, `city`, `province`, `postalCode`). The web Profile screen writes `looniewins_autofill` when you save autofill.

## Security

- **Do not** paste a `service_role` key. Options + save path reject JWTs with `role: service_role` and strings containing `service_role`.
- Only anon key + optional user access/refresh tokens live in `chrome.storage.local`.
- Password inputs are skipped.
- Broad site access is optional; fill uses `activeTab` + `scripting` when you invoke it.

## Layout

```
extension/
  manifest.json
  background.js
  lib/           profile, fill, storage, sync, security
  content/bridge.js
  popup/
  options/
  demo/form.html
  icons/
```

## Hosted app origins

Default content-script matches are `localhost` / `127.0.0.1`. For a production LoonieWins URL: add it to `content_scripts.matches`, reload the extension, and grant site access so Sync / the bridge can run. Contest fill on arbitrary HTTPS hosts uses optional host permissions when you click Fill.
