import { View, Text } from 'react-native'

interface FeedWarmupSkeletonProps {
  phaseMessage: string
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
    <View className="px-4 py-2 gap-4" accessibilityRole="progressbar">
      <View className="rounded-xl border border-gray-600/40 bg-surface/80 px-4 py-3 gap-2">
        <View className="flex-row items-center gap-3">
          <View className="h-3 w-3 rounded-full bg-win/70" />
          <Text className="text-sm font-medium text-gray-200 flex-1">{phaseMessage}</Text>
        </View>
        {pct != null ? (
          <View className="gap-1">
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700/80">
              <View className="h-full rounded-full bg-win/80" style={{ width: `${pct}%` }} />
            </View>
            <Text className="text-xs text-gray-500">
              {liveCount > 0 ? `${liveCount} live so far · ` : ''}
              {pct}% enriched
            </Text>
          </View>
        ) : (
          <Text className="text-xs text-gray-500">Pulling contest feeds…</Text>
        )}
      </View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} className="flex-row gap-3 rounded-xl border border-gray-700/40 bg-surface/50 p-3">
          <View className="h-14 w-14 rounded-lg bg-gray-700/60" />
          <View className="flex-1 gap-2 py-0.5">
            <View className="h-3 w-4/5 rounded bg-gray-700/60" />
            <View className="h-2.5 w-2/5 rounded bg-gray-700/40" />
            <View className="mt-1 h-2 w-1/3 rounded bg-gray-700/30" />
          </View>
        </View>
      ))}
    </View>
  )
}
