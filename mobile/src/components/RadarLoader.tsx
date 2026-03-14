import { View, Text } from 'react-native'

interface RadarLoaderProps {
  phaseMessage: string
  liveCount: number
  mini?: boolean
}

export default function RadarLoader({ phaseMessage, liveCount, mini = false }: RadarLoaderProps) {
  if (mini) {
    return (
      <View className="flex-row items-center justify-center gap-3 py-3 px-4">
        <View className="h-4 w-4 rounded-full bg-win/60" />
        <Text className="text-sm text-gray-400">{phaseMessage}</Text>
        <Text className="text-sm text-gray-400">Found {liveCount} live contests...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-[60vh] items-center justify-center gap-6 px-4">
      <View className="h-12 w-12 rounded-full bg-win/40" />
      <Text className="text-center text-lg text-gray-300">{phaseMessage}</Text>
      <Text className="text-center text-sm text-gray-500">Found {liveCount} live contests...</Text>
    </View>
  )
}
