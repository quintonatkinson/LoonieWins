import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchRawContests, enrichContest, type Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'
import { isDeadLink } from '../lib/utils/linkHealth'
import { getSeasonalPromos } from '../lib/data/seasonalPromos'
import { syncToVault, syncToCloud, fetchFromCloud, getLiveContests, isVaultEmpty } from './useContestVault'

const PHRASES = [
  'Scanning feeds...',
  'Analyzing CA + US sources...',
  'Filtering dead contests...',
  'Extracting odds...',
]

const CONCURRENCY = 3
const PHRASE_INTERVAL_MS = 2000
/** Background refresh so the vault stays continuously updated while the app is open */
const AUTO_REFRESH_MS = 30 * 60 * 1000
const DEFAULT_ELIGIBILITY: 'CA' | 'US' = 'CA'

function computeQualityScore(c: Contest, defaultEligibility: 'CA' | 'US' = DEFAULT_ELIGIBILITY): number {
  let score = 0
  const reqs = c.requirements ?? []
  const tags = c.tags ?? []
  if (reqs.length === 0) score += 50
  if (tags.includes('⚡ Easy Entry')) score += 15
  if (tags.includes('High Value')) score += 20
  if ((c.prizeValue ?? 0) >= 500) score += 10
  if (reqs.includes('Purchase Required')) score -= 20
  if (reqs.includes('Creative Submission')) score -= 30
  if (c.eligibility === defaultEligibility) score += 10
  return score
}

function normalizeUrlForDedupe(url: string): string {
  try {
    const u = new URL(url)
    const base = `${u.protocol}//${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, '')
    return base
  } catch {
    return url.toLowerCase().replace(/\/$/, '')
  }
}

function normalizeTitleForDedupe(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isSimilarTitle(a: string, b: string): boolean {
  const na = normalizeTitleForDedupe(a)
  const nb = normalizeTitleForDedupe(b)
  if (na === nb) return true
  if (na.length < 15 || nb.length < 15) return na === nb
  return na.includes(nb) || nb.includes(na)
}

export function useContestPipeline() {
  const [liveContests, setLiveContests] = useState<Contest[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [isSyncingCloud, setIsSyncingCloud] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [phaseMessage, setPhaseMessage] = useState(PHRASES[0])
  const abortRef = useRef(false)

  const runPipeline = useCallback(async () => {
    abortRef.current = false
    setLiveContests([])
    setIsScanning(true)
    setIsFinished(false)
    setOfflineMode(false)

    if (isVaultEmpty()) {
      setIsSyncingCloud(true)
      await fetchFromCloud()
      setIsSyncingCloud(false)
    } else {
      void fetchFromCloud()
    }

    let rawItems: Contest[] = []
    try {
      const data = await fetchRawContests()
      rawItems = data.contests
      if (data.offlineMode && rawItems.length > 0 && rawItems[0].id === '__offline_alert__') {
        setLiveContests(rawItems)
        setOfflineMode(true)
        setIsScanning(false)
        setIsFinished(true)
        return
      }
    } catch {
      setIsScanning(false)
      setIsFinished(true)
      return
    }

    const toProcess = rawItems.filter((c) => c.id !== '__offline_alert__')
    let nextIndex = 0
    const collected: Contest[] = []
    const allEnriched: Contest[] = []

    const processOne = async (): Promise<void> => {
      while (nextIndex < toProcess.length && !abortRef.current) {
        const i = nextIndex
        nextIndex += 1
        const contest = toProcess[i]
        if (!contest) continue
        try {
          const enriched = await enrichContest(contest)
          if (abortRef.current) return

          allEnriched.push(enriched)

          // Only drop from live display if we have a mathematically proven expiry date in the past. Never drop when expiryDate is undefined.
          const expired =
            enriched.expiryDate != null &&
            (() => {
              const end = toExpiryEndOfDay(enriched.expiryDate!)
              return !Number.isNaN(end.getTime()) && end <= new Date()
            })()
          if (expired) return
          // Drop proven-dead links only (404/410); proxy 403/5xx are transient
          if (isDeadLink(enriched)) return

          collected.push(enriched)
        } catch {
          // skip failed enrichment
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => processOne()))

    if (!abortRef.current) {
      syncToVault(allEnriched)
      void syncToCloud(allEnriched)

      const byResolvedUrl = new Map<string, Contest>()
      for (const c of collected) {
        const key = normalizeUrlForDedupe(c.url)
        if (!byResolvedUrl.has(key)) byResolvedUrl.set(key, c)
      }
      let deduped = [...byResolvedUrl.values()]
      const final: Contest[] = []
      for (const c of deduped) {
        const key = normalizeUrlForDedupe(c.url)
        const similar = final.find(
          (f) => normalizeUrlForDedupe(f.url) !== key && isSimilarTitle(f.title, c.title)
        )
        if (!similar) {
          final.push(c)
        } else {
          const scoreC = computeQualityScore(c)
          const scoreS = computeQualityScore(similar)
          if (scoreC > scoreS) {
            const idx = final.indexOf(similar)
            final[idx] = c
          }
        }
      }
      deduped = final
      const vaultLive = getLiveContests()
      const byUrl = new Map<string, Contest>()
      for (const c of vaultLive) {
        byUrl.set(normalizeUrlForDedupe(c.url), c)
      }
      for (const c of deduped) {
        byUrl.set(normalizeUrlForDedupe(c.url), c)
      }
      const seasonal = getSeasonalPromos()
      for (const s of seasonal) {
        const key = normalizeUrlForDedupe(s.url)
        if (!byUrl.has(key)) byUrl.set(key, s)
      }
      const merged = [...byUrl.values()]
      const sorted = [...merged].sort((a, b) => {
        const scoreA = computeQualityScore(a)
        const scoreB = computeQualityScore(b)
        if (scoreB !== scoreA) return scoreB - scoreA
        const da = a.expiryDate ? new Date(a.expiryDate).getTime() : 0
        const db = b.expiryDate ? new Date(b.expiryDate).getTime() : 0
        return db - da
      })
      setLiveContests(sorted)
      setIsScanning(false)
      setIsFinished(true)
    }
  }, [])

  useEffect(() => {
    runPipeline()
    return () => {
      abortRef.current = true
    }
  }, [runPipeline])

  // Continuous refresh while the dashboard session is alive
  useEffect(() => {
    const id = setInterval(() => {
      if (!abortRef.current) runPipeline()
    }, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [runPipeline])

  useEffect(() => {
    if (!isScanning) return
    const id = setInterval(() => {
      setPhaseMessage((prev) => {
        const idx = PHRASES.indexOf(prev)
        const next = (idx + 1) % PHRASES.length
        return PHRASES[next]
      })
    }, PHRASE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isScanning])

  const refetch = useCallback(() => {
    runPipeline()
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
