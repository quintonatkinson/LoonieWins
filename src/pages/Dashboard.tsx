import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Contest } from '../lib/rssFetcher'
import { resolveContestUrl } from '../lib/rssFetcher'
import ContestBrowser from '../components/ContestBrowser'
import ContestCard from '../components/ContestCard'
import CountryToggle from '../components/CountryToggle'
import RadarLoader from '../components/RadarLoader'
import SubscriptionModal from '../components/SubscriptionModal'
import { useContestPipeline } from '../hooks/useContestPipeline'
import { useContestEntries } from '../hooks/useContestEntries'
import { useUserLimits } from '../hooks/useUserLimits'
import { useContestSocialProof } from '../hooks/useContestSocialProof'
import { useAuth } from '../contexts/AuthContext'
import { useUserEarn } from '../contexts/UserEarnContext'
import type { AutoFillData } from '../types/profile'
import { loadAutoFillData } from '../lib/utils/autoFillStorage'
import { rpcConsumeSmartFill } from '../lib/monetization/progression'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  compareExpiryAscending,
  daysLeftUntilExpiry,
} from '../lib/utils/expiryDate'
import { isEndingTonight } from '../lib/utils/countdownLabel'
import { isDeadLink } from '../lib/utils/linkHealth'
import {
  TAG_REQ_FILTERS,
  buildEnterNextQueue,
  contestPassesFeedFilters,
  passesBaseFilters,
  sortByBestOdds,
  type FeedFilterOptions,
} from '../lib/feed/filters'
import { saveAgeConfirmed } from '../lib/utils/ageGate'
import {
  loadHomeMode,
  loadAutoAdvance,
  resolveInitialGeo,
  resolveInitialQuebecSafe,
  saveGeoFilter,
  saveHomeMode,
  saveQuebecSafe,
  saveAutoAdvance,
  type HomeMode,
} from '../lib/utils/feedPrefs'
import { searchHiveMind } from '../hooks/useContestVault'
import { shareContest } from '../lib/utils/shareContest'
import type { GeoFilterValue } from '../components/CountryToggle'
import {
  resolveFeedDisplayPrefs,
  saveFeedDisplayPrefsLocal,
  withFeedDisplayPrefs,
  type CardDensity,
  type SortDefault,
} from '../lib/utils/userSettings'

type SortFilter = SortDefault

const NEW_RAIL_MS = 48 * 60 * 60 * 1000
const FREE_RAIL_TEASER = 2
const PRO_RAIL_LIMIT = 12

function compareCreatedDescending(a?: string | null, b?: string | null): number {
  const ta = a ? Date.parse(a) : Number.NaN
  const tb = b ? Date.parse(b) : Number.NaN
  const va = Number.isFinite(ta) ? ta : 0
  const vb = Number.isFinite(tb) ? tb : 0
  return vb - va
}

