interface RadarLoaderProps {
  phaseMessage: string
  liveCount: number
  mini?: boolean
}

export default function RadarLoader({ phaseMessage, liveCount, mini = false }: RadarLoaderProps) {
  if (mini) {
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-4 text-sm text-gray-400">
        <span className="h-4 w-4 animate-pulse rounded-full bg-win/60" aria-hidden />
        <span>{phaseMessage}</span>
        <span>Found {liveCount} live contests...</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <span
        className="h-12 w-12 animate-pulse rounded-full bg-win/40"
        aria-hidden
      />
      <p className="text-center text-lg text-gray-300">{phaseMessage}</p>
      <p className="text-center text-sm text-gray-500">
        Found {liveCount} live contests...
      </p>
    </div>
  )
}
