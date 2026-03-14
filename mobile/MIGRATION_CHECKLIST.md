# LoonieWins Web → Mobile Migration Checklist

## 1. Hooks (`mobile/src/hooks/`)

| Hook | Status | Notes |
|------|--------|-------|
| `useContestVault.ts` | ✅ Ported | AsyncStorage replaces localStorage; all exports async |
| `useContestPipeline.ts` | ✅ Ported | Awaits async vault; concurrency 3 |
| `useUserLimits.ts` | ✅ Ported | Identical logic |

## 2. Utils (`mobile/src/lib/utils/`)

| Util | Status | Notes |
|------|--------|-------|
| `sanitizeContestUrl.ts` | ✅ Ported | Identical |
| `expiryDate.ts` | ✅ Ported | Identical |
| `reportedUrls.ts` | ✅ Ported | Async (AsyncStorage) |
| `storage.ts` | ✅ New | AsyncStorage bridge for RN |

## 3. Types (`mobile/src/types/`)

| File | Status |
|------|--------|
| `profile.ts` | ✅ Ported |

## 4. Contexts (`mobile/src/contexts/`)

| Context | Status | Notes |
|---------|--------|-------|
| `UserEarnContext.tsx` | ✅ Ported | Uses AsyncStorage; hydrate on mount |

## 5. Lib Data (`mobile/src/lib/data/`)

| File | Status | Notes |
|------|--------|-------|
| `sources.ts` | ✅ Ported | All whale feeds |
| `tagger.ts` | ✅ Ported | Identical |
| `valuationDictionary.ts` | ✅ Ported | Identical |
| `normalizer.ts` | ✅ Ported | Identical |
| `seasonalPromos.ts` | ✅ Ported | Identical |
| `linkResolver.ts` | ✅ Ported | Uses @xmldom/xmldom for DOMParser |
| `engine.ts` | ✅ Ported | Uses EXPO_PUBLIC_RSS2JSON_API_KEY |

## 6. Lib Root (`mobile/src/lib/`)

| File | Status |
|------|--------|
| `rssFetcher.ts` | ✅ Ported |
| `supabase.ts` | ✅ Exists (AsyncStorage auth) |

## 7. Theme (NativeWind + Tailwind)

| Item | Status |
|------|--------|
| `tailwind.config.js` | ✅ Created |
| `global.css` | ✅ Created |
| `babel.config.js` | ✅ Created |
| `metro.config.js` | ✅ Created |
| Design tokens | ✅ win, earn, surface, glass, fontFamily |

**Colors:** `win: #39FF14`, `earn: #FFD700`, `surface: #1F2937`, `surface.light: #374151`, `glass: rgba(31,41,55,0.8)`

## 8. Dependencies Added

- `@xmldom/xmldom` (DOMParser for engine + linkResolver)
- `nativewind`
- `tailwindcss`
- `react-native-reanimated`
- `react-native-safe-area-context`

## 9. Commands to Finish Setup

```bash
cd mobile
npm install
npx expo start --clear
```

## 10. Not Ported (Web-Only / No Equivalent)

- `src/constants/` — none in web
- `src/lib/autofill/assassin.ts` — web autofill logic
- Pages, components, Layout, ContestCard, etc. — UI layer (separate task)
