import { useState, useEffect } from 'react'
import {
  countdownToneClass,
  getCountdownLabel,
  type CountdownLabel,
} from '../lib/utils/countdownLabel'

interface CountdownTimerProps {
  targetDate: string
  /** card = short urgency label; detail = label + live precise ticker */
  variant?: 'card' | 'detail'
}

export default function CountdownTimer({ targetDate, variant = 'card' }: CountdownTimerProps) {
  const [info, setInfo] = useState<CountdownLabel>(() => getCountdownLabel(targetDate))

  useEffect(() => {
    setInfo(getCountdownLabel(targetDate))
    const id = setInterval(() => {
      setInfo(getCountdownLabel(targetDate))
    }, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const className = countdownToneClass(info.urgency)
  const text = variant === 'detail' ? `${info.label} · ${info.precise}` : info.label

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${className} ${
        info.urgency === 'tonight' || info.urgency === 'critical'
          ? 'rounded-full px-2 py-0.5 bg-orange-500/15 border border-orange-500/30'
          : ''
      }`}
      role="timer"
      aria-live="polite"
      title={info.precise}
    >
      <span aria-hidden>🕐</span>
      {text}
    </span>
  )
}
