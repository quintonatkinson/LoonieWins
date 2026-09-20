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
import AccentPicker from '../components/AccentPicker'
import { useContestPipeline } from '../hooks/useContestPipeline'
import { useContestEntries } from '../hooks/useContestEntries'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { compareExpiryAscending, daysLeftUntilExpiry } from '../lib/utils/expiryDate'
import {
  loadHomeMode,
  loadQuebecSafe,
  resolveInitialGeo,
  saveGeoFilter,
  saveHomeMode,
  saveQuebecSafe,
  type GeoFilterValue,
  type HomeMode,
} from '../lib/utils/feedPrefs'
import { searchHiveMind } from '../hooks/useContestVault'
import { shareContest } from '../lib/utils/shareContest'
import { Linking } from 'react-native'

type SortFilter = 'high-value' | 'ending-soon' | 'best-odds' | null

const TAG_REQ_FILTERS: { key: string; label: string; match: (c: Contest) => boolean }[] = [
  {
    key: 'easy',
    label: '⚡ Easy Entry',
    match: (c) => {
      const tags = c.tags ?? []
      const reqs = c.requirements ?? []
      if (tags.includes('⚡ Easy Entry')) return true
      if (reqs.length === 0 && !tags.includes('🧾 Purchase')) return true
      return false
    },
  },
  { key: 'purchase', label: 'Purchase Required', match: (c) => (c.requirements ?? []).includes('Purchase Required') },
  { key: 'app', label: 'App Download', match: (c) => (c.requirements ?? []).includes('App Download') },
  { key: 'social', label: 'Social Follow', match: (c) => (c.requirements ?? []).includes('Social Action') },
  { key: 'creative', label: 'Creative', match: (c) => (c.requirements ?? []).includes('Creative Submission') },
  { key: 'newsletter', label: 'Newsletter', match: (c) => (c.requirements ?? []).includes('Newsletter Signup') },
  { key: 'daily', label: 'Daily', match: (c) => (c.tags ?? []).includes('Daily') },
  { key: 'instant', label: 'Instant Win', match: (c) => (c.tags ?? []).includes('Instant Win') },
  { key: 'highvalue', label: 'High Value', match: (c) => (c.tags ?? []).includes('High Value') },
  { key: 'math', label: 'Math', match: (c) => (c.tags ?? []).includes('🧠 Math') },
  { key: '18plus', label: '18+', match: (c) => (c.tags ?? []).includes('18+') },
  { key: 'single', label: 'Single Entry', match: (c) => (c.tags ?? []).includes('1 Single Entry') },
  { key: 'weekly', label: 'Weekly', match: (c) => (c.tags ?? []).includes('Weekly') },
]

function passesGeo(c: Contest, geoFilter: GeoFilterValue): boolean {
  if (geoFilter === 'CA') {
    const elig = c.eligibility ?? 'Unknown'
    if (elig === 'US') return false
  }
  if (geoFilter === 'US') {
    const elig = c.eligibility ?? 'Unknown'
    if (elig === 'CA') return false
  }
  return true
}

interface DashboardProps {
  onOpenOverlay: (contest: Contest) => void
  onPressUrl: (url: string) => void
  /** Shared from App so ContestBrowser mark-entered updates feed badges immediately */
  enteredIds?: Set<string>
}