export default function Dashboard() {
  const pipeline = useContestPipeline()
  const { liveContests, isScanning, isSyncingCloud, isFinished, offlineMode, phaseMessage, refetch } = pipeline
  const { profile, updateProfile } = useAuth()
  const { enteredIds, markEntered: persistEntered } = useContestEntries()
  const { smartFillsBlocked, smartFillsUnlimited, smartFillsRemaining, hasNewEndingRails } =
    useUserLimits()
  const [showSmartFillPaywall, setShowSmartFillPaywall] = useState(false)
  const [showRailsPaywall, setShowRailsPaywall] = useState(false)
  const { upgradeToPro } = useUserEarn()
  const social = useContestSocialProof()

  const displayPrefs = resolveFeedDisplayPrefs({ settings: profile?.settings })
  const [search, setSearch] = useState('')
  const [sortFilter, setSortFilter] = useState<SortFilter | null>(displayPrefs.sortDefault)
  const [hideEntered, setHideEntered] = useState(true)
  const [quebecSafe, setQuebecSafe] = useState(() =>
    resolveInitialQuebecSafe({
      province: profile?.auto_fill_data?.province,
      settingsQuebecSafe: profile?.settings?.quebecSafe,
    })
  )
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set())
  const [geoFilter, setGeoFilter] = useState<GeoFilterValue>(() =>
    resolveInitialGeo({
      province: profile?.auto_fill_data?.province,
      settingsGeo: profile?.settings?.geoFilter,
    })
  )
  const [homeMode, setHomeMode] = useState<HomeMode>(() => loadHomeMode('routine'))
  const [autoAdvance, setAutoAdvance] = useState(() => loadAutoAdvance(true))
  const [hidePurchaseRequired, setHidePurchaseRequired] = useState(
    displayPrefs.hidePurchaseRequired
  )
  const [hideAdult, setHideAdult] = useState(displayPrefs.hideAdult)
  const [adultAlwaysConfirm, setAdultAlwaysConfirm] = useState(displayPrefs.adultAlwaysConfirm)
  const [cardDensity, setCardDensity] = useState<CardDensity>(displayPrefs.cardDensity)
  const [visibleCount, setVisibleCount] = useState(75)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [overlayContest, setOverlayContest] = useState<Contest | null>(null)
  const [localAutoFill, setLocalAutoFill] = useState<AutoFillData>(() => loadAutoFillData())
  const [hiveResults, setHiveResults] = useState<Contest[]>([])
  const [hiveSearching, setHiveSearching] = useState(false)
  const [statusToast, setStatusToast] = useState<string | null>(null)
  const pendingAutoMarkRef = useRef<Contest | null>(null)
  const skipAutoMarkOnceRef = useRef(false)
  const enterNextQueueRef = useRef<Contest[]>([])
  const autoAdvanceRef = useRef(autoAdvance)
  const homeModeRef = useRef(homeMode)

  // Re-resolve geo + Québec-safe once when profile loads if user never saved a preference
  const geoBootstrapped = useRef(false)
  useEffect(() => {
    if (geoBootstrapped.current) return
    if (!profile) return
    geoBootstrapped.current = true
    const fromProfile = resolveInitialGeo({
      province: profile.auto_fill_data?.province,
      settingsGeo: profile.settings?.geoFilter,
    })
    setGeoFilter((prev) => {
      try {
        const saved = localStorage.getItem('looniewins_geo_filter')
        if (saved === 'CA' || saved === 'US' || saved === 'ANY') return prev
      } catch {
        /* ignore */
      }
      return fromProfile
    })
    const qc = resolveInitialQuebecSafe({
      province: profile.auto_fill_data?.province,
      settingsQuebecSafe: profile.settings?.quebecSafe,
    })
    setQuebecSafe((prev) => {
      try {
        const saved = localStorage.getItem('looniewins_quebec_safe')
        if (saved === '1' || saved === '0' || saved === 'true' || saved === 'false') return prev
      } catch {
        /* ignore */
      }
      if (qc && profile.settings?.quebecSafe !== true) {
        saveQuebecSafe(true)
        void updateProfile({
          settings: { ...(profile.settings ?? {}), quebecSafe: true },
        })
      }
      return qc
    })
  }, [profile, updateProfile])

  // Sync display prefs when cloud profile / settings land
  useEffect(() => {
    if (!profile?.settings) return
    const next = resolveFeedDisplayPrefs({ settings: profile.settings })
    setHidePurchaseRequired(next.hidePurchaseRequired)
    setHideAdult(next.hideAdult)
    setAdultAlwaysConfirm(next.adultAlwaysConfirm)
    setCardDensity(next.cardDensity)
    setSortFilter((prev) => prev ?? next.sortDefault)
  }, [profile?.settings])

  useEffect(() => {
    autoAdvanceRef.current = autoAdvance
  }, [autoAdvance])
  useEffect(() => {
    homeModeRef.current = homeMode
  }, [homeMode])

  useEffect(() => {
    const sync = () => setLocalAutoFill(loadAutoFillData())
    window.addEventListener('loonie_autofill_updated', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('loonie_autofill_updated', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (!statusToast) return
    const t = setTimeout(() => setStatusToast(null), 3200)
    return () => clearTimeout(t)
  }, [statusToast])

  const autoFillData: AutoFillData = useMemo(() => {
    const af = profile?.auto_fill_data
    if (af && (af.email || af.name || af.firstName)) {
      return {
        name:
          af.name ||
          [af.firstName, af.lastName].filter(Boolean).join(' ') ||
          profile?.display_name ||
          '',
        firstName: af.firstName,
        lastName: af.lastName,
        email: af.email || profile?.email || '',
        address: af.address || '',
        phone: af.phone,
        city: af.city,
        province: af.province,
        postalCode: af.postalCode,
      }
    }
    return localAutoFill
  }, [profile, localAutoFill])

  const oneTapEnterRef = useRef<(contest: Contest) => Promise<void>>(async () => {})

  const markEntered = useCallback(
    (contest: Contest, status: 'entered' | 'submitted' = 'entered') => {
      void persistEntered(contest, status)
      void social.refresh()
      // Enter-next auto-advance: after mark, open the next queued contest
      if (homeModeRef.current !== 'routine' || !autoAdvanceRef.current) return
      const queue = enterNextQueueRef.current
      const next = queue.find((c) => c.id !== contest.id)
      if (!next) return
      window.setTimeout(() => {
        setStatusToast('Next up — opening next contest')
        void oneTapEnterRef.current(next)
      }, 600)
    },
    [persistEntered, social]
  )

  const handleAgeConfirmed = useCallback(() => {
    saveAgeConfirmed(true)
    void updateProfile({
      settings: { ...(profile?.settings ?? {}), ageConfirmed: true },
    })
  }, [profile, updateProfile])

  const handleAutoFillUsed = useCallback(() => {
    void (async () => {
      if (smartFillsUnlimited) return
      if (smartFillsBlocked) {
        setShowSmartFillPaywall(true)
        return
      }
      if (profile && isSupabaseConfigured) {
        const res = await rpcConsumeSmartFill()
        if (res.ok && !res.local) {
          if (res.remaining != null) {
            await updateProfile({ smart_fills_remaining: res.remaining })
          }
          return
        }
        if (res.reason === 'smart_fills_exhausted') {
          setShowSmartFillPaywall(true)
          return
        }
      }
      const remaining = profile?.smart_fills_remaining
      if (remaining == null) return
      if (remaining <= 0) {
        setShowSmartFillPaywall(true)
        return
      }
      void updateProfile({ smart_fills_remaining: Math.max(0, remaining - 1) })
    })()
  }, [profile, updateProfile, smartFillsBlocked, smartFillsUnlimited])

  const handleGeoChange = useCallback((val: GeoFilterValue) => {
    setGeoFilter(val)
    saveGeoFilter(val)
    void updateProfile({
      settings: { ...(profile?.settings ?? {}), geoFilter: val },
    })
  }, [profile, updateProfile])

  const handleQuebecSafeChange = useCallback((next: boolean) => {
    setQuebecSafe(next)
    saveQuebecSafe(next)
    void updateProfile({
      settings: { ...(profile?.settings ?? {}), quebecSafe: next },
    })
  }, [profile, updateProfile])

  const handleSortChange = useCallback(
    (key: SortFilter) => {
      const next = sortFilter === key ? null : key
      setSortFilter(next)
      if (next) {
        saveFeedDisplayPrefsLocal({ sortDefault: next })
        void updateProfile({
          settings: withFeedDisplayPrefs(profile?.settings, { sortDefault: next }),
        })
      }
    },
    [sortFilter, profile?.settings, updateProfile]
  )

  const handleHomeModeChange = useCallback((mode: HomeMode) => {
    setHomeMode(mode)
    saveHomeMode(mode)
  }, [])

  /** One-tap Enter: open contest URL and auto-mark when the user returns. */
  const oneTapEnter = useCallback(
    async (contest: Contest) => {
      if (contest.id === '__offline_alert__') return
      pendingAutoMarkRef.current = contest
      skipAutoMarkOnceRef.current = true
      try {
        const url = await resolveContestUrl(
          contest.url,
          contest.contentSnippet ?? contest.description
        )
        const win = window.open(url, '_blank', 'noopener,noreferrer')
        if (!win) {
          // Popup blocked — fall back to Smart-Fill sheet without auto-mark yet
          pendingAutoMarkRef.current = null
          setOverlayContest(contest)
          setStatusToast('Popup blocked — use Open & Enter in the sheet')
          return
        }
        setStatusToast('Opened — will mark entered when you return')
      } catch {
        pendingAutoMarkRef.current = contest
        window.open(contest.url, '_blank', 'noopener,noreferrer')
        setStatusToast('Opened — will mark entered when you return')
      }
    },
    []
  )
  oneTapEnterRef.current = oneTapEnter

  const handleAutoAdvanceChange = useCallback((next: boolean) => {
    setAutoAdvance(next)
    saveAutoAdvance(next)
  }, [])

  // Auto-mark when user returns to the tab after one-tap Enter
  useEffect(() => {
    const tryAutoMark = () => {
      if (skipAutoMarkOnceRef.current) {
        skipAutoMarkOnceRef.current = false
        return
      }
      const pending = pendingAutoMarkRef.current
      if (!pending) return
      if (document.visibilityState && document.visibilityState !== 'visible') return
      pendingAutoMarkRef.current = null
      markEntered(pending, 'entered')
      setStatusToast(`Marked entered: ${pending.title.slice(0, 48)}`)
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') tryAutoMark()
    }
    window.addEventListener('focus', tryAutoMark)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', tryAutoMark)
    return () => {
      window.removeEventListener('focus', tryAutoMark)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', tryAutoMark)
    }
  }, [markEntered])

  const handleShare = useCallback(async (contest: Contest) => {
    const result = await shareContest(contest)
    if (result === 'shared') setStatusToast('Shared')
    else if (result === 'copied') setStatusToast('Link copied')
    else setStatusToast('Could not share')
  }, [])

  // Hive Mind history search (debounced)
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setHiveResults([])
      setHiveSearching(false)
      return
    }
    let cancelled = false
    setHiveSearching(true)
    const t = setTimeout(() => {
      void searchHiveMind(q).then((rows) => {
        if (!cancelled) {
          setHiveResults(rows)
          setHiveSearching(false)
        }
      })
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search])

  const filterOpts = useMemo<FeedFilterOptions>(
    () => ({
      geoFilter,
      quebecSafe,
      hidePurchaseRequired,
      hideAdult,
      hideEntered,
      enteredIds,
      search,
      tagFilters,
    }),
    [geoFilter, quebecSafe, hidePurchaseRequired, hideAdult, hideEntered, enteredIds, search, tagFilters]
  )

  const filterContest = useCallback(
    (c: Contest, opts?: { ignoreEntered?: boolean }) => contestPassesFeedFilters(c, filterOpts, opts),
    [filterOpts]
  )

  const sortFeed = useCallback(
    (list: Contest[]) => {
      if (sortFilter === 'most-popular') {
        return [...list].sort((a, b) => {
          const ca = social.countFor(a.id)
          const cb = social.countFor(b.id)
          if (cb !== ca) return cb - ca
          return (b.prizeValue ?? 0) - (a.prizeValue ?? 0)
        })
      }
      if (sortFilter === 'high-value') {
        return [...list].sort((a, b) => (b.prizeValue ?? 0) - (a.prizeValue ?? 0))
      }
      if (sortFilter === 'ending-soon') {
        return [...list].sort((a, b) => compareExpiryAscending(a.expiryDate, b.expiryDate))
      }
      if (sortFilter === 'best-odds') {
        return sortByBestOdds(list, social.countFor)
      }
      return list
    },
    [sortFilter, social]
  )

  /** Enter-next queue: not yet entered, honours every hide pref, ending soon first */
  const enterNextQueue = useMemo(
    () => buildEnterNextQueue(liveContests, filterOpts),
    [liveContests, filterOpts]
  )

  useEffect(() => {
    enterNextQueueRef.current = enterNextQueue
  }, [enterNextQueue])

  const nextContest = enterNextQueue[0] ?? null

  const railBase = useMemo(
    () => liveContests.filter((c) => c.id !== '__offline_alert__' && passesBaseFilters(c, filterOpts)),
    [liveContests, filterOpts]
  )

  const newRail = useMemo(() => {
    const cutoff = Date.now() - NEW_RAIL_MS
    return [...railBase]
      .filter((c) => {
        if (!c.createdAt) return false
        const t = Date.parse(c.createdAt)
        return Number.isFinite(t) && t >= cutoff
      })
      .sort((a, b) => compareCreatedDescending(a.createdAt, b.createdAt))
      .slice(0, PRO_RAIL_LIMIT)
  }, [railBase])

  const endingRail = useMemo(() => {
    return [...railBase]
      .filter((c) => c.expiryDate && isEndingTonight(c.expiryDate))
      .sort((a, b) => compareExpiryAscending(a.expiryDate, b.expiryDate))
      .slice(0, PRO_RAIL_LIMIT)
  }, [railBase])

  const routineContests = useMemo(() => {
    if (homeMode === 'routine') {
      return enterNextQueue.slice(0, 10)
    }
    return liveContests.filter((c) => enteredIds.has(c.id) && !isDeadLink(c)).slice(0, 10)
  }, [homeMode, enterNextQueue, liveContests, enteredIds])

  let feedContests = liveContests.filter((c) => filterContest(c))
  feedContests = sortFeed(feedContests)

  const hiveOnly = useMemo(() => {
    if (!search.trim() || hiveResults.length === 0) return []
    const liveIds = new Set(liveContests.map((c) => c.id))
    const liveUrls = new Set(liveContests.map((c) => c.url.toLowerCase()))
    return hiveResults.filter(
      (c) =>
        !isDeadLink(c) &&
        !liveIds.has(c.id) &&
        !liveUrls.has(c.url.toLowerCase())
    )
  }, [search, hiveResults, liveContests])

  const daysLeft = (c: Contest) => daysLeftUntilExpiry(c.expiryDate)

  const showFullRadar = (isScanning || isSyncingCloud) && liveContests.length === 0

  const visibleContests = feedContests.slice(0, visibleCount)
  const hasMore = visibleCount < feedContests.length

  useEffect(() => {
    setVisibleCount(75)
  }, [liveContests, tagFilters, search, hideEntered, quebecSafe, sortFilter, geoFilter, homeMode])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((prev) => Math.min(prev + 50, feedContests.length))
      },
      { rootMargin: '100px', threshold: 0 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [hasMore, feedContests.length])

  const renderRailCards = (list: Contest[], locked: boolean) => {
    const shown = locked ? list.slice(0, FREE_RAIL_TEASER) : list
    const unlockCard = locked ? (
      <button
        type="button"
        onClick={() => setShowRailsPaywall(true)}
        className="shrink-0 w-44 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left flex flex-col gap-2"
      >
        <span className="text-amber-300 text-xs font-bold uppercase">Pro</span>
        <span className="text-sm text-gray-50 font-semibold">Unlock full New & Ending rails</span>
        <span className="text-[11px] text-gray-400">
          {shown.length === 0 ? 'Pro unlocks New + Ending Tonight' : 'Free shows a teaser only'}
        </span>
      </button>
    ) : null

    if (shown.length === 0) {
      return (
        <div className="flex gap-4 items-start pb-2">
          <p className="text-gray-500 text-sm py-3 flex-1">Nothing here right now.</p>
          {unlockCard}
        </div>
      )
    }
    return (
      <div className={`flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 ${locked ? 'opacity-60' : ''}`}>
        {shown.map((c) => (
          <ContestCard
            key={c.id}
            contest={c}
            onOpenOverlay={locked ? () => setShowRailsPaywall(true) : setOverlayContest}
            onOneTapEnter={
              locked ? () => setShowRailsPaywall(true) : (contest) => void oneTapEnter(contest)
            }
            onShare={locked ? undefined : (contest) => void handleShare(contest)}
            variant="routine"
            entered={enteredIds.has(c.id)}
            entriesToday={social.countFor(c.id)}
            onAgeConfirmed={handleAgeConfirmed}
          />
        ))}
        {unlockCard}
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-gray-900">
      {offlineMode && (
        <div className="mx-4 mt-2 mb-0 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm font-medium inline-flex w-fit">
          Offline Mode
        </div>
      )}
      {!showFullRadar && (
        <>
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CountryToggle value={geoFilter} onChange={handleGeoChange} />
          <button
            type="button"
            onClick={() => handleQuebecSafeChange(!quebecSafe)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              quebecSafe
                ? 'bg-win text-on-win border-win'
                : 'bg-surface border-gray-600/50 text-gray-300 hover:text-gray-50'
            }`}
            title="Hide contests that exclude Quebec"
            aria-pressed={quebecSafe}
          >
            Québec-safe
          </button>
        </div>
        <Link
          to="/submit"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-win/40 text-win hover:bg-win/10 transition-colors"
        >
          + Submit a contest
        </Link>
      </div>

      {/* Home mode: Daily Routine (default) vs Browse */}
      <div className="px-4 pb-2 flex gap-2">
        {(
          [
            ['routine', 'Daily Routine'],
            ['browse', 'Browse all'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => handleHomeModeChange(key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              homeMode === key
                ? 'bg-win text-on-win'
                : 'bg-surface border border-gray-600/50 text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {social.hiveLabel && (
        <p className="px-4 pb-1 text-xs text-gray-500" title="Anonymized Hive Mind count — no usernames">
          {social.hiveLabel} across LoonieWins
        </p>
      )}

      {/* Enter Next / Daily Routine */}
      <section className="px-4 pt-2">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-bold text-gray-50 flex items-center gap-2">
            <span className="text-win">⚡</span>
            {homeMode === 'routine' ? 'Enter next' : 'Your Daily Routine'}
          </h2>
          {homeMode === 'routine' && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => handleAutoAdvanceChange(e.target.checked)}
                  className="rounded border-gray-600"
                />
                Auto-next
              </label>
              <span className="text-xs text-gray-500">{enterNextQueue.length} in queue</span>
            </div>
          )}
        </div>

        {homeMode === 'routine' && nextContest && (
          <button
            type="button"
            onClick={() => void oneTapEnter(nextContest)}
            className="w-full mb-3 px-4 py-3.5 rounded-xl bg-win text-on-win font-bold text-sm flex flex-col items-start gap-1 hover:opacity-90"
          >
            <span className="uppercase tracking-wide text-[10px] opacity-80">Enter next</span>
            <span className="line-clamp-2 text-left">{nextContest.title}</span>
            <span className="text-xs font-medium opacity-70">
              Opens contest · marks entered when you return
              {autoAdvance ? ' · then auto-advances' : ''}
            </span>
          </button>
        )}

        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
          {routineContests.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">
              {homeMode === 'routine'
                ? 'Queue clear — all matching contests entered, or refresh the feed.'
                : 'Enter contests to see them here.'}
            </p>
          ) : (
            routineContests.map((c) => (
              <ContestCard
                key={c.id}
                contest={c}
                onOpenOverlay={setOverlayContest}
                onOneTapEnter={(contest) => void oneTapEnter(contest)}
                onShare={(contest) => void handleShare(contest)}
                variant="routine"
                entered={enteredIds.has(c.id)}
                entriesToday={social.countFor(c.id)}
                onAgeConfirmed={handleAgeConfirmed}
              />
            ))
          )}
        </div>
      </section>

      {/* Pro-gated New / Ending rails */}
      <section className="px-4 pt-4 space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-bold text-gray-50">
              New{' '}
              {!hasNewEndingRails && (
                <span className="text-[10px] font-semibold uppercase text-amber-400 ml-1">Pro</span>
              )}
            </h2>
            <span className="text-[11px] text-gray-500">Last 48h</span>
          </div>
          {renderRailCards(newRail, !hasNewEndingRails)}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-bold text-gray-50">
              Ending tonight{' '}
              {!hasNewEndingRails && (
                <span className="text-[10px] font-semibold uppercase text-amber-400 ml-1">Pro</span>
              )}
            </h2>
            <span className="text-[11px] text-gray-500">Toronto day</span>
          </div>
          {renderRailCards(endingRail, !hasNewEndingRails)}
        </div>
      </section>

      {/* Search bar */}
      <div className="sticky top-[52px] z-20 px-4 py-3 bg-gray-900 border-y border-gray-700/50">
        <div className="flex items-center gap-2 w-full rounded-xl bg-surface-light border border-gray-600/50 px-3 py-2.5">
          <span className="text-gray-500" aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Search Hive Mind history…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-gray-50 placeholder-gray-500 focus:outline-none text-sm"
          />
          <button
            type="button"
            onClick={refetch}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-50 hover:bg-gray-600/50"
            title="Refresh"
            aria-label="Refresh contests"
          >
            <span aria-hidden>🔄</span>
          </button>
        </div>
        {search.trim().length >= 2 && (
          <p className="text-xs text-gray-500 mt-1.5">
            {hiveSearching
              ? 'Searching vault + Supabase…'
              : `Hive Mind: ${hiveResults.length} match${hiveResults.length === 1 ? '' : 'es'} (incl. history)`}
          </p>
        )}
      </div>

      {/* Filter row — only when browsing, or always for sort */}
      {(homeMode === 'browse' || search.trim()) && (
      <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
        {(
          [
            ['high-value', 'High Value'],
            ['ending-soon', 'Ending Soon'],
            ['best-odds', 'Best Odds'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => handleSortChange(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortFilter === key
                ? 'bg-win text-on-win'
                : 'bg-surface border border-gray-600/50 text-gray-300 hover:text-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setHideEntered((v) => !v)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            hideEntered ? 'bg-gray-700 text-gray-50 border-gray-500' : 'bg-surface border-gray-600/50 text-gray-400'
          }`}
        >
          Hide Entered
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !hidePurchaseRequired
            setHidePurchaseRequired(next)
            saveFeedDisplayPrefsLocal({ hidePurchaseRequired: next })
            void updateProfile({
              settings: withFeedDisplayPrefs(profile?.settings, { hidePurchaseRequired: next }),
            })
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            hidePurchaseRequired
              ? 'bg-gray-700 text-gray-50 border-gray-500'
              : 'bg-surface border-gray-600/50 text-gray-400'
          }`}
        >
          Hide Purchase
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !hideAdult
            setHideAdult(next)
            saveFeedDisplayPrefsLocal({ hideAdult: next })
            void updateProfile({
              settings: withFeedDisplayPrefs(profile?.settings, { hideAdult: next }),
            })
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            hideAdult
              ? 'bg-gray-700 text-gray-50 border-gray-500'
              : 'bg-surface border-gray-600/50 text-gray-400'
          }`}
        >
          Hide 18+
        </button>
      </div>
      )}

      {homeMode === 'browse' && (
      <div className="px-4 py-2 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 font-medium shrink-0">Filter:</span>
        {tagFilters.size > 0 && (
          <button
            type="button"
            onClick={() => setTagFilters(new Set())}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-gray-50 hover:bg-gray-600/50"
          >
            Clear filters
          </button>
        )}
        {TAG_REQ_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTagFilters((prev) => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              })
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tagFilters.has(key)
                ? 'bg-win text-on-win'
                : 'bg-surface border border-gray-600/50 text-gray-400 hover:text-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      )}
        </>
      )}

      {/* Opportunity List / Hive results */}
      <section className="px-4 pb-24">
        {showFullRadar ? (
          isSyncingCloud ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
              <span
                className="h-12 w-12 animate-pulse rounded-full bg-win/40"
                aria-hidden
              />
              <p className="text-center text-lg font-medium text-gray-50">Syncing Live Contests…</p>
              <p className="text-center text-sm text-gray-500">
                Downloading the latest from the Hive Mind
              </p>
            </div>
          ) : (
            <RadarLoader phaseMessage={phaseMessage} liveCount={liveContests.length} />
          )
        ) : (
          <>
            {homeMode === 'routine' && !search.trim() ? (
              <div className="rounded-xl bg-surface border border-gray-600/50 p-4 text-sm text-gray-400 space-y-2">
                <p>
                  Daily Routine is your home screen. Tap <span className="text-win font-medium">Enter next</span> to
                  open the soonest-ending contest — we mark it entered when you come back.
                </p>
                <button
                  type="button"
                  onClick={() => handleHomeModeChange('browse')}
                  className="text-win font-medium hover:underline"
                >
                  Browse full Opportunity List →
                </button>
              </div>
            ) : (
              <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-50">
                {search.trim() ? 'Search results' : 'Opportunity List'}
              </h2>
              {liveContests.length > 0 && (
                <span className="text-lg font-semibold text-gray-300">
                  {feedContests.length >= 100 ? `${feedContests.length}+` : feedContests.length} contests
                </span>
              )}
            </div>
            {liveContests.length === 0 && hiveOnly.length === 0 ? (
              <div className="rounded-xl bg-surface border border-gray-600/50 p-6 text-center space-y-4">
                <p className="text-gray-300">No contests found. Check Console (F12) for errors.</p>
                <button
                  type="button"
                  onClick={refetch}
                  className="px-5 py-2.5 rounded-lg bg-win text-on-win font-semibold"
                >
                  Retry Fetch
                </button>
              </div>
            ) : feedContests.length === 0 && hiveOnly.length === 0 ? (
              <div className="rounded-xl bg-surface border border-gray-600/50 p-6 text-center space-y-4">
                <p className="text-gray-300">No contests match your filters.</p>
                <button
                  type="button"
                  onClick={() => { setTagFilters(new Set()); setSearch('') }}
                  className="px-5 py-2.5 rounded-lg bg-win text-on-win font-semibold"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <ul className={`space-y-2 ${cardDensity === 'compact' ? 'space-y-1' : ''}`}>
                  {visibleContests.map((c) => (
                    <ContestCard
                      key={c.id}
                      contest={c}
                      onOpenOverlay={setOverlayContest}
                      onOneTapEnter={(contest) => void oneTapEnter(contest)}
                      onShare={(contest) => void handleShare(contest)}
                      variant="feed"
                      density={cardDensity}
                      adultAlwaysConfirm={adultAlwaysConfirm}
                      daysLeft={daysLeft(c)}
                      entered={enteredIds.has(c.id)}
                      entriesToday={social.countFor(c.id)}
                      onAgeConfirmed={handleAgeConfirmed}
                    />
                  ))}
                </ul>
                {hasMore && <div ref={sentinelRef} className="h-8 w-full" aria-hidden />}
                {!isFinished && (
                  <RadarLoader mini phaseMessage={phaseMessage} liveCount={liveContests.length} />
                )}
              </>
            )}
            {hiveOnly.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-gray-50 mb-2">Hive Mind history</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Matches from vault / Supabase outside the current live session list. Dead links are buried.
                </p>
                <ul className="space-y-2 opacity-90">
                  {hiveOnly.map((c) => (
                    <ContestCard
                      key={`hive-${c.id}`}
                      contest={c}
                      onOpenOverlay={setOverlayContest}
                      onOneTapEnter={(contest) => void oneTapEnter(contest)}
                      onShare={(contest) => void handleShare(contest)}
                      variant="feed"
                      daysLeft={daysLeft(c)}
                      entered={enteredIds.has(c.id)}
                      entriesToday={social.countFor(c.id)}
                      onAgeConfirmed={handleAgeConfirmed}
                    />
                  ))}
                </ul>
              </div>
            )}
              </>
            )}
          </>
        )}
      </section>

      {statusToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-sm px-4 py-2 rounded-lg bg-win text-on-win font-medium text-sm shadow-lg text-center">
          {statusToast}
        </div>
      )}

      <ContestBrowser
        contest={overlayContest}
        open={!!overlayContest}
        onClose={() => setOverlayContest(null)}
        onMarkEntered={markEntered}
        autoFillData={autoFillData}
        onAutoFillUsed={handleAutoFillUsed}
        smartFillBlocked={smartFillsBlocked}
        smartFillsRemaining={smartFillsUnlimited ? null : smartFillsRemaining}
        autoMarkOnReturn
        entriesToday={overlayContest ? social.countFor(overlayContest.id) : null}
        onAgeConfirmed={handleAgeConfirmed}
      />

      <SubscriptionModal
        open={showSmartFillPaywall || showRailsPaywall}
        onClose={() => {
          setShowSmartFillPaywall(false)
          setShowRailsPaywall(false)
        }}
        onSelectPlan={(planId) => {
          void upgradeToPro(planId)
          setShowSmartFillPaywall(false)
          setShowRailsPaywall(false)
        }}
        showComparison
      />
    </div>
  )
}
