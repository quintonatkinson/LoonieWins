import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import type { Contest } from '../lib/rssFetcher'
import { useUserLimits } from '../hooks/useUserLimits'
import CountdownTimer from './CountdownTimer'
import { daysLeftUntilExpiry } from '../lib/utils/expiryDate'
import {
  getRequirementBadges,
  hasCostlyRequirement,
} from '../lib/utils/requirementBadges'

interface ContestCardProps {
  contest: Contest
  onOpenOverlay: (contest: Contest) => void
  onOneTapEnter?: (contest: Contest) => void
  onShare?: (contest: Contest) => void
  onPressUrl?: (url: string) => void
  variant: 'routine' | 'feed' | 'ended'
  daysLeft?: number | null
  entered?: boolean
}

export default function ContestCard({
  contest,
  onOpenOverlay,
  onOneTapEnter,
  onShare,
  onPressUrl,
  variant,
  daysLeft: daysLeftProp,
  entered = false,
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

  const daysLeft = daysLeftProp ?? daysLeftUntilExpiry(contest.expiryDate)
  const reqBadges = getRequirementBadges(contest)
  const costly = hasCostlyRequirement(contest)

  const openEntry = useCallback(() => {
    if (onOneTapEnter) {
      onOneTapEnter(contest)
      return
    }
    onOpenOverlay(contest)
  }, [contest, onOneTapEnter, onOpenOverlay])

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
      openEntry()
      return
    }
    if (canEnterFree) {
      // Open first so guest/demo never blocks on bookkeeping
      openEntry()
      try {
        void useFreeEntry()
      } catch (_) {}
      return
    }
    if (weeklyLimitReached && userIsFree) {
      if (balance >= entryCostPts && spendPointsForEntry()) {
        openEntry()
      }
      return
    }
    openEntry()
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
    openEntry,
    onPressUrl,
  ])

  const showUnlock =
    contest.id !== '__offline_alert__' && weeklyLimitReached && userIsFree && !hasUnlimitedEntries

  const isLocked = contest.isLocked === true
  const elig = contest.eligibility ?? 'Unknown'
  const eligDisplay =
    elig === 'CA' ? '🍁' : elig === 'US' ? '🇺🇸' : elig === 'NA' ? '🌎' : '🍁'
  const eligUnverified = contest.eligibilityUnverified ?? false

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

  const badgeTone = (costlyBadge: boolean, kind: string) => {
    if (kind === 'purchase') return { bg: 'bg-amber-500/25', text: 'text-amber-300', border: 'border-amber-500/50' }
    if (costlyBadge) return { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40' }
    if (kind === 'easy') return { bg: 'bg-win/20', text: 'text-win', border: 'border-win/40' }
    return { bg: 'bg-gray-600/50', text: 'text-gray-300', border: 'border-gray-500/50' }
  }

  if (variant === 'routine') {
    return (
      <View className="shrink-0 w-52 rounded-xl bg-surface border border-gray-600/50 p-4 mr-3">
        <TouchableOpacity onPress={handleEnter} activeOpacity={0.8}>
          <View className="flex-row flex-wrap gap-1 mb-2">
            {costly && (
              <View className="rounded px-1.5 py-0.5 bg-amber-500/25 border border-amber-500/50">
                <Text className="text-[10px] font-semibold text-amber-300">🧾 Purchase</Text>
              </View>
            )}
            {contest.expiryDate ? <CountdownTimer targetDate={contest.expiryDate} /> : null}
          </View>
          <Text className="font-semibold text-gray-50 text-sm leading-tight" numberOfLines={2}>
            {contest.title}
          </Text>
          <View
            className={`mt-3 w-full py-2.5 rounded-lg ${showUnlock ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-win'}`}
          >
            <Text
              className={`text-center font-semibold text-sm ${showUnlock ? 'text-amber-400' : 'text-gray-900'}`}
            >
              {showUnlock ? `UNLOCK (${entryCostPts} Pts)` : isLocked ? 'View on RFD' : 'Enter'}
            </Text>
          </View>
        </TouchableOpacity>
        <View className="flex-row gap-2 mt-2">
          <TouchableOpacity
            onPress={() => onOpenOverlay(contest)}
            className="flex-1 py-1.5 rounded-lg border border-gray-600/50"
          >
            <Text className="text-center text-[11px] text-gray-400">Smart-Fill</Text>
          </TouchableOpacity>
          {onShare && (
            <TouchableOpacity
              onPress={() => onShare(contest)}
              className="flex-1 py-1.5 rounded-lg border border-gray-600/50"
            >
              <Text className="text-center text-[11px] text-gray-400">Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className="rounded-xl bg-surface border border-gray-600/50 px-4 py-3 flex-row items-center gap-3 mx-4 mb-2">
      <View className="flex-1 min-w-0">
        <View className="flex-row flex-wrap items-center gap-2">
          {entered && (
            <View className="rounded px-1.5 py-0.5 bg-win/20 border border-win/30">
              <Text className="text-[10px] font-semibold text-win uppercase">Entered</Text>
            </View>
          )}
          {reqBadges
            .filter((b) => b.costly)
            .map((b) => {
              const tone = badgeTone(b.costly, b.kind)
              return (
                <View key={b.kind} className={`rounded px-1.5 py-0.5 border ${tone.bg} ${tone.border}`}>
                  <Text className={`text-[10px] font-semibold ${tone.text}`}>
                    {b.icon} {b.kind === 'purchase' ? 'Purchase' : b.label}
                  </Text>
                </View>
              )
            })}
        </View>
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
            <Text className="text-gray-400 text-xs">🕐 {daysLeft}d left</Text>
          ) : null}
          <View
            className={`rounded-full px-2 py-0.5 ${
              elig === 'US'
                ? 'bg-red-500/20 border border-red-500/40'
                : eligUnverified
                  ? 'bg-amber-500/20 border border-amber-500/40'
                  : 'bg-gray-600/50'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                elig === 'US' ? 'text-red-400' : eligUnverified ? 'text-amber-400' : 'text-gray-400'
              }`}
            >
              {eligDisplay}
              {eligUnverified ? ' ?' : ''}
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-1.5 mt-2">
          {isLocked && (
            <View className="rounded-full px-2 py-0.5 bg-amber-500/20 border border-amber-500/40">
              <Text className="text-amber-400 text-xs font-medium">🔒 RFD Account Required</Text>
            </View>
          )}
          {reqBadges.map((b) => {
            const tone = badgeTone(b.costly, b.kind)
            return (
              <View key={b.kind} className={`rounded-full px-2 py-0.5 border ${tone.bg} ${tone.border}`}>
                <Text className={`text-xs font-medium ${tone.text}`}>
                  {b.icon} {b.label}
                </Text>
              </View>
            )
          })}
          {onShare && variant !== 'ended' && (
            <TouchableOpacity onPress={() => onShare(contest)}>
              <View className="rounded-full px-2 py-0.5 bg-gray-600/40 border border-gray-500/40">
                <Text className="text-gray-300 text-xs font-medium">Share</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={handleEnter}
        className={`shrink-0 px-5 py-2.5 rounded-lg ${
          variant === 'ended' ? 'bg-gray-600' : showUnlock ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-win'
        }`}
        activeOpacity={0.8}
      >
        <Text
          className={`font-semibold text-sm ${
            variant === 'ended' ? 'text-gray-400' : showUnlock ? 'text-amber-400' : 'text-gray-900'
          }`}
        >
          {variant === 'ended' ? 'Ended' : showUnlock ? `UNLOCK (${entryCostPts} Pts)` : isLocked ? 'View on RFD' : 'Enter'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
