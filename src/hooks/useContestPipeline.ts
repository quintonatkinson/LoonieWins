import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchRawContests, enrichContest, type Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'

const PHRASES = [
  'Scanning feeds...',
  'Analyzing 150+ links...',
  'Filtering dead contests...',
  'Extracting odds...',
]

const CONCURRENCY = 12
const PHRASE_INTERVAL_MS = 2000
const DEFAULT_ELIGIBILITY: 'CA' | 'US' = 'CA'

function computeQualityScore(c: Contest, defaultEligibility: 'CA' | 'US' = DEFAULT_ELIGIBILITY): number {
  let score = 0
  const reqs = c.requirements ?? []
  if (reqs.length === 0) score += 50
  if (reqs.includes('Purchase Required')) score -= 20
  if (reqs.includes('Creative Submission')) score -= 30
  if (c.eligibility === defaultEligibility) score += 10
  return score
}

export function useContestPipeline() {
  const [liveContests, setLiveContests] = useState<Contest[]>([])
  const [isScanning, setIsScanning] = useState(true)
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
    } catch (_) {
      setIsScanning(false)
      setIsFinished(true)
      return
    }

    const toProcess = rawItems.filter((c) => c.id !== '__offline_alert__')
    let nextIndex = 0
    const collected: Contest[] = []

    const processOne = async (): Promise<void> => {
      while (nextIndex < toProcess.length && !abortRef.current) {
        const i = nextIndex
        nextIndex += 1
        const contest = toProcess[i]
        if (!contest) continue
        try {
          const enriched = await enrichContest(contest)
          if (abortRef.current) return

          const expired =
            enriched.expiryDate != null &&
            (() => {
              const end = toExpiryEndOfDay(enriched.expiryDate!)
              return !Number.isNaN(end.getTime()) && end <= new Date()
            })()
          if (expired) return
          if (enriched.linkStatus === 404) return

          collected.push(enriched)
        } catch (_) {
          // skip failed enrichment
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => processOne()))

    if (!abortRef.current) {
      const sorted = [...collected].sort((a, b) => {
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
    isFinished,
    offlineMode,
    phaseMessage,
    refetch,
  }
}
