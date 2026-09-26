import { useCallback, useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { useAuth } from '../contexts/AuthContext'
import {
  CHECKIN_LADDER,
  PRO_PASS_COST,
  SMART_FILL_PACK_COST,
  REWARDED_VIDEO_POINTS,
  buySmartFills,
  checkinState,
  claimDailyCheckin,
  fetchWalls,
  formatPassRemaining,
  proPassRemainingMs,
  redeemProPass,
  rewardErrorCopy,
  type ProPassDays,
  type SmartFillPack,
  type Wall,
} from '../lib/earn/rewards'

/**
 * Subscription-free earning: daily check-in, survey / offer walls, and a points shop
 * (Pro Pass, Smart-Fill packs). Signed-in cloud accounts only — balances are server-owned.
 */
export default function EarnHub({ onWallsLoaded }: { onWallsLoaded?: (count: number) => void }) {
  const { profile, refreshProfile } = useAuth()
  const [walls, setWalls] = useState<Wall[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchWalls().then((w) => {
      if (cancelled) return
      setWalls(w)
      onWallsLoaded?.(w.length)
    })
    return () => {
      cancelled = true
    }
  }, [onWallsLoaded])

  const run = useCallback(
    async (key: string, action: () => Promise<{ ok: boolean; reason?: string }>, success: string) => {
      setBusy(key)
      setMessage(null)
      const res = await action()
      await refreshProfile()
      setBusy(null)
      if (res.ok) {
        setMessage({ tone: 'ok', text: success })
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } })
      } else {
        setMessage({ tone: 'err', text: rewardErrorCopy(res.reason) })
      }
    },
    [refreshProfile]
  )

  const checkin = checkinState(profile)
  const passMs = proPassRemainingMs(profile?.pro_pass_until)
  const balance = profile?.points_balance ?? 0

  return (
    <div className="space-y-5">
      {/* Daily check-in */}
      <section className="rounded-xl border border-win/30 bg-gradient-to-br from-win/10 to-transparent p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-50">Daily check-in</h2>
            <p className="text-xs text-gray-400">Come back every day — day 7 pays {CHECKIN_LADDER[6]} pts.</p>
          </div>
          <button
            type="button"
            disabled={checkin.claimedToday || busy === 'checkin'}
            onClick={() =>
              void run('checkin', claimDailyCheckin, `+${checkin.nextPoints} pts — see you tomorrow!`)
            }
            className="shrink-0 px-4 py-2 rounded-lg bg-win text-on-win font-bold text-sm disabled:opacity-50"
          >
            {checkin.claimedToday ? 'Claimed ✓' : busy === 'checkin' ? '…' : `Claim +${checkin.nextPoints}`}
          </button>
        </div>
        <ol className="mt-3 grid grid-cols-7 gap-1" aria-label="Check-in ladder">
          {CHECKIN_LADDER.map((pts, i) => {
            const day = i + 1
            // Days already banked in the current 7-day cycle.
            const doneUpTo = checkin.claimedToday && checkin.nextDay === 1 ? 7 : checkin.nextDay - 1
            const done = day <= doneUpTo
            const current = !checkin.claimedToday && day === checkin.nextDay
            return (
              <li
                key={day}
                className={`rounded-md py-1.5 text-center text-[11px] border ${
                  current
                    ? 'border-win bg-win/20 text-gray-50 font-semibold'
                    : done
                      ? 'border-win/30 bg-win/10 text-win'
                      : 'border-gray-700 text-gray-500'
                }`}
              >
                <span className="block">D{day}</span>
                <span className="block">{pts}</span>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Walls */}
      <section>
        <h2 className="text-base font-bold text-gray-50">Earn while you do the dishes</h2>
        <p className="text-xs text-gray-400 mb-3">
          Points land automatically when the provider confirms — usually within minutes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(walls ?? []).map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => window.open(w.url, '_blank', 'noopener,noreferrer')}
              className="rounded-xl glass border border-amber-500/30 p-4 text-left hover:border-amber-500/60"
            >
              <span className="block font-semibold text-gray-50">{w.title}</span>
              <span className="block text-xs text-gray-400 mt-0.5">{w.subtitle}</span>
              <span className="block text-amber-400 text-sm font-bold mt-2">Open →</span>
            </button>
          ))}
          <div className="rounded-xl border border-gray-700 p-4 text-left">
            <span className="block font-semibold text-gray-50">Watch short videos</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              +{REWARDED_VIDEO_POINTS} pts each in the LoonieWins mobile app
            </span>
          </div>
        </div>
        {walls !== null && walls.length === 0 && (
          <p className="text-xs text-gray-500 mt-2">Survey walls are being set up — check back soon.</p>
        )}
      </section>

      {/* Shop */}
      <section>
        <h2 className="text-base font-bold text-gray-50">Spend points</h2>
        <p className="text-xs text-gray-400 mb-3">
          No subscription needed. You have <span className="text-amber-400 font-semibold">{balance.toLocaleString()} pts</span>
          {passMs > 0 && (
            <>
              {' '}
              · <span className="text-win font-semibold">Pro Pass {formatPassRemaining(passMs)}</span>
            </>
          )}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(PRO_PASS_COST) as unknown as ProPassDays[]).map((days) => {
            const d = Number(days) as ProPassDays
            const cost = PRO_PASS_COST[d]
            return (
              <button
                key={`pass-${d}`}
                type="button"
                disabled={busy !== null || balance < cost}
                onClick={() => void run(`pass-${d}`, () => redeemProPass(d), `Pro unlocked for ${d === 1 ? '24 hours' : '7 days'}!`)}
                className="rounded-xl border border-win/40 bg-win/10 p-3 text-left disabled:opacity-50"
              >
                <span className="block text-sm font-bold text-gray-50">{d === 1 ? '24h Pro Pass' : '7-day Pro Pass'}</span>
                <span className="block text-[11px] text-gray-400">Unlimited entries + Smart-Fills</span>
                <span className="block text-amber-400 font-bold text-sm mt-1">{cost.toLocaleString()} pts</span>
              </button>
            )
          })}
          {(Object.keys(SMART_FILL_PACK_COST) as unknown as SmartFillPack[]).map((pack) => {
            const n = Number(pack) as SmartFillPack
            const cost = SMART_FILL_PACK_COST[n]
            return (
              <button
                key={`fills-${n}`}
                type="button"
                disabled={busy !== null || balance < cost}
                onClick={() => void run(`fills-${n}`, () => buySmartFills(n), `+${n} Smart-Fills added`)}
                className="rounded-xl border border-gray-600 p-3 text-left disabled:opacity-50"
              >
                <span className="block text-sm font-bold text-gray-50">{n} Smart-Fills</span>
                <span className="block text-[11px] text-gray-400">Autofill contest forms</span>
                <span className="block text-amber-400 font-bold text-sm mt-1">{cost.toLocaleString()} pts</span>
              </button>
            )
          })}
        </div>
      </section>

      {message && (
        <p role="status" className={`text-sm text-center ${message.tone === 'ok' ? 'text-win' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