export default function Dashboard({ onOpenOverlay, onPressUrl, enteredIds: enteredIdsProp }: DashboardProps) {
  const { accentColor } = useTheme()
  const pipeline = useContestPipeline()
  const { liveContests, isScanning, isSyncingCloud, isFinished, offlineMode, phaseMessage, refetch } = pipeline
  const { profile, updateProfile } = useAuth()
  const localEntries = useContestEntries()
  const enteredIds = enteredIdsProp ?? localEntries.enteredIds
  const persistEntered = localEntries.markEntered

  const [search, setSearch] = useState('')
  const [sortFilter, setSortFilter] = useState<SortFilter>('ending-soon')
  const [hideEntered, setHideEntered] = useState(true)
  const [quebecSafe, setQuebecSafe] = useState(false)
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set())
  const [geoFilter, setGeoFilter] = useState<GeoFilterValue>('CA')
  const [homeMode, setHomeMode] = useState<HomeMode>('routine')
  const [refreshing, setRefreshing] = useState(false)
  const [hiveResults, setHiveResults] = useState<Contest[]>([])
  const [statusToast, setStatusToast] = useState<string | null>(null)
  const pendingAutoMarkRef = useRef<Contest | null>(null)
  const prefsReady = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [geo, qc, mode] = await Promise.all([
        resolveInitialGeo({
          province: profile?.auto_fill_data?.province,
          settingsGeo: profile?.settings?.geoFilter,
        }),
        loadQuebecSafe(false),
        loadHomeMode('routine'),
      ])
      if (cancelled) return
      setGeoFilter(geo)
      setQuebecSafe(qc)
      setHomeMode(mode)
      prefsReady.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.auto_fill_data?.province, profile?.settings?.geoFilter])

  useEffect(() => {
    if (!statusToast) return
    const t = setTimeout(() => setStatusToast(null), 3000)
    return () => clearTimeout(t)
  }, [statusToast])

  const markEntered = useCallback(
    (contest: Contest, status: 'entered' | 'submitted' = 'entered') => {
      void persistEntered(contest, status)
    },
    [persistEntered]
  )

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
    [onPressUrl]
  )

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

  const enterNextQueue = useMemo(() => {
    const base = liveContests.filter(
      (c) =>
        !enteredIds.has(c.id) &&
        c.id !== '__offline_alert__' &&
        passesGeo(c, geoFilter) &&
        !(quebecSafe && c.restrictions?.includes('no_quebec'))
    )
    return [...base].sort((a, b) => compareExpiryAscending(a.expiryDate, b.expiryDate)).slice(0, 25)
  }, [liveContests, enteredIds, geoFilter, quebecSafe])

  const nextContest = enterNextQueue[0] ?? null

  const routineContests = useMemo(() => {
    if (homeMode === 'routine') return enterNextQueue.slice(0, 10)
    return liveContests.filter((c) => enteredIds.has(c.id)).slice(0, 10)
  }, [homeMode, enterNextQueue, liveContests, enteredIds])

  let feedContests = liveContests.filter((c) => {
    if (hideEntered && enteredIds.has(c.id)) return false
    if (quebecSafe && c.restrictions?.includes('no_quebec')) return false
    if (!passesGeo(c, geoFilter)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!c.title.toLowerCase().includes(q)) return false
    }
    if (tagFilters.size > 0) {
      const matchesAny = TAG_REQ_FILTERS.some((f) => tagFilters.has(f.key) && f.match(c))
      if (!matchesAny) return false
    }
    return true
  })

  if (sortFilter === 'high-value') {
    feedContests = [...feedContests].sort((a, b) => (b.prizeValue ?? 0) - (a.prizeValue ?? 0))
  } else if (sortFilter === 'ending-soon') {
    feedContests = [...feedContests].sort((a, b) =>
      compareExpiryAscending(a.expiryDate, b.expiryDate)
    )
  }

  const hiveOnly = useMemo(() => {
    if (!search.trim() || hiveResults.length === 0) return []
    const liveIds = new Set(liveContests.map((c) => c.id))
    return hiveResults.filter((c) => !liveIds.has(c.id))
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
        contest={c}
        onOpenOverlay={handleOpenOverlay}
        onOneTapEnter={(contest) => void oneTapEnter(contest)}
        onShare={(contest) => void handleShare(contest)}
        onPressUrl={onPressUrl}
        variant="feed"
        daysLeft={daysLeft(c)}
        entered={enteredIds.has(c.id.replace(/^hive-/, ''))}
      />
    ),
    [handleOpenOverlay, onPressUrl, oneTapEnter, handleShare, enteredIds]
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
          <View className="px-4 pt-3 pb-2">
            <Text className="text-xs font-semibold text-white uppercase tracking-wide mb-2">
              Appearance
            </Text>
            <AccentPicker />
          </View>
          <View className="px-4 pt-3 pb-2 flex-row flex-wrap gap-2 items-center">
            <CountryToggle value={geoFilter} onChange={handleGeoChange} />
            <TouchableOpacity
              onPress={() => {
                const next = !quebecSafe
                setQuebecSafe(next)
                void saveQuebecSafe(next)
              }}
              className={`px-4 py-2 rounded-full border ${quebecSafe ? 'bg-win border-win' : 'bg-surface border-gray-600/50'}`}
            >
              <Text className={`text-sm font-medium ${quebecSafe ? 'text-on-win' : 'text-gray-300'}`}>
                Québec-safe
              </Text>
            </TouchableOpacity>
          </View>

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
            <Text className="text-base font-bold text-gray-50 mb-3">
              <Text className="text-win">⚡</Text>{' '}
              {homeMode === 'routine' ? 'Enter next' : 'Your Daily Routine'}
            </Text>
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
