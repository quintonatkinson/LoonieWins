import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchRawContests, enrichContest, type Contest } from '../lib/rssFetcher'
import { toExpiryEndOfDay } from '../lib/utils/expiryDate'

const PHRASES = [
  'Scanning feeds...',
  'Analyzing 150+ links...',
  'Filtering dead contests...',
  'Extracting odds...',
]

const CONCURRENCY = 5
const PHRASE_INTERVAL_MS = 2000

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
          if (enriched.eligibility === 'US') return

          setLiveContests((prev) => [...prev, enriched])
        } catch (_) {
          // skip failed enrichment
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => processOne()))

    if (!abortRef.current) {
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
