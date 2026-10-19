interface RadarLoaderProps {
  phaseMessage: string
  liveCount: number
  mini?: boolean
  /** 0–100 when enriching; shown as a thin progress bar */
  progress?: number
}

export default function RadarLoader({
  phaseMessage,
  liveCount,
  mini = false,
  progress,
}: RadarLoaderProps) {
  const pct = progress != null ? Math.max(0, Math.min(100, Math.round(progress))) : null

  if (mini) {
    return (
      <div className="flex flex-col items-stretch gap-2 py-3 px-4 text-sm text-gray-400">
        <div className="flex items-center justify-center gap-3">
          <span className="h-4 w-4 animate-pulse rounded-full bg-win/60" aria-hidden />
          <span>{phaseMessage}</span>
          <span>Found {liveCount} live contests...</span>
        </div>
        {pct != null && (
          <div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-gray-700/80">
            <div
              className="h-full rounded-full bg-win/70 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 px-4">
      <span className="h-12 w-12 animate-pulse rounded-full bg-win/40" aria-hidden />
      <p className="text-center text-lg text-gray-300">{phaseMessage}</p>
      <p className="text-center text-sm text-gray-500">Found {liveCount} live contests...</p>
      {pct != null && (
        <div className="w-56 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700/80">
            <div
              className="h-full rounded-full bg-win/80 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-center text-xs text-gray-500">{pct}%</p>
        </div>
      )}
    </div>
  )
}
