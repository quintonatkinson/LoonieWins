/**
 * Rewarded video (AdMob). Points are credited server-side by the admob-ssv Edge Function
 * after Google's signed callback — this module only shows the ad and tags it with the user id.
 *
 * Ad unit ids: EXPO_PUBLIC_ADMOB_REWARDED_ANDROID / EXPO_PUBLIC_ADMOB_REWARDED_IOS.
 * Dev builds fall back to Google's test unit (test ads never pay out).
 * Expo Go has no AdMob native module → reports 'unavailable' instead of crashing.
 */
import { Platform } from 'react-native'

export type RewardedOutcome = 'earned' | 'closed' | 'unavailable' | 'error'

type AdsModule = typeof import('react-native-google-mobile-ads')

let adsModule: AdsModule | null | undefined
function loadAds(): AdsModule | null {
  if (adsModule !== undefined) return adsModule
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module
    adsModule = require('react-native-google-mobile-ads') as AdsModule
  } catch {
    adsModule = null
  }
  return adsModule
}

let initialized = false

function unitId(ads: AdsModule): string | null {
  const configured =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS
      : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID
  if (configured) return configured
  return __DEV__ ? ads.TestIds.REWARDED : null
}

export function rewardedVideosAvailable(): boolean {
  const ads = loadAds()
  return Boolean(ads && unitId(ads))
}

export async function showRewardedVideo(userId: string): Promise<RewardedOutcome> {
  const ads = loadAds()
  if (!ads) return 'unavailable'
  const id = unitId(ads)
  if (!id) return 'unavailable'
  try {
    if (!initialized) {
      await ads.default().initialize()
      initialized = true
    }
  } catch {
    return 'error'
  }

  return new Promise<RewardedOutcome>((resolve) => {
    let earned = false
    let settled = false
    // Only time out while loading — never while the user is watching.
    const loadTimer = setTimeout(() => done('error'), 20_000)
    const done = (outcome: RewardedOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(loadTimer)
      unsubs.forEach((u) => u())
      resolve(outcome)
    }
    const ad = ads.RewardedAd.createForAdRequest(id, {
      serverSideVerificationOptions: { userId, customData: 'looniewins' },
    })
    const unsubs = [
      ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
        clearTimeout(loadTimer)
        ad.show().catch(() => done('error'))
      }),
      ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true
      }),
      ad.addAdEventListener(ads.AdEventType.CLOSED, () => done(earned ? 'earned' : 'closed')),
      ad.addAdEventListener(ads.AdEventType.ERROR, () => done('error')),
    ]
    ad.load()
  })
}
