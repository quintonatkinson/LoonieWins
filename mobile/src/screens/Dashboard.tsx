import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Keyboard,
  AppState,
  type AppStateStatus,
} from 'react-native'
import type { Contest } from '../lib/rssFetcher'
import { resolveContestUrl } from '../lib/rssFetcher'
import ContestCard from '../components/ContestCard'
import CountryToggle from '../components/CountryToggle'
import RadarLoader from '../components/RadarLoader'
import { useContestPipeline } from '../hooks/useContestPipeline'
import { useContestEntries } from '../hooks/useContestEntries'
import { useContestSocialProof } from '../hooks/useContestSocialProof'
import { useUserLimits } from '../hooks/useUserLimits'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { compareExpiryAscending, daysLeftUntilExpiry } from '../lib/utils/expiryDate'
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
import { totalPrizeValue } from '../lib/feed/ranking'
import {
  loadHomeMode,
  loadAutoAdvance,
  resolveInitialGeo,
  resolveInitialQuebecSafe,
  saveGeoFilter,
  saveHomeMode,
  saveQuebecSafe,
  saveAutoAdvance,
  type GeoFilterValue,
  type HomeMode,
} from '../lib/utils/feedPrefs'
import { searchHiveMind } from '../hooks/useContestVault'
import { shareContest } from '../lib/utils/shareContest'
import { Alert, Linking } from 'react-native'
import {
  contestRequiresAgeGate,
  loadAgeConfirmed,
  saveAgeConfirmed,
} from '../lib/utils/ageGate'
import {
  resolveFeedDisplayPrefs,
  type CardDensity,
  type SortDefault,
} from '../lib/utils/userSettings'

type SortFilter = SortDefault | null

const NEW_RAIL_MS = 48 * 60 * 60 * 1000
const FREE_RAIL_TEASER = 2
const PRO_RAIL_LIMIT = 12

