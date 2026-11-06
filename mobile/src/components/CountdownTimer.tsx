import { useState, useEffect } from 'react'
import { Text, View } from 'react-native'
import { getCountdownLabel, type CountdownLabel } from '../lib/utils/countdownLabel'

interface CountdownTimerProps {
  targetDate: string
  variant?: 'card' | 'detail'
}

function rnColor(urgency: CountdownLabel['urgency']): string {
  switch (urgency) {
    case 'ended':
      return '#ef4444'
    case 'critical':
      return '#f87171'
    case 'tonight':
      return '#fb923c'
    case 'soon':
      return '#fbbf24'
    case 'days':
      return '#9ca3af'
    default:
      return '#6b7280'
  }
}

export default function CountdownTimer({ targetDate, variant = 'card' }: CountdownTimerProps) {
  const [info, setInfo] = useState<CountdownLabel>(() => getCountdownLabel(targetDate))

  useEffect(() => {
    setInfo(getCountdownLabel(targetDate))
    const id = setInterval(() => setInfo(getCountdownLabel(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const text = variant === 'detail' ? `${info.label} · ${info.precise}` : info.label
  const color = rnColor(info.urgency)
  const urgent = info.urgency === 'tonight' || info.urgency === 'critical'

  return (
    <View
      className={
        urgent ? 'rounded-full px-2 py-0.5 border border-orange-500/30 bg-orange-500/15' : undefined
      }
    >
      <Text style={{ color, fontSize: 12, fontWeight: '500' }}>🕐 {text}</Text>
    </View>
  )
}
