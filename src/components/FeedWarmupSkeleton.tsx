/**
 * Home warm-up placeholders while RSS / enrich fills the Opportunity List.
 */

interface FeedWarmupSkeletonProps {
  phaseMessage: string
  /** 0–100 enrich progress; omit while still fetching raw feeds */
  progress?: number
  liveCount?: number
  rows?: number
}

export default function FeedWarmupSkeleton({
  phaseMessage,
  progress,
  liveCount = 0,
  rows = 6,
}: FeedWarmupSkeletonProps) {
  const pct = progress != null ? Math.max(0, Math.min(100, Math.round(progress))) : null

  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <div className="rounded-xl border border-gray-600/40 bg-surface/80 px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-win/70" aria-hidden />
          <p className="text-sm font-medium text-gray-200">{phaseMessage}</p>
        </div>
        {pct != null ? (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700/80">
              <div
                className="h-full rounded-full bg-win/80 transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {liveCount > 0 ? `${liveCount} live so far · ` : ''}
              {pct}% enriched
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Pulling contest feeds…</p>
        )}
      </div>
      <ul className="space-y-2" aria-hidden>
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-gray-700/40 bg-surface/50 p-3 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="h-14 w-14 shrink-0 rounded-lg bg-gray-700/60" />
            <span className="flex flex-1 flex-col gap-2 py-0.5">
              <span className="h-3 w-[85%] rounded bg-gray-700/60" />
              <span className="h-2.5 w-[40%] rounded bg-gray-700/40" />
              <span className="mt-1 h-2 w-[30%] rounded bg-gray-700/30" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
