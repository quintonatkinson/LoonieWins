# LoonieWins Autofill (Chrome / Edge MV3)

Browser extension that fills giveaway / contest forms using your LoonieWins profile data.

## Install (unpacked)

1. Build or clone this repo; you only need the `extension/` folder.
2. Chrome: open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/`.
3. Edge: open `edge://extensions` → same steps.

Pin the toolbar icon for quick access.

## Use

1. Save autofill fields in the popup (or sync — see below).
2. Open a giveaway entry form.
3. Click **Fill this page**, press **Alt+Shift+L**, or right-click → **LoonieWins: Fill this form**.
4. Skill-testing / math fields are highlighted in pink (not solved for you).

## Sync

| Source | How |
|--------|-----|
| **localStorage** | With the LoonieWins web app open (localhost by default), click **Sync from LoonieWins tab**. Reads `looniewins_autofill`. A content bridge also pushes that key when present. |
| **Supabase session** | Options → set project URL + **anon** key. Sign in on the LoonieWins tab, then sync. The extension copies `sb-*-auth-token` and GETs `profiles.auto_fill_data` under RLS. |
| **Manual** | Edit fields in the popup and Save. |

Profile shape matches `AutoFillData` in `src/types/profile.ts` (`name`, optional `firstName`/`lastName`, `email`, `address`, `phone`, `city`, `province`, `postalCode`).

> On `main`, Profile may still be mocked and not write `looniewins_autofill`. Until that lands, use the popup editor, or sync from a branch that persists autofill (e.g. smoke-test stabilize).

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
  icons/
```

## Hosted app origins

Default content-script matches are `localhost` / `127.0.0.1`. For a production LoonieWins URL, add it to `content_scripts.matches` (and reload the extension) or grant site access so Sync / the bridge can run.
