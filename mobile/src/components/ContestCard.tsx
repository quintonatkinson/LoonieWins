import { useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import type { Contest } from '../lib/rssFetcher'
import { useUserLimits } from '../hooks/useUserLimits'
import CountdownTimer from './CountdownTimer'

interface ContestCardProps {
  contest: Contest
  onOpenOverlay: (contest: Contest) => void
  onPressUrl?: (url: string) => void
  variant: 'routine' | 'feed' | 'ended'
  daysLeft?: number | null
}

const reqLabels: Record<string, string> = {
  'Purchase Required': 'Purchase Required',
  'Social Action': 'Social Follow',
  'App Download': 'App Download',
  'Creative Submission': 'Photo Needed',
  'Newsletter Signup': 'Newsletter',
}

export default function ContestCard({
  contest,
  onOpenOverlay,
  onPressUrl,
  variant,
  daysLeft: daysLeftProp,
}: ContestCardProps) {
  const {
    weeklyLimitReached,
    userIsFree,
    canEnterFree,
    hasUnlimitedEntries,
    balance,
    entryCostPts,
    spendPointsForEntry,
    useFreeEntry,
  } = useUserLimits()

  const daysLeft =
    daysLeftProp ??
    (contest.expiryDate
      ? Math.max(0, Math.ceil((new Date(contest.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null)

  const handleEnter = useCallback(() => {
    if (contest.id === '__offline_alert__') return
    if (variant === 'ended') {
      onPressUrl?.(contest.url)
      return
    }
    if (contest.isLocked) {
      onPressUrl?.(contest.url)
      return
    }
    if (hasUnlimitedEntries) {
      onOpenOverlay(contest)
      return
    }
    if (canEnterFree) {
      onOpenOverlay(contest)
      void useFreeEntry()
      return
    }
    if (weeklyLimitReached && userIsFree) {
      if (balance >= entryCostPts && spendPointsForEntry()) {
        onOpenOverlay(contest)
      }
    }
  }, [
    contest,
    variant,
    hasUnlimitedEntries,
    canEnterFree,
    weeklyLimitReached,
    userIsFree,
    balance,
    entryCostPts,
    spendPointsForEntry,
    useFreeEntry,
    onOpenOverlay,
    onPressUrl,
  ])

  const showUnlock =
    contest.id !== '__offline_alert__' && weeklyLimitReached && userIsFree && !hasUnlimitedEntries

  const isLocked = contest.isLocked === true
  const elig = contest.eligibility ?? 'Unknown'
  const eligDisplay =
    elig === 'CA' ? '🍁' : elig === 'US' ? '🇺🇸' : elig === 'NA' ? '🌎' : '🍁'
  const eligUnverified = contest.eligibilityUnverified ?? false
  const reqs = contest.requirements ?? []

  if (contest.id === '__offline_alert__') {
    if (variant === 'routine') return null
    return (
      <View className="rounded-xl bg-surface border border-gray-600/50 px-4 py-3 flex-row items-center">
        <Text className="flex-1 font-semibold text-gray-50 text-sm" numberOfLines={2}>
          {contest.title}
        </Text>
      </View>
    )
  }

  const renderButton = () => {
    if (variant === 'ended') {
      return (
        <TouchableOpacity
          onPress={handleEnter}
          className="shrink-0 px-5 py-2.5 rounded-lg bg-gray-600"
          activeOpacity={0.8}
        >
          <Text className="text-gray-400 font-semibold text-sm">Ended</Text>
        </TouchableOpacity>
      )
    }
    if (showUnlock) {
      return (
        <TouchableOpacity
          onPress={handleEnter}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40"
          activeOpacity={0.8}
        >
          <Text className="text-amber-400 font-semibold text-sm">UNLOCK ({entryCostPts} Pts)</Text>
        </TouchableOpacity>
      )
    }
    return (
      <TouchableOpacity
        onPress={handleEnter}
        className="shrink-0 px-5 py-2.5 rounded-lg bg-win"
        activeOpacity={0.8}
      >
        <Text className="text-gray-900 font-semibold text-sm">{isLocked ? 'View on RFD' : 'Enter'}</Text>
      </TouchableOpacity>
    )
  }

  if (variant === 'routine') {
    return (
      <TouchableOpacity
        onPress={handleEnter}
        className="shrink-0 w-52 rounded-xl bg-surface border border-gray-600/50 p-4"
        activeOpacity={0.8}
      >
        <Text className="font-semibold text-gray-50 text-sm leading-tight" numberOfLines={2}>
          {contest.title}
        </Text>
        <View
          className={`mt-auto mt-3 w-full py-2.5 rounded-lg ${showUnlock ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-win'}`}
        >
          <Text
            className={`text-center font-semibold text-sm ${showUnlock ? 'text-amber-400' : 'text-gray-900'}`}
          >
            {variant === 'ended' ? 'Ended' : showUnlock ? `UNLOCK (${entryCostPts} Pts)` : isLocked ? 'View on RFD' : 'Enter'}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View className="rounded-xl bg-surface border border-gray-600/50 px-4 py-3 flex-row items-center gap-3">
      <View className="flex-1 min-w-0">
        <Text className="text-xs text-gray-500 font-medium">Single</Text>
        <Text className="font-semibold text-gray-50 text-sm mt-0.5" numberOfLines={2}>
          {contest.title}
        </Text>
        <View className="flex-row flex-wrap items-center gap-3 mt-1">
          {contest.prizeValue != null && (
            <View className="flex-row">
              <Text className="text-win text-xs">$</Text>
              <Text className="text-gray-300 text-xs">{contest.prizeValue.toLocaleString()}</Text>
            </View>
          )}
          {contest.expiryDate ? (
            <CountdownTimer targetDate={contest.expiryDate} />
          ) : daysLeft != null ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-gray-400">🕐</Text>
              <Text className="text-gray-400 text-xs">{daysLeft}d left</Text>
            </View>
          ) : null}
          <View
            className={`rounded-full px-2 py-0.5 ${
              elig === 'US' ? 'bg-red-500/20 border border-red-500/40' :
              eligUnverified ? 'bg-amber-500/20 border border-amber-500/40' :
              'bg-gray-600/50'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                elig === 'US' ? 'text-red-400' : eligUnverified ? 'text-amber-400' : 'text-gray-400'
              }`}
            >
              {eligDisplay}{eligUnverified ? ' ?' : ''}
            </Text>
          </View>
          {contest.source && (
            <Text className="text-gray-400 text-xs">{contest.source.replace(/\s*\([^)]*\)/g, '')}</Text>
          )}
        </View>
        <View className="flex-row flex-wrap gap-1.5 mt-2">
          {isLocked && (
            <View className="rounded-full px-2 py-0.5 bg-amber-500/20 border border-amber-500/40">
              <Text className="text-amber-400 text-xs font-medium">🔒 RFD Account Required</Text>
            </View>
          )}
          {reqs.length === 0 ? (
            <View className="rounded-full px-2 py-0.5 bg-win/20 border border-win/40">
              <Text className="text-win text-xs font-medium">Easy Entry</Text>
            </View>
          ) : (
            reqs.map((r) => {
              const label = reqLabels[r] ?? r
              const icon = r === 'Purchase Required' ? '🧾' : r === 'Social Action' ? '📱' : r === 'Creative Submission' ? '📸' : r === 'App Download' ? '📲' : r === 'Newsletter Signup' ? '📧' : ''
              return (
                <View key={r} className="rounded-full px-2 py-0.5 bg-gray-600/50 border border-gray-500/50">
                  <Text className="text-gray-300 text-xs font-medium">{icon ? `${icon} ` : ''}{label}</Text>
                </View>
              )
            })
          )}
        </View>
      </View>
      {renderButton()}
    </View>
  )
}
