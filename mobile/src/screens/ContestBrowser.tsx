import { useCallback, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { getInjectionScript } from '../lib/autofill/assassin'
import type { AutoFillData } from '../types/profile'
import type { Contest } from '../lib/rssFetcher'
import CountdownTimer from '../components/CountdownTimer'
import { getRequirementBadges } from '../lib/utils/requirementBadges'
import { shareContest } from '../lib/utils/shareContest'

interface ContestBrowserProps {
  url: string
  contest?: Contest | null
  onClose: () => void
  onMarkEntered?: (contest: Contest, status?: 'entered' | 'submitted') => void
  autoFillData?: AutoFillData
  autoMarkOnClose?: boolean
}

const DEFAULT_AUTOFILL: AutoFillData = {
  name: '',
  email: '',
  address: '',
}

export default function ContestBrowser({
  url,
  contest,
  onClose,
  onMarkEntered,
  autoFillData = DEFAULT_AUTOFILL,
  autoMarkOnClose = true,
}: ContestBrowserProps) {
  const script = getInjectionScript(autoFillData)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const reqBadges = contest ? getRequirementBadges(contest) : []

  const handleClose = useCallback(() => {
    if (autoMarkOnClose && contest && onMarkEntered) {
      onMarkEntered(contest, 'entered')
    }
    onClose()
  }, [autoMarkOnClose, contest, onMarkEntered, onClose])

  const handleShare = useCallback(async () => {
    if (!contest) return
    const result = await shareContest(contest)
    setShareMsg(result === 'shared' ? 'Shared' : 'Could not share')
    setTimeout(() => setShareMsg(null), 2000)
  }, [contest])

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-gray-900">
        <View className="px-4 py-3 border-b border-gray-700/50 bg-surface">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={handleClose} className="px-3 py-2" activeOpacity={0.7}>
              <Text className="text-win font-semibold">
                {autoMarkOnClose ? 'Done · Mark entered' : 'Close'}
              </Text>
            </TouchableOpacity>
            {contest && (
              <TouchableOpacity onPress={() => void handleShare()} className="px-3 py-2">
                <Text className="text-gray-300 font-medium text-sm">Share</Text>
              </TouchableOpacity>
            )}
          </View>
          {contest && (
            <View className="mt-2">
              <Text className="text-gray-50 font-semibold text-sm" numberOfLines={2}>
                {contest.title}
              </Text>
              <View className="flex-row flex-wrap items-center gap-2 mt-1">
                {contest.expiryDate ? (
                  <CountdownTimer targetDate={contest.expiryDate} variant="detail" />
                ) : null}
                {contest.prizeValue != null && (
                  <Text className="text-win text-xs">${contest.prizeValue.toLocaleString()}</Text>
                )}
              </View>
              <View className="flex-row flex-wrap gap-1.5 mt-2">
                {reqBadges.map((b) => (
                  <View
                    key={b.kind}
                    className={`rounded-full px-2 py-0.5 border ${
                      b.kind === 'purchase'
                        ? 'bg-amber-500/25 border-amber-500/50'
                        : b.costly
                          ? 'bg-orange-500/20 border-orange-500/40'
                          : b.kind === 'easy'
                            ? 'bg-win/20 border-win/40'
                            : 'bg-gray-600/50 border-gray-500/50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        b.kind === 'purchase'
                          ? 'text-amber-300'
                          : b.costly
                            ? 'text-orange-300'
                            : b.kind === 'easy'
                              ? 'text-win'
                              : 'text-gray-300'
                      }`}
                    >
                      {b.icon} {b.label}
                    </Text>
                  </View>
                ))}
              </View>
              {shareMsg && <Text className="text-win text-xs mt-1">{shareMsg}</Text>}
            </View>
          )}
          {!contest && (
            <Text className="mt-1 text-gray-400 text-xs" numberOfLines={1}>
              {url}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <WebView
            source={{ uri: url }}
            javaScriptEnabled
            injectedJavaScript={script}
            startInLoadingState
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center bg-gray-900">
                <ActivityIndicator size="large" color="#39FF14" />
                <Text className="mt-3 text-gray-400">Loading contest…</Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  )
}
