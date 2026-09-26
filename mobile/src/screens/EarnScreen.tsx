import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import {
  CHECKIN_LADDER,
  PRO_PASS_COST,
  REWARDED_VIDEO_DAILY_CAP,
  REWARDED_VIDEO_POINTS,
  SMART_FILL_PACK_COST,
  buySmartFills,
  checkinState,
  claimDailyCheckin,
  fetchWalls,
  formatPassRemaining,
  proPassRemainingMs,
  redeemProPass,
  rewardErrorCopy,
  rewardedVideosToday,
  type ProPassDays,
  type SmartFillPack,
  type Wall,
} from '../lib/earn/rewards'
import { rewardedVideosAvailable, showRewardedVideo } from '../lib/ads/rewarded'

/**
 * Subscription-free earning on mobile: daily check-in, rewarded videos, survey / offer walls,
 * and a points shop. Every credit is server-side (RPCs, AdMob SSV, provider postbacks).
 */
export default function EarnScreen({ onClose }: { onClose: () => void }) {
  const { user, profile, refreshProfile } = useAuth()
  const { accentColor } = useTheme()
  const [walls, setWalls] = useState<Wall[] | null>(null)
  const [videosToday, setVideosToday] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const refreshVideos = useCallback(async () => {
    if (user?.id) setVideosToday(await rewardedVideosToday(user.id))
  }, [user?.id])

  useEffect(() => {
    void fetchWalls().then(setWalls)
    void refreshVideos()
  }, [refreshVideos])

  const run = useCallback(
    async (key: string, action: () => Promise<{ ok: boolean; reason?: string }>, success: string) => {
      setBusy(key)
      setMessage(null)
      const res = await action()
      await refreshProfile()
      setBusy(null)
      setMessage(res.ok ? { ok: true, text: success } : { ok: false, text: rewardErrorCopy(res.reason) })
    },
    [refreshProfile]
  )

  const watchVideo = useCallback(async () => {
    if (!user?.id) return
    setBusy('video')
    setMessage(null)
    const outcome = await showRewardedVideo(user.id)
    if (outcome === 'earned') {
      setMessage({ ok: true, text: `+${REWARDED_VIDEO_POINTS} pts on the way…` })
      // Google's signed callback usually lands within a few seconds.
      for (const wait of [1500, 3000, 5000]) {
        await new Promise((r) => setTimeout(r, wait))
        await refreshProfile()
      }
      await refreshVideos()
    } else if (outcome === 'closed') {
      setMessage({ ok: false, text: 'Watch to the end to earn points.' })
    } else if (outcome === 'unavailable') {
      setMessage({ ok: false, text: 'Videos are available in the full LoonieWins app build.' })
    } else {
      setMessage({ ok: false, text: 'No video available right now — try again in a minute.' })
    }
    setBusy(null)
  }, [user?.id, refreshProfile, refreshVideos])

  const checkin = checkinState(profile)
  const balance = profile?.points_balance ?? 0
  const passMs = proPassRemainingMs(profile?.pro_pass_until)
  const videosLeft = Math.max(0, REWARDED_VIDEO_DAILY_CAP - videosToday)
  const doneUpTo = checkin.claimedToday && checkin.nextDay === 1 ? 7 : checkin.nextDay - 1

  return (
    <View className="flex-1 bg-gray-900">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3">
        <Text className="text-2xl font-extrabold text-gray-50">Earn points</Text>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close earn">
          <Text style={{ color: accentColor, fontWeight: '600' }}>Done</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 16 }}>
        <View className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Text className="text-gray-300 text-sm">Your balance</Text>
          <Text className="text-amber-400 text-3xl font-extrabold">{balance.toLocaleString()} pts</Text>
          {passMs > 0 && (
            <Text className="text-win text-sm font-semibold mt-1">Pro Pass · {formatPassRemaining(passMs)}</Text>
          )}
        </View>

        {/* Daily check-in */}
        <View className="rounded-2xl border border-win/30 bg-win/10 p-4">
          <View className="flex-row items-center justify-between">
            <View style={{ flex: 1 }}>
              <Text className="text-gray-50 font-bold text-base">Daily check-in</Text>
              <Text className="text-gray-400 text-xs">Day 7 pays {CHECKIN_LADDER[6]} pts</Text>
            </View>
            <TouchableOpacity
              disabled={checkin.claimedToday || busy !== null}
              onPress={() => void run('checkin', claimDailyCheckin, `+${checkin.nextPoints} pts — see you tomorrow!`)}
              className={`rounded-lg px-4 py-2 bg-win ${checkin.claimedToday ? 'opacity-50' : ''}`}
            >
              <Text className="text-on-win font-bold">
                {checkin.claimedToday ? 'Claimed ✓' : `Claim +${checkin.nextPoints}`}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-1 mt-3">
            {CHECKIN_LADDER.map((pts, i) => {
              const day = i + 1
              const current = !checkin.claimedToday && day === checkin.nextDay
              return (
                <View
                  key={day}
                  className={`flex-1 rounded-md py-1 items-center border ${
                    current ? 'border-win bg-win/20' : day <= doneUpTo ? 'border-win/30 bg-win/10' : 'border-gray-700'
                  }`}
                >
                  <Text className="text-[10px] text-gray-400">D{day}</Text>
                  <Text className={`text-xs ${day <= doneUpTo || current ? 'text-win' : 'text-gray-500'}`}>{pts}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Rewarded video */}
        <TouchableOpacity
          disabled={busy !== null || videosLeft === 0}
          onPress={() => void watchVideo()}
          className={`rounded-2xl border border-amber-500/40 p-4 flex-row items-center justify-between ${
            videosLeft === 0 ? 'opacity-50' : ''
          }`}
        >
          <View style={{ flex: 1 }}>
            <Text className="text-gray-50 font-bold text-base">📺 Watch a video</Text>
            <Text className="text-gray-400 text-xs">
              {rewardedVideosAvailable()
                ? `${videosToday} / ${REWARDED_VIDEO_DAILY_CAP} today · ~30 sec each`
                : 'Available in the full app build'}
            </Text>
          </View>
          {busy === 'video' ? (
            <ActivityIndicator color={accentColor} />
          ) : (
            <Text className="text-amber-400 font-extrabold text-lg">+{REWARDED_VIDEO_POINTS}</Text>
          )}
        </TouchableOpacity>

        {/* Walls */}
        <View>
          <Text className="text-gray-50 font-bold text-base mb-1">Surveys & offers</Text>
          <Text className="text-gray-400 text-xs mb-2">Points land when the provider confirms — usually minutes.</Text>
          {walls === null ? (
            <ActivityIndicator color={accentColor} />
          ) : walls.length === 0 ? (
            <Text className="text-gray-500 text-xs">Survey walls are being set up — check back soon.</Text>
          ) : (
            walls.map((w) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => void Linking.openURL(w.url)}
                className="rounded-xl border border-gray-600/60 bg-surface p-4 mb-2 flex-row items-center justify-between"
              >
                <View style={{ flex: 1 }}>
                  <Text className="text-gray-50 font-semibold">{w.title}</Text>
                  <Text className="text-gray-400 text-xs">{w.subtitle}</Text>
                </View>
                <Text className="text-amber-400 font-bold">Open →</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Shop */}
        <View>
          <Text className="text-gray-50 font-bold text-base mb-2">Spend points — no subscription</Text>
          <View className="flex-row flex-wrap gap-2">
            {([1, 7] as ProPassDays[]).map((d) => (
              <TouchableOpacity
                key={`pass-${d}`}
                disabled={busy !== null || balance < PRO_PASS_COST[d]}
                onPress={() => void run(`pass-${d}`, () => redeemProPass(d), `Pro unlocked for ${d === 1 ? '24 hours' : '7 days'}!`)}
                className={`rounded-xl border border-win/40 bg-win/10 p-3 ${balance < PRO_PASS_COST[d] ? 'opacity-50' : ''}`}
                style={{ width: '48%' }}
              >
                <Text className="text-gray-50 font-bold">{d === 1 ? '24h Pro Pass' : '7-day Pro Pass'}</Text>
                <Text className="text-gray-400 text-[11px]">Unlimited entries + Smart-Fills</Text>
                <Text className="text-amber-400 font-bold mt-1">{PRO_PASS_COST[d].toLocaleString()} pts</Text>
              </TouchableOpacity>
            ))}
            {([5, 15] as SmartFillPack[]).map((n) => (
              <TouchableOpacity
                key={`fills-${n}`}
                disabled={busy !== null || balance < SMART_FILL_PACK_COST[n]}
                onPress={() => void run(`fills-${n}`, () => buySmartFills(n), `+${n} Smart-Fills added`)}
                className={`rounded-xl border border-gray-600 p-3 ${balance < SMART_FILL_PACK_COST[n] ? 'opacity-50' : ''}`}
                style={{ width: '48%' }}
              >
                <Text className="text-gray-50 font-bold">{n} Smart-Fills</Text>
                <Text className="text-gray-400 text-[11px]">Autofill contest forms</Text>
                <Text className="text-amber-400 font-bold mt-1">{SMART_FILL_PACK_COST[n].toLocaleString()} pts</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {message && (
          <Text className={`text-center text-sm ${message.ok ? 'text-win' : 'text-red-400'}`}>{message.text}</Text>
        )}
      </ScrollView>
    </View>
  )
}
