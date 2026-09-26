import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import { fetchRawContests, type Contest } from '../lib/rssFetcher'
import { getSeasonalPromos } from '../lib/data/seasonalPromos'
import { mergeRankDedupe, OFFLINE_ALERT_ID } from '../lib/feed/ranking'
import { fetchLiveFromCloud, getLiveContests, syncToVault } from './useContestVault'

const PHRASES = ['Scanning feeds...', 'Analyzing CA + US sources...', 'Filtering dead contests...', 'Extracting odds...']
/** Background refresh while the app is open (the server re-ingests every 30 min). */
const AUTO_REFRESH_MS = 10 * 60 * 1000
/** Scrape feeds on-device only when the Hive Mind has fewer live contests than this. */
const CLIENT_SCRAPE_THRESHOLD = 60

/**
 * Feed loading, fastest source first: AsyncStorage cache (instant) → Hive Mind cloud pull
 * (server already fetched + tagged everything) → on-device RSS scrape only as a fallback.
 * Entry URLs are resolved on tap, never up front.
 */
export function useContestPipeline() {
  const [liveContests, setLiveContests] = useState<Contest[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [isSyncingCloud, setIsSyncingCloud] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [phaseMessage] = useState(PHRASES[0])
  const runId = useRef(0)

  const runPipeline = useCallback(async () => {
    const id = ++runId.current
    const stale = () => id !== runId.current
    const seasonal = getSeasonalPromos()
    setIsFinished(false)
    setOfflineMode(false)

    const cached = await getLiveContests()
    if (stale()) return
    if (cached.length > 0) {
      setLiveContests(mergeRankDedupe(cached, seasonal))
      setIsScanning(false)
    } else {
      setIsScanning(true)
    }

    setIsSyncingCloud(cached.length === 0)
    const cloud = await fetchLiveFromCloud()
    setIsSyncingCloud(false)
    if (stale()) return
    if (cloud && cloud.length > 0) {
      setLiveContests(mergeRankDedupe(cloud, seasonal))
      setIsScanning(false)
    }
    if (cloud && cloud.length >= CLIENT_SCRAPE_THRESHOLD) {
      setIsFinished(true)
      return
    }

    let scraped: Contest[] = []
    try {
      const data = await fetchRawContests()
      if (stale()) return
      scraped = data.contests.filter((c) => c.id !== OFFLINE_ALERT_ID)
      if (data.offlineMode && scraped.length === 0 && !cloud?.length && cached.length === 0) {
        setLiveContests(data.contests)
        setOfflineMode(true)
      }
    } catch {
      /* keep what we show */
    }
    if (stale()) return
    if (scraped.length > 0) {
      await syncToVault(scraped)
      setLiveContests(mergeRankDedupe(await getLiveContests(), cloud ?? [], seasonal))
    } else if (!cloud?.length && cached.length === 0) {
      setLiveContests(mergeRankDedupe(seasonal))
    }
    setIsScanning(false)
    setIsFinished(true)
  }, [])

  useEffect(() => {
    const runs = runId
    void runPipeline()
    return () => {
      runs.current++ // invalidate the in-flight run on unmount
    }
  }, [runPipeline])

  useEffect(() => {
    const timer = setInterval(() => void runPipeline(), AUTO_REFRESH_MS)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runPipeline()
    })
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [runPipeline])

  return {
    liveContests,
    isScanning,
    isSyncingCloud,
    isFinished,
    offlineMode,
    phaseMessage,
    refetch: runPipeline,
  }
}
