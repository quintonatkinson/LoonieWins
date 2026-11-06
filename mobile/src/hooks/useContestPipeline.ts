import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchRawContests, enrichContest, type Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'
import { getSeasonalPromos } from '../lib/data/seasonalPromos'
import { syncToVault, syncToCloud, fetchFromCloud, getLiveContests, isVaultEmpty } from './useContestVault'

const PHRASES = ['Scanning feeds...', 'Analyzing CA + US sources...', 'Filtering dead contests...', 'Extracting odds...']
const CONCURRENCY = 3
const PHRASE_INTERVAL_MS = 2000
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
    return `${u.protocol}//${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, '')
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

async function buildSortedFeed(collected: Contest[]): Promise<Contest[]> {
  const byResolvedUrl = new Map<string, Contest>()
  for (const c of collected) {
    const key = normalizeUrlForDedupe(c.url)
    if (!byResolvedUrl.has(key)) byResolvedUrl.set(key, c)
  }
  let deduped = [...byResolvedUrl.values()]
  const final: Contest[] = []
  for (const c of deduped) {
    const key = normalizeUrlForDedupe(c.url)
    const similar = final.find((f) => normalizeUrlForDedupe(f.url) !== key && isSimilarTitle(f.title, c.title))
    if (!similar) final.push(c)
    else {
      const scoreC = computeQualityScore(c)
      const scoreS = computeQualityScore(similar)
      if (scoreC > scoreS) final[final.indexOf(similar)] = c
    }
  }
  deduped = final

  const vaultLive = await getLiveContests()
  const byUrl = new Map<string, Contest>()
  for (const c of vaultLive) byUrl.set(normalizeUrlForDedupe(c.url), c)
  for (const c of deduped) byUrl.set(normalizeUrlForDedupe(c.url), c)
  const seasonal = getSeasonalPromos()
  for (const s of seasonal) {
    const key = normalizeUrlForDedupe(s.url)
    if (!byUrl.has(key)) byUrl.set(key, s)
  }
  const merged = [...byUrl.values()]
  return merged.sort((a, b) => {
    const scoreA = computeQualityScore(a)
    const scoreB = computeQualityScore(b)
    if (scoreB !== scoreA) return scoreB - scoreA
    const da = a.expiryDate ? new Date(a.expiryDate).getTime() : 0
    const db = b.expiryDate ? new Date(b.expiryDate).getTime() : 0
    return db - da
  })
}

export function useContestPipeline() {
  const [liveContests, setLiveContests] = useState<Contest[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [isSyncingCloud, setIsSyncingCloud] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [phaseMessage, setPhaseMessage] = useState(PHRASES[0])
  const [scanProgress, setScanProgress] = useState(0)
  const abortRef = useRef(false)
  const enrichDoneRef = useRef(0)

  const runPipeline = useCallback(async () => {
    abortRef.current = false
    try {
      const seeded = await getLiveContests()
      if (seeded.length > 0) setLiveContests(seeded)
    } catch {
      /* empty */
    }
    setIsScanning(true)
    setIsFinished(false)
    setOfflineMode(false)
    setScanProgress(0)
    enrichDoneRef.current = 0

    const empty = await isVaultEmpty()
    if (empty) {
      setIsSyncingCloud(true)
      await fetchFromCloud()
      setIsSyncingCloud(false)
      try {
        const after = await getLiveContests()
        if (after.length > 0) setLiveContests(after)
      } catch {
        /* ignore */
      }
    } else {
      void fetchFromCloud()
    }

    setPhaseMessage(PHRASES[0])
    let rawItems: Contest[] = []
    try {
      const data = await fetchRawContests()
      rawItems = data.contests
      if (data.offlineMode && rawItems.length > 0 && rawItems[0]?.id === '__offline_alert__') {
        setLiveContests(rawItems)
        setOfflineMode(true)
        setIsScanning(false)
        setIsFinished(true)
        setScanProgress(100)
        return
      }
    } catch (_) {
      setIsScanning(false)
      setIsFinished(true)
      return
    }

    const toProcess = rawItems.filter((c) => c.id !== '__offline_alert__')
    const total = Math.max(toProcess.length, 1)
    setScanProgress(5)
    setPhaseMessage(PHRASES[1])

    let nextIndex = 0
    const collected: Contest[] = []
    const allEnriched: Contest[] = []

    const bumpProgress = () => {
      enrichDoneRef.current += 1
      const pct = 5 + Math.round((enrichDoneRef.current / total) * 90)
      setScanProgress(Math.min(95, pct))
    }

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
          bumpProgress()

          const expired =
            enriched.expiryDate != null &&
            (() => {
              const end = toExpiryEndOfDay(enriched.expiryDate!)
              return !Number.isNaN(end.getTime()) && end <= new Date()
            })()
          if (expired) return
          if (
            enriched.linkStatus === 404 ||
            enriched.linkStatus === 403 ||
            enriched.linkStatus === 410 ||
            enriched.linkStatus === 500 ||
            enriched.linkStatus === 502 ||
            enriched.linkStatus === 503
          )
            return

          collected.push(enriched)
          if (collected.length === 1 || collected.length % 8 === 0) {
            setLiveContests(await buildSortedFeed(collected))
          }
        } catch (_) {
          bumpProgress()
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => processOne()))

    if (!abortRef.current) {
      await syncToVault(allEnriched)
      void syncToCloud(allEnriched)

      const sorted = await buildSortedFeed(collected)
      setLiveContests(sorted)
      setScanProgress(100)
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

  return {
    liveContests,
    isScanning,
    isSyncingCloud,
    isFinished,
    offlineMode,
    phaseMessage,
    scanProgress,
    refetch: runPipeline,
  }
}
