import { useState, useEffect } from 'react'
import { Text, View } from 'react-native'
import { getMillisUntilExpiry } from '../lib/utils/expiryDate'

interface CountdownTimerProps {
  targetDate: string
}

const MS_24_HOURS = 24 * 60 * 60 * 1000
const MS_1_HOUR = 60 * 60 * 1000

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ended'
  const sec = Math.floor((ms / 1000) % 60)
  const min = Math.floor((ms / (1000 * 60)) % 60)
  const hour = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const day = Math.floor(ms / (1000 * 60 * 60 * 24))
  const parts: string[] = []
  if (day > 0) parts.push(`${day}d`)
  parts.push(`${hour}h`)
  parts.push(`${min}m`)
  parts.push(`${sec}s`)
  return parts.join(' ')
}

function colorClass(ms: number): string {
  if (ms <= 0) return 'text-red-500'
  if (ms < MS_1_HOUR) return 'text-red-400'
  if (ms < MS_24_HOURS) return 'text-orange-400'
  return 'text-gray-400'
}

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [ms, setMs] = useState(() => getMillisUntilExpiry(targetDate))

  useEffect(() => {
    setMs(getMillisUntilExpiry(targetDate))
    const id = setInterval(() => setMs(getMillisUntilExpiry(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const text = formatRemaining(ms)
  const cn = colorClass(ms)

  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-gray-400">🕐</Text>
      <Text className={`text-xs ${cn}`}>{text}</Text>
    </View>
  )
}
