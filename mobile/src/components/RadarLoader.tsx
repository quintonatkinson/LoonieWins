import { View, Text } from 'react-native'

interface RadarLoaderProps {
  phaseMessage: string
  liveCount: number
  mini?: boolean
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
      <View className="items-center gap-2 py-3 px-4">
        <View className="flex-row items-center justify-center gap-3">
          <View className="h-4 w-4 rounded-full bg-win/60" />
          <Text className="text-sm text-gray-400">{phaseMessage}</Text>
          <Text className="text-sm text-gray-400">Found {liveCount} live contests...</Text>
        </View>
        {pct != null && (
          <View className="h-1 w-48 overflow-hidden rounded-full bg-gray-700/80">
            <View className="h-full rounded-full bg-win/70" style={{ width: `${pct}%` }} />
          </View>
        )}
      </View>
    )
  }

  return (
    <View className="min-h-[40vh] items-center justify-center gap-6 px-4">
      <View className="h-12 w-12 rounded-full bg-win/40" />
      <Text className="text-center text-lg text-gray-300">{phaseMessage}</Text>
      <Text className="text-center text-sm text-gray-500">Found {liveCount} live contests...</Text>
      {pct != null && (
        <View className="w-56 gap-1">
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700/80">
            <View className="h-full rounded-full bg-win/80" style={{ width: `${pct}%` }} />
          </View>
          <Text className="text-center text-xs text-gray-500">{pct}%</Text>
        </View>
      )}
    </View>
  )
}
