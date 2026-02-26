import { useState, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { useUserEarn } from '../contexts/UserEarnContext'
import { ENTRY_COST_PTS } from '../hooks/useUserLimits'

type TimeKind = 'lightning' | 'clock' | 'game' | 'video'

interface TaskItem {
  id: string
  title: string
  reward: number
  timeLabel: string
  timeKind: TimeKind
  tag: string
}

const MOCK_TASKS: TaskItem[] = [
  { id: '1', title: 'Tech Opinion Panel', reward: 500, timeLabel: '3 Mins', timeKind: 'lightning', tag: 'Hot' },
  { id: '2', title: 'Grocery Habits Survey', reward: 1200, timeLabel: '15 Mins', timeKind: 'clock', tag: 'High Reward' },
  { id: '3', title: 'Quick Poll: Streaming', reward: 50, timeLabel: '30 Sec', timeKind: 'lightning', tag: 'Easy' },
  { id: '4', title: "Download 'Raid Legends'", reward: 2500, timeLabel: 'Game', timeKind: 'game', tag: 'Offer' },
  { id: '5', title: 'Watch Ad Video', reward: 25, timeLabel: '30 Sec', timeKind: 'video', tag: 'Video' },
]

const SIMULATE_MS = 2000

function TimeIcon({ kind }: { kind: TimeKind }) {
  if (kind === 'lightning') return <span className="text-amber-400" aria-hidden>⚡</span>
  if (kind === 'clock') return <span className="text-amber-400" aria-hidden>⏳</span>
  if (kind === 'game') return <span className="text-amber-400" aria-hidden>🎮</span>
  if (kind === 'video') return <span className="text-amber-400" aria-hidden>📺</span>
  return null
}

export default function Earn() {
  const { balance, addPoints } = useUserEarn()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [successTask, setSuccessTask] = useState<TaskItem | null>(null)

  const entriesFromBalance = Math.floor(balance / ENTRY_COST_PTS)

  const handleTaskClick = useCallback(
    (task: TaskItem) => {
      if (loadingId) return
      setLoadingId(task.id)
      setTimeout(() => {
        addPoints(task.reward)
        setSuccessTask(task)
        setLoadingId(null)
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } })
      }, SIMULATE_MS)
    },
    [addPoints, loadingId]
  )

  const closeSuccess = useCallback(() => setSuccessTask(null), [])

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header stats */}
      <div className="rounded-xl glass border border-amber-500/20 p-4">
        <p className="text-gray-300 text-sm">Your Balance</p>
        <p className="text-amber-400 font-bold text-2xl mt-1 flex items-center gap-2">
          <span aria-hidden>🪙</span>
          {balance.toLocaleString()} Pts
        </p>
        <p className="text-gray-400 text-sm mt-2">
          That&apos;s enough for <span className="text-amber-400 font-semibold">{entriesFromBalance} Contest Entries</span>!
        </p>
      </div>

      {/* Visible math */}
      <p className="text-center text-sm text-gray-400">
        1 Survey ≈ 2–3 Entries · 200 pts per extra entry
      </p>

      {/* Task board */}
      <section>
        <h2 className="text-base font-bold text-gray-50 mb-3">Task Board</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MOCK_TASKS.map((task) => (
            <button
              key={task.id}
              type="button"
              disabled={!!loadingId}
              onClick={() => handleTaskClick(task)}
              className="relative rounded-xl glass border border-amber-500/20 p-4 text-left flex flex-col gap-2 hover:border-amber-500/40 transition-colors disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-50 text-sm line-clamp-2">{task.title}</span>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {task.tag}
                </span>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-amber-400 font-bold text-sm">+{task.reward.toLocaleString()} Pts</span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <TimeIcon kind={task.timeKind} />
                  {task.timeLabel}
                </span>
              </div>
              {loadingId === task.id && (
                <div className="absolute inset-0 rounded-xl bg-gray-900/80 flex items-center justify-center" aria-busy>
                  <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Success modal */}
      {successTask && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={closeSuccess} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl glass border border-amber-500/30 p-6 text-center min-w-[240px]">
            <p className="text-2xl font-bold text-amber-400">Success!</p>
            <p className="text-gray-50 mt-1">+{successTask.reward.toLocaleString()} Pts</p>
            <button
              type="button"
              onClick={closeSuccess}
              className="mt-4 w-full py-2.5 rounded-lg bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  )
}