function formatPrizePool(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000).toLocaleString()}K`
  return `$${Math.round(v)}`
}

interface DashboardProps {
  onOpenOverlay: (contest: Contest) => void
  onPressUrl: (url: string) => void
  /** Shared from App so ContestBrowser mark-entered updates feed badges immediately */
  enteredIds?: Set<string>
  /** Out of free entries and points → open the Earn screen */
  onNeedEarn?: () => void
}

export default function Dashboard({ onOpenOverlay, onPressUrl, enteredIds: enteredIdsProp, onNeedEarn }: DashboardProps) {
  const { accentColor } = useTheme()
  const pipeline = useContestPipeline()
  const { liveContests, isScanning, isSyncingCloud, isFinished, offlineMode, phaseMessage, refetch } = pipeline
  const { profile, updateProfile } = useAuth()
  const localEntries = useContestEntries()
  const enteredIds = enteredIdsProp ?? localEntries.enteredIds
  const persistEntered = localEntries.markEntered
  const { hasNewEndingRails } = useUserLimits()
  const social = useContestSocialProof()

  const [search, setSearch] = useState('')
  const [sortFilter, setSortFilter] = useState<SortFilter>('ending-soon')
  const [hideEntered, setHideEntered] = useState(true)
  const [quebecSafe, setQuebecSafe] = useState(false)
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set())
  const [geoFilter, setGeoFilter] = useState<GeoFilterValue>('CA')
  const [homeMode, setHomeMode] = useState<HomeMode>('routine')
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [hidePurchaseRequired, setHidePurchaseRequired] = useState(false)
  const [hideAdult, setHideAdult] = useState(false)
  const [adultAlwaysConfirm, setAdultAlwaysConfirm] = useState(false)
  const [cardDensity, setCardDensity] = useState<CardDensity>('comfortable')
  const [refreshing, setRefreshing] = useState(false)
  const [hiveResults, setHiveResults] = useState<Contest[]>([])
  const [statusToast, setStatusToast] = useState<string | null>(null)
  const pendingAutoMarkRef = useRef<Contest | null>(null)
  const enterNextQueueRef = useRef<Contest[]>([])
  const autoAdvanceRef = useRef(true)
  const homeModeRef = useRef<HomeMode>('routine')
  const oneTapEnterRef = useRef<(contest: Contest) => Promise<void>>(async () => {})
  const prefsReady = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [geo, qc, mode, advance, display] = await Promise.all([
        resolveInitialGeo({
          province: profile?.auto_fill_data?.province,
          settingsGeo: profile?.settings?.geoFilter,
        }),
        resolveInitialQuebecSafe({
          province: profile?.auto_fill_data?.province,
          settingsQuebecSafe: profile?.settings?.quebecSafe,
        }),
        loadHomeMode('routine'),
        loadAutoAdvance(true),
        resolveFeedDisplayPrefs({ settings: profile?.settings }),
      ])
      if (cancelled) return
      setGeoFilter(geo)
      setQuebecSafe(qc)
      setHomeMode(mode)
      setAutoAdvance(advance)
      setHidePurchaseRequired(display.hidePurchaseRequired)
      setHideAdult(display.hideAdult)
      setAdultAlwaysConfirm(display.adultAlwaysConfirm)
      setCardDensity(display.cardDensity)
      setSortFilter(display.sortDefault)
      // Persist an inferred QC default once; guard prevents an updateProfile → settings → effect loop.
      if (qc && profile?.settings?.quebecSafe !== true) {
        void saveQuebecSafe(true)
        void updateProfile({
          settings: { ...(profile?.settings ?? {}), quebecSafe: true },
        })
      }
      prefsReady.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.auto_fill_data?.province, profile?.settings, updateProfile])

  useEffect(() => {
    autoAdvanceRef.current = autoAdvance
  }, [autoAdvance])
  useEffect(() => {
    homeModeRef.current = homeMode
  }, [homeMode])

  useEffect(() => {
    if (!statusToast) return
    const t = setTimeout(() => setStatusToast(null), 3000)
    return () => clearTimeout(t)
  }, [statusToast])

  const markEntered = useCallback(
    (contest: Contest, status: 'entered' | 'submitted' = 'entered') => {
      void persistEntered(contest, status)
      void social.refresh()
      if (homeModeRef.current !== 'routine' || !autoAdvanceRef.current) return
      const next = enterNextQueueRef.current.find((c) => c.id !== contest.id)
      if (!next) return
      setTimeout(() => {
        setStatusToast('Next up — opening next contest')
        void oneTapEnterRef.current(next)
      }, 600)
    },
    [persistEntered, social]
  )

  const ensureAgeOk = useCallback(async (contest: Contest): Promise<boolean> => {
    if (!contestRequiresAgeGate(contest)) return true
    if (!adultAlwaysConfirm && (await loadAgeConfirmed())) return true
    return new Promise((resolve) => {
      Alert.alert(
        '18+ required',
        'This contest is marked 18+. Confirm you are of legal age to continue.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'I am 18+',
            onPress: () => {
              void saveAgeConfirmed(true)
              void updateProfile({
                settings: { ...(profile?.settings ?? {}), ageConfirmed: true },
              })
              resolve(true)
            },
          },
        ]
      )
    })
  }, [profile, updateProfile, adultAlwaysConfirm])

  // Auto-mark when app returns to foreground after one-tap Enter
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return
      const pending = pendingAutoMarkRef.current
      if (!pending) return
      pendingAutoMarkRef.current = null
      markEntered(pending, 'entered')
      setStatusToast('Marked entered')
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [markEntered])

  const oneTapEnter = useCallback(
    async (contest: Contest) => {
      if (!(await ensureAgeOk(contest))) return
      pendingAutoMarkRef.current = contest
      try {
        const url = await resolveContestUrl(
          contest.url,
          contest.contentSnippet ?? contest.description
        )
        await Linking.openURL(url)
        setStatusToast('Opened — marks entered when you return')
      } catch {
        pendingAutoMarkRef.current = contest
        onPressUrl(contest.url)
        setStatusToast('Opened — marks entered when you return')
      }
    },
    [onPressUrl, ensureAgeOk]
  )
  oneTapEnterRef.current = oneTapEnter

  const handleGeoChange = useCallback(
    (val: GeoFilterValue) => {
      setGeoFilter(val)
      void saveGeoFilter(val)
      void updateProfile({
        settings: { ...(profile?.settings ?? {}), geoFilter: val },
      })
    },
    [profile, updateProfile]
  )

  const handleShare = useCallback(async (contest: Contest) => {
    const result = await shareContest(contest)
    if (result === 'shared') setStatusToast('Shared')
    else setStatusToast('Could not share')
  }, [])

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setHiveResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void searchHiveMind(q).then((rows) => {
        if (!cancelled) setHiveResults(rows)
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

  const liveStats = useMemo(
    () => ({ count: railBase.length, prizes: totalPrizeValue(railBase) }),
    [railBase]
  )

  const newRail = useMemo(() => {
    const cutoff = Date.now() - NEW_RAIL_MS
    return [...railBase]
      .filter((c) => {
        if (!c.createdAt) return false
        const t = Date.parse(c.createdAt)
        return Number.isFinite(t) && t >= cutoff
      })
      .sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!))
      .slice(0, hasNewEndingRails ? PRO_RAIL_LIMIT : FREE_RAIL_TEASER)
  }, [railBase, hasNewEndingRails])

  const endingRail = useMemo(() => {
    return [...railBase]
      .filter((c) => c.expiryDate && isEndingTonight(c.expiryDate))
      .sort((a, b) => compareExpiryAscending(a.expiryDate, b.expiryDate))
      .slice(0, hasNewEndingRails ? PRO_RAIL_LIMIT : FREE_RAIL_TEASER)
  }, [railBase, hasNewEndingRails])

  const routineContests = useMemo(() => {
    if (homeMode === 'routine') return enterNextQueue.slice(0, 10)
    return liveContests.filter((c) => enteredIds.has(c.id) && !isDeadLink(c)).slice(0, 10)
  }, [homeMode, enterNextQueue, liveContests, enteredIds])

  let feedContests = liveContests.filter((c) => contestPassesFeedFilters(c, filterOpts))

  if (sortFilter === 'high-value') {
    feedContests = [...feedContests].sort((a, b) => (b.prizeValue ?? 0) - (a.prizeValue ?? 0))
  } else if (sortFilter === 'ending-soon') {
    feedContests = [...feedContests].sort((a, b) =>
      compareExpiryAscending(a.expiryDate, b.expiryDate)
    )
  } else if (sortFilter === 'best-odds') {
    feedContests = sortByBestOdds(feedContests, social.countFor)
  }

  const hiveOnly = useMemo(() => {
    if (!search.trim() || hiveResults.length === 0) return []
    const liveIds = new Set(liveContests.map((c) => c.id))
    return hiveResults.filter((c) => !liveIds.has(c.id) && !isDeadLink(c))
  }, [search, hiveResults, liveContests])

  const daysLeft = (c: Contest) => daysLeftUntilExpiry(c.expiryDate)

  const showFullRadar = (isScanning || isSyncingCloud) && liveContests.length === 0

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleOpenOverlay = useCallback(
    (contest: Contest) => {
      onOpenOverlay(contest)
    },
    [onOpenOverlay]
  )

  const listData = useMemo(() => {
    if (homeMode === 'routine' && !search.trim()) return [] as Contest[]
    return [...feedContests, ...hiveOnly.map((c) => ({ ...c, id: `hive-${c.id}` }))]
  }, [homeMode, search, feedContests, hiveOnly])

  const renderItem = useCallback(
    ({ item: c }: { item: Contest }) => (
      <ContestCard
        onNeedEarn={onNeedEarn}
        contest={c}
        onOpenOverlay={handleOpenOverlay}
        onOneTapEnter={(contest) => void oneTapEnter(contest)}
        onShare={(contest) => void handleShare(contest)}
        onPressUrl={onPressUrl}
        variant="feed"
        density={cardDensity}
        adultAlwaysConfirm={adultAlwaysConfirm}
        daysLeft={daysLeft(c)}
        entered={enteredIds.has(c.id.replace(/^hive-/, ''))}
      />
    ),
    [
      handleOpenOverlay,
      onPressUrl,
      oneTapEnter,
      handleShare,
      enteredIds,
      cardDensity,
      adultAlwaysConfirm,
    ]
  )

  const keyExtractor = useCallback((c: Contest) => c.id, [])

  const listHeader = (
    <>
      {offlineMode && (
        <View className="mx-4 mt-2 mb-0 px-3 py-1.5 rounded-lg bg-yellow-500/20 self-start">
          <Text className="text-yellow-400 text-sm font-medium">Offline Mode</Text>
        </View>
      )}
      {!showFullRadar && (
        <>
          {liveStats.count > 0 && (
            <View className="mx-4 mt-3 rounded-2xl border border-win/30 bg-win/10 px-4 py-3">
              <Text className="text-2xl font-extrabold text-gray-50">
                {liveStats.count.toLocaleString()} <Text className="text-win">live contests</Text>
              </Text>
              <Text className="text-sm text-gray-300 mt-0.5">
                {liveStats.prizes > 0 ? `${formatPrizePool(liveStats.prizes)} in prizes you can enter ` : ''}
                {geoFilter === 'ANY' ? 'across Canada & the US' : geoFilter === 'US' ? 'in the US' : 'in Canada'} ·
                updated every 30 min
              </Text>
            </View>
          )}
          <View className="px-4 pt-3 pb-2">
            <Text className="text-xs text-gray-500 mb-1">
              Appearance & more filters live in Settings
            </Text>
          </View>
          <View className="px-4 pt-3 pb-2 flex-row flex-wrap gap-2 items-center">
            <CountryToggle value={geoFilter} onChange={handleGeoChange} />
            <TouchableOpacity
              onPress={() => {
                const next = !quebecSafe
                setQuebecSafe(next)
                void saveQuebecSafe(next)
                void updateProfile({
                  settings: { ...(profile?.settings ?? {}), quebecSafe: next },
                })
              }}
              className={`px-4 py-2 rounded-full border ${quebecSafe ? 'bg-win border-win' : 'bg-surface border-gray-600/50'}`}
            >
              <Text className={`text-sm font-medium ${quebecSafe ? 'text-on-win' : 'text-gray-300'}`}>
                Québec-safe
              </Text>
            </TouchableOpacity>
          </View>

          {social.hiveLabel ? (
            <Text className="px-4 pb-1 text-xs text-gray-500">{social.hiveLabel} across LoonieWins</Text>
          ) : null}

          <View className="px-4 pb-2 flex-row gap-2">
            {(['routine', 'browse'] as const).map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  setHomeMode(key)
                  void saveHomeMode(key)
                }}
                className={`flex-1 py-2 rounded-xl ${homeMode === key ? 'bg-win' : 'bg-surface border border-gray-600/50'}`}
              >
                <Text
                  className={`text-center text-sm font-semibold ${homeMode === key ? 'text-on-win' : 'text-gray-400'}`}
                >
                  {key === 'routine' ? 'Daily Routine' : 'Browse all'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="px-4 pt-2">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-gray-50">
                <Text className="text-win">⚡</Text>{' '}
                {homeMode === 'routine' ? 'Enter next' : 'Your Daily Routine'}
              </Text>
              {homeMode === 'routine' && (
                <TouchableOpacity
                  onPress={() => {
                    const next = !autoAdvance
                    setAutoAdvance(next)
                    void saveAutoAdvance(next)
                  }}
                >
                  <Text className="text-[11px] text-gray-500">
                    Auto-next {autoAdvance ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {homeMode === 'routine' && nextContest && (
              <TouchableOpacity
                onPress={() => void oneTapEnter(nextContest)}
                className="mb-3 px-4 py-3.5 rounded-xl bg-win"
                activeOpacity={0.85}
              >
                <Text className="text-[10px] uppercase text-on-win/70 font-bold">Enter next</Text>
                <Text className="text-on-win font-bold text-sm mt-1" numberOfLines={2}>
                  {nextContest.title}
                </Text>
                <Text className="text-xs text-on-win/70 mt-1">
                  Opens contest · marks entered when you return
                  {autoAdvance ? ' · then auto-advances' : ''}
                </Text>
              </TouchableOpacity>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 pb-2">
              {routineContests.length === 0 ? (
                <Text className="text-gray-500 text-sm py-4">
                  {homeMode === 'routine' ? 'Queue clear.' : 'Enter contests to see them here.'}
                </Text>
              ) : (
                routineContests.map((c) => (
                  <ContestCard
                    onNeedEarn={onNeedEarn}
                    key={c.id}
                    contest={c}
                    onOpenOverlay={handleOpenOverlay}
                    onOneTapEnter={(contest) => void oneTapEnter(contest)}
                    onShare={(contest) => void handleShare(contest)}
                    onPressUrl={onPressUrl}
                    variant="routine"
                    daysLeft={daysLeft(c)}
                    entered={enteredIds.has(c.id)}
                  />
                ))
              )}
            </ScrollView>
          </View>

          <View className="px-4 pt-3">
            <Text className="text-sm font-bold text-gray-50 mb-2">
              New {!hasNewEndingRails ? <Text className="text-amber-400 text-[10px]"> PRO</Text> : null}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 pb-2">
              {newRail.length === 0 ? (
                <Text className="text-gray-500 text-sm py-2">Nothing new right now.</Text>
              ) : (
                newRail.map((c) => (
                  <ContestCard
                    onNeedEarn={onNeedEarn}
                    key={`new-${c.id}`}
                    contest={c}
                    onOpenOverlay={hasNewEndingRails ? handleOpenOverlay : () => setStatusToast('Upgrade to Pro for New rails')}
                    onOneTapEnter={
                      hasNewEndingRails
                        ? (contest) => void oneTapEnter(contest)
                        : () => setStatusToast('Upgrade to Pro for New rails')
                    }
                    onShare={hasNewEndingRails ? (contest) => void handleShare(contest) : undefined}
                    onPressUrl={onPressUrl}
                    variant="routine"
                    daysLeft={daysLeft(c)}
                    entered={enteredIds.has(c.id)}
                  />
                ))
              )}
            </ScrollView>
            <Text className="text-sm font-bold text-gray-50 mb-2 mt-2">
              Ending tonight{' '}
              {!hasNewEndingRails ? <Text className="text-amber-400 text-[10px]">PRO</Text> : null}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 pb-2">
              {endingRail.length === 0 ? (
                <Text className="text-gray-500 text-sm py-2">Nothing ending tonight.</Text>
              ) : (
                endingRail.map((c) => (
                  <ContestCard
                    onNeedEarn={onNeedEarn}
                    key={`end-${c.id}`}
                    contest={c}
                    onOpenOverlay={hasNewEndingRails ? handleOpenOverlay : () => setStatusToast('Upgrade to Pro for Ending rails')}
                    onOneTapEnter={
                      hasNewEndingRails
                        ? (contest) => void oneTapEnter(contest)
                        : () => setStatusToast('Upgrade to Pro for Ending rails')
                    }
                    onShare={hasNewEndingRails ? (contest) => void handleShare(contest) : undefined}
                    onPressUrl={onPressUrl}
                    variant="routine"
                    daysLeft={daysLeft(c)}
                    entered={enteredIds.has(c.id)}
                  />
                ))
              )}
            </ScrollView>
          </View>

          <View className="px-4 py-3 border-t border-b border-gray-700/50 bg-gray-900">
            <View className="flex-row items-center gap-2 rounded-xl bg-surface border border-gray-600/50 px-3 py-2.5">
              <Text className="text-gray-500">🔍</Text>
              <TextInput
                className="flex-1 text-gray-50 text-sm"
                placeholder="Search Hive Mind history…"
                placeholderTextColor="#9ca3af"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              <TouchableOpacity onPress={refetch} className="p-1.5 rounded-full">
                <Text className="text-gray-400">🔄</Text>
              </TouchableOpacity>
            </View>
          </View>

          {(homeMode === 'browse' || search.trim().length > 0) && (
            <View className="px-4 py-3 flex-row flex-wrap gap-2 items-center">
              {(['high-value', 'ending-soon', 'best-odds'] as const).map((key) => {
                const label =
                  key === 'high-value' ? 'High Value' : key === 'ending-soon' ? 'Ending Soon' : 'Best Odds'
                const active = sortFilter === key
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setSortFilter(active ? null : key)}
                    className={`px-4 py-2 rounded-full ${active ? 'bg-win' : 'bg-surface border border-gray-600/50'}`}
                  >
                    <Text className={`text-sm font-medium ${active ? 'text-on-win' : 'text-gray-300'}`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                onPress={() => setHideEntered((v) => !v)}
                className={`px-4 py-2 rounded-full border ${hideEntered ? 'bg-gray-700 border-gray-500' : 'bg-surface border-gray-600/50'}`}
              >
                <Text className={`text-sm font-medium ${hideEntered ? 'text-gray-50' : 'text-gray-400'}`}>
                  Hide Entered
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {homeMode === 'browse' && (
            <View className="px-4 py-2 flex-row flex-wrap gap-2 items-center">
              <Text className="text-xs text-gray-500 font-medium">Filter:</Text>
              {TAG_REQ_FILTERS.map(({ key, label }) => {
                const active = tagFilters.has(key)
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      setTagFilters((prev) => {
                        const next = new Set(prev)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }}
                    className={`px-3 py-1.5 rounded-full ${active ? 'bg-win' : 'bg-surface border border-gray-600/50'}`}
                  >
                    <Text className={`text-xs font-medium ${active ? 'text-on-win' : 'text-gray-400'}`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {homeMode === 'browse' || search.trim() ? (
            <View className="flex-row items-center justify-between px-4 mb-3">
              <Text className="text-base font-bold text-gray-50">
                {search.trim() ? 'Search results' : 'Opportunity List'}
              </Text>
              {liveContests.length > 0 && (
                <Text className="text-lg font-semibold text-gray-300">
                  {feedContests.length >= 100 ? `${feedContests.length}+` : feedContests.length} contests
                </Text>
              )}
            </View>
          ) : (
            <View className="mx-4 mb-4 rounded-xl bg-surface border border-gray-600/50 p-4">
              <Text className="text-sm text-gray-400">
                Daily Routine is your home screen. Tap Enter next to open the soonest-ending contest — we mark it
                entered when you come back.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setHomeMode('browse')
                  void saveHomeMode('browse')
                }}
                className="mt-2"
              >
                <Text className="text-win font-medium">Browse full Opportunity List →</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      {statusToast && (
        <View className="mx-4 mb-2 px-3 py-2 rounded-lg bg-win self-center">
          <Text className="text-on-win text-sm font-medium text-center">{statusToast}</Text>
        </View>
      )}
    </>
  )

  if (showFullRadar) {
    return (
      <ScrollView
        className="flex-1 bg-gray-900"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
      >
        {listHeader}
        {isSyncingCloud ? (
          <View className="flex-1 min-h-[60vh] items-center justify-center gap-6 px-4 py-12">
            <View className="h-12 w-12 rounded-full bg-win/40" />
            <Text className="text-center text-lg font-medium text-gray-50">Syncing Live Contests…</Text>
            <Text className="text-center text-sm text-gray-500">Downloading the latest from the Hive Mind</Text>
          </View>
        ) : (
          <View className="flex-1 py-12">
            <RadarLoader phaseMessage={phaseMessage} liveCount={liveContests.length} />
          </View>
        )}
      </ScrollView>
    )
  }

  return (
    <View className="flex-1 bg-gray-900">
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
        ListFooterComponent={
          !isFinished && homeMode === 'browse' ? (
            <View className="py-4">
              <RadarLoader mini phaseMessage={phaseMessage} liveCount={liveContests.length} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          homeMode === 'browse' && liveContests.length === 0 ? (
            <View className="mx-4 rounded-xl bg-surface border border-gray-600/50 p-6 items-center gap-4">
              <Text className="text-gray-300 text-center">No contests found. Pull to refresh.</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}
