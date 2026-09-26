import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchRawContests, type Contest } from '../lib/rssFetcher'
import { getSeasonalPromos } from '../lib/data/seasonalPromos'
import { mergeRankDedupe, OFFLINE_ALERT_ID } from '../lib/feed/ranking'
import { fetchLiveFromCloud, getLiveContests, syncToVault } from './useContestVault'

const PHRASES = [
  'Scanning feeds...',
  'Analyzing CA + US sources...',
  'Filtering dead contests...',
  'Extracting odds...',
]

const PHRASE_INTERVAL_MS = 2000
/** Background refresh while the app is open (the server re-ingests every 30 min). */
const AUTO_REFRESH_MS = 10 * 60 * 1000
/**
 * If the Hive Mind has fewer live contests than this (ingest not deployed yet, or offline
 * cloud), scrape feeds in the browser as a fallback and stream results in as they land.
 */
const CLIENT_SCRAPE_THRESHOLD = 60

/**
 * Feed loading, fastest source first:
 *   1. local cache (instant paint, even offline)
 *   2. Hive Mind cloud pull (one paged query — the server already fetched + tagged everything)
 *   3. in-browser RSS scrape, only when the cloud is empty/unavailable
 * Final entry URLs are resolved on tap (resolveContestUrl), never up front.
 */
export function useContestPipeline() {
  const [liveContests, setLiveContests] = useState<Contest[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [isSyncingCloud, setIsSyncingCloud] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [phaseMessage, setPhaseMessage] = useState(PHRASES[0])
  const runId = useRef(0)

  const runPipeline = useCallback(async () => {
    const id = ++runId.current
    const stale = () => id !== runId.current
    const seasonal = getSeasonalPromos()

    setIsFinished(false)
    setOfflineMode(false)

    // 1. Cache — paint immediately.
    const cached = getLiveContests()
    if (cached.length > 0) {
      setLiveContests(mergeRankDedupe(cached, seasonal))
      setIsScanning(false)
    } else {
      setIsScanning(true)
    }

    // 2. Cloud.
    setIsSyncingCloud(true)
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

    // 3. Fallback scrape (stream in; no per-contest deep scrape up front).
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
      /* keep whatever we already show */
    }
    if (stale()) return
    if (scraped.length > 0) {
      syncToVault(scraped)
      setLiveContests(mergeRankDedupe(getLiveContests(), cloud ?? [], seasonal))
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
    const idTimer = setInterval(() => void runPipeline(), AUTO_REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runPipeline()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(idTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [runPipeline])

  useEffect(() => {
    if (!isScanning) return
    const idTimer = setInterval(() => {
      setPhaseMessage((prev) => PHRASES[(PHRASES.indexOf(prev) + 1) % PHRASES.length])
    }, PHRASE_INTERVAL_MS)
    return () => clearInterval(idTimer)
  }, [isScanning])

  const refetch = useCallback(() => {
    void runPipeline()
  }, [runPipeline])

  return {
    liveContests,
    isScanning,
    isSyncingCloud,
    isFinished,
    offlineMode,
    phaseMessage,
    refetch,
  }
}
