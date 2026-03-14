import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Keyboard,
} from 'react-native'
import type { Contest } from '../lib/rssFetcher'
import ContestCard from '../components/ContestCard'
import CountryToggle from '../components/CountryToggle'
import RadarLoader from '../components/RadarLoader'
import { useContestPipeline } from '../hooks/useContestPipeline'
import { storage } from '../lib/utils/storage'
import type { AutoFillData } from '../types/profile'

const STORAGE_ENTERED = 'looniewins_entered'

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

interface DashboardProps {
  onOpenOverlay: (contest: Contest) => void
  onPressUrl: (url: string) => void
}

export default function Dashboard({ onOpenOverlay, onPressUrl }: DashboardProps) {
  const pipeline = useContestPipeline()
  const { liveContests, isScanning, isSyncingCloud, isFinished, offlineMode, phaseMessage, refetch } = pipeline

  const [search, setSearch] = useState('')
  const [sortFilter, setSortFilter] = useState<SortFilter>(null)
  const [hideEntered, setHideEntered] = useState(false)
  const [hideQCExcluded, setHideQCExcluded] = useState(false)
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set())
  const [geoFilter, setGeoFilter] = useState<'CA' | 'US' | 'ANY'>('CA')
  const [enteredIds, setEnteredIdsState] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [autoFillData] = useState<AutoFillData>(() => ({
    name: 'John Doe',
    email: 'test@email.com',
    address: '123 Main St, Toronto ON',
  }))

  useEffect(() => {
    let mounted = true
    storage.getItem(STORAGE_ENTERED).then((raw) => {
      if (!mounted) return
      try {
        const arr = raw ? JSON.parse(raw) : []
        setEnteredIdsState(new Set(Array.isArray(arr) ? arr : []))
      } catch {
        setEnteredIdsState(new Set())
      }
    })
    return () => { mounted = false }
  }, [])

  const persistEntered = useCallback((ids: Set<string>) => {
    storage.setItem(STORAGE_ENTERED, JSON.stringify([...ids]))
  }, [])

  const markEntered = useCallback(
    (contest: Contest) => {
      const next = new Set(enteredIds)
      next.add(contest.id)
      setEnteredIdsState(next)
      persistEntered(next)
    },
    [enteredIds, persistEntered]
  )

  const routineContests = liveContests.filter((c) => enteredIds.has(c.id)).slice(0, 10)

  let feedContests = liveContests.filter((c) => {
    if (hideEntered && enteredIds.has(c.id)) return false
    if (hideQCExcluded && c.restrictions?.includes('no_quebec')) return false
    if (geoFilter === 'CA') {
      const elig = c.eligibility ?? 'Unknown'
      if (elig === 'US') return false
    }
    if (geoFilter === 'US') {
      const elig = c.eligibility ?? 'Unknown'
      if (elig === 'CA') return false
    }
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
    feedContests = [...feedContests].sort((a, b) => {
      const da = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
      const db = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
      return da - db
    })
  }

  const daysLeft = (c: Contest) =>
    c.expiryDate
      ? Math.max(0, Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null

  const showFullRadar = (isScanning || isSyncingCloud) && liveContests.length === 0

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleOpenOverlay = useCallback(
    (contest: Contest) => {
      markEntered(contest)
      onOpenOverlay(contest)
    },
    [markEntered, onOpenOverlay]
  )

  const renderItem = useCallback(
    ({ item: c }: { item: Contest }) => (
      <ContestCard
        contest={c}
        onOpenOverlay={handleOpenOverlay}
        onPressUrl={onPressUrl}
        variant="feed"
        daysLeft={daysLeft(c)}
      />
    ),
    [handleOpenOverlay, onPressUrl]
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
            <CountryToggle value={geoFilter} onChange={setGeoFilter} />
          </View>
          <View className="px-4 pt-4">
            <Text className="text-base font-bold text-gray-50 mb-3 flex-row items-center gap-2">
              <Text className="text-win">⚡</Text> Your Daily Routine
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 pb-2">
              {routineContests.length === 0 ? (
                <Text className="text-gray-500 text-sm py-4">Enter contests to see them here.</Text>
              ) : (
                routineContests.map((c) => (
                  <ContestCard
                    key={c.id}
                    contest={c}
                    onOpenOverlay={handleOpenOverlay}
                    onPressUrl={onPressUrl}
                    variant="routine"
                    daysLeft={daysLeft(c)}
                  />
                ))
              )}
            </ScrollView>
          </View>
          <View className="px-4 py-3 border-t border-b border-gray-700/50 bg-gray-900">
            <View className="flex-row items-center gap-2 rounded-xl bg-surface border border-gray-600/50 px-3 py-2.5">
              <Text className="text-gray-500">🔍</Text>
              <TextInput
                className="flex-1 text-gray-50 placeholder-gray-500 text-sm"
                placeholder="Search contests..."
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
          <View className="px-4 py-3 flex-row flex-wrap gap-2 items-center">
            {(['high-value', 'ending-soon', 'best-odds'] as const).map((key) => {
              const label = key === 'high-value' ? 'High Value' : key === 'ending-soon' ? 'Ending Soon' : 'Best Odds'
              const active = sortFilter === key
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSortFilter(active ? null : key)}
                  className={`px-4 py-2 rounded-full ${active ? 'bg-win' : 'bg-surface border border-gray-600/50'}`}
                >
                  <Text className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-300'}`}>{label}</Text>
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
            <TouchableOpacity
              onPress={() => setHideQCExcluded((v) => !v)}
              className={`px-4 py-2 rounded-full border ${hideQCExcluded ? 'bg-gray-700 border-gray-500' : 'bg-surface border-gray-600/50'}`}
            >
              <Text className={`text-sm font-medium ${hideQCExcluded ? 'text-gray-50' : 'text-gray-400'}`}>
                Hide QC Excluded
              </Text>
            </TouchableOpacity>
          </View>
          <View className="px-4 py-2 flex-row flex-wrap gap-2 items-center">
            <Text className="text-xs text-gray-500 font-medium">Filter:</Text>
            {tagFilters.size > 0 && (
              <TouchableOpacity onPress={() => setTagFilters(new Set())} className="px-3 py-1.5 rounded-full">
                <Text className="text-xs font-medium text-gray-400">Clear filters</Text>
              </TouchableOpacity>
            )}
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
                  <Text className={`text-xs font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <View className="flex-row items-center justify-between px-4 mb-3">
            <Text className="text-base font-bold text-gray-50">Opportunity List</Text>
            {liveContests.length > 0 && (
              <Text className="text-lg font-semibold text-gray-300">
                {feedContests.length >= 100 ? `${feedContests.length}+` : feedContests.length} contests
              </Text>
            )}
          </View>
        </>
      )}
    </>
  )

  if (showFullRadar) {
    return (
      <ScrollView
        className="flex-1 bg-gray-900"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39FF14" />}
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

  if (liveContests.length === 0) {
    return (
      <ScrollView
        className="flex-1 bg-gray-900"
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39FF14" />}
      >
        {listHeader}
        <View className="rounded-xl bg-surface border border-gray-600/50 p-6 items-center gap-4 mt-4">
          <Text className="text-gray-300 text-center">No contests found. Pull to refresh.</Text>
          <TouchableOpacity onPress={refetch} className="px-5 py-2.5 rounded-lg bg-win">
            <Text className="text-gray-900 font-semibold">Retry Fetch</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  if (feedContests.length === 0) {
    return (
      <ScrollView
        className="flex-1 bg-gray-900"
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39FF14" />}
      >
        {listHeader}
        <View className="rounded-xl bg-surface border border-gray-600/50 p-6 items-center gap-4 mt-4">
          <Text className="text-gray-300 text-center">No contests match your filters.</Text>
          <TouchableOpacity
            onPress={() => {
              setTagFilters(new Set())
              setSearch('')
            }}
            className="px-5 py-2.5 rounded-lg bg-win"
          >
            <Text className="text-gray-900 font-semibold">Clear filters</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
    <View className="flex-1 bg-gray-900">
      <FlatList
        data={feedContests}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: 96 }}
        stickyHeaderIndices={[]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39FF14" />}
        ListFooterComponent={
          !isFinished ? (
            <View className="py-4">
              <RadarLoader mini phaseMessage={phaseMessage} liveCount={liveContests.length} />
            </View>
          ) : null
        }
      />
    </View>
  )
}
