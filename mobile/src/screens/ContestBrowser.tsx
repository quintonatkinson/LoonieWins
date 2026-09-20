import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Share,
  Platform,
} from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import {
  getInjectionScript,
  profileHasAutofill,
  type AutofillReport,
} from '../lib/autofill/assassin'
import type { AutoFillData } from '../types/profile'
import type { Contest } from '../lib/rssFetcher'

interface ContestBrowserProps {
  url: string
  contest?: Contest | null
  onClose: () => void
  autoFillData?: AutoFillData
  onMarkEntered?: (
    contest: Contest,
    status?: 'entered' | 'submitted'
  ) => void | Promise<unknown>
  onAutoFillUsed?: () => void
}

const DEFAULT_AUTOFILL: AutoFillData = {}

type BannerTone = 'info' | 'ok' | 'warn' | 'err'

function decodeTitle(title: string): string {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function copyText(value: string): Promise<boolean> {
  try {
    // Prefer Share sheet (works without extra clipboard deps on Expo).
    await Share.share(
      Platform.OS === 'ios'
        ? { message: value }
        : { message: value, title: 'LoonieWins autofill' }
    )
    return true
  } catch {
    return false
  }
}

function CheatSheetBar({ autoFillData }: { autoFillData: AutoFillData }) {
  const [copied, setCopied] = useState<string | null>(null)

  const chips = useMemo(() => {
    const first =
      autoFillData.firstName || autoFillData.name?.trim().split(/\s+/)[0] || ''
    const last =
      autoFillData.lastName ||
      autoFillData.name?.trim().split(/\s+/).slice(1).join(' ') ||
      ''
    const full =
      autoFillData.name || [first, last].filter(Boolean).join(' ') || ''
    return [
      { label: 'Name', value: full },
      { label: 'First', value: first },
      { label: 'Last', value: last },
      { label: 'Email', value: autoFillData.email ?? '' },
      { label: 'Phone', value: autoFillData.phone ?? '' },
      { label: 'Addr', value: autoFillData.address ?? '' },
      { label: 'City', value: autoFillData.city ?? '' },
      { label: 'Prov', value: autoFillData.province ?? '' },
      { label: 'Postal', value: autoFillData.postalCode ?? '' },
    ].filter((c) => c.value.trim().length > 0)
  }, [autoFillData])

  const onChip = useCallback(async (label: string, value: string) => {
    const ok = await copyText(value)
    if (ok) {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    }
  }, [])

  if (chips.length === 0) {
    return (
      <View className="px-3 py-2 border-t border-gray-700/50 bg-surface">
        <Text className="text-xs text-amber-300">
          No autofill fields set — add them in Profile / Settings.
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-t border-gray-700/50 bg-surface"
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
    >
      {chips.map(({ label, value }) => (
        <TouchableOpacity
          key={label}
          onPress={() => void onChip(label, value)}
          className={`px-3 py-2 rounded-full border ${
            copied === label
              ? 'bg-win/30 border-win/50'
              : 'bg-surface-light border-gray-600/50'
          }`}
          activeOpacity={0.7}
        >
          <Text
            className={`text-sm font-medium ${
              copied === label ? 'text-win' : 'text-gray-300'
            }`}
          >
            {copied === label ? 'Shared!' : `[${label}]`}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

function statusCopy(report: AutofillReport | null, hasProfile: boolean): {
  text: string
  tone: BannerTone
} | null {
  if (!hasProfile) {
    return {
      text: 'Set name & email in Profile so we can fill this contest form.',
      tone: 'warn',
    }
  }
  if (!report) return null
  switch (report.status) {
    case 'filled':
      return {
        text: `Autofill injected (${report.filled} field${report.filled === 1 ? '' : 's'}). Check values, finish any math questions, then mark entered.`,
        tone: 'ok',
      }
    case 'no_fields':
      return {
        text: 'No form fields found yet — wait for the page, tap Auto-Fill, or use copy chips.',
        tone: 'warn',
      }
    case 'no_match':
      return {
        text: 'Form found but fields didn’t match your profile. Use copy chips to paste.',
        tone: 'warn',
      }
    case 'empty_profile':
      return {
        text: 'Autofill profile is empty — add details in Profile first.',
        tone: 'warn',
      }
    case 'error':
      return {
        text: 'Autofill couldn’t run on this page. Use copy chips, then mark entered when done.',
        tone: 'err',
      }
    default:
      return null
  }
}

export default function ContestBrowser({
  url,
  contest = null,
  onClose,
  autoFillData = DEFAULT_AUTOFILL,
  onMarkEntered,
  onAutoFillUsed,
}: ContestBrowserProps) {
  const webRef = useRef<WebView>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [report, setReport] = useState<AutofillReport | null>(null)
  const [pendingMark, setPendingMark] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const usedFillRef = useRef(false)

  const hasProfile = profileHasAutofill(autoFillData)
  const script = useMemo(() => getInjectionScript(autoFillData), [autoFillData])
  const banner = statusCopy(report, hasProfile)

  const reinject = useCallback(() => {
    if (!hasProfile) {
      setReport({
        type: 'loonie_autofill',
        status: 'empty_profile',
        filled: 0,
        candidates: 0,
      })
      return
    }
    webRef.current?.injectJavaScript(
      `${getInjectionScript(autoFillData)}\ntrue;`
    )
  }, [autoFillData, hasProfile])

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as AutofillReport
        if (data?.type !== 'loonie_autofill') return
        setReport(data)
        if (data.status === 'filled' && !usedFillRef.current) {
          usedFillRef.current = true
          onAutoFillUsed?.()
        }
      } catch {
        /* ignore non-JSON page messages */
      }
    },
    [onAutoFillUsed]
  )

  const confirmMark = useCallback(
    async (status: 'entered' | 'submitted' = 'entered') => {
      if (!contest || !onMarkEntered) {
        onClose()
        return
      }
      await onMarkEntered(contest, status)
      setPendingMark(false)
      setStatusMsg(status === 'submitted' ? 'Marked as submitted' : 'Marked as entered')
      setTimeout(() => onClose(), 400)
    },
    [contest, onMarkEntered, onClose]
  )

  const requestClose = useCallback(() => {
    if (onMarkEntered && contest && !closing) {
      setClosing(true)
      setPendingMark(true)
      return
    }
    onClose()
  }, [onMarkEntered, contest, closing, onClose])

  const dismissPendingAndClose = useCallback(() => {
    setPendingMark(false)
    onClose()
  }, [onClose])

  const title = contest?.title ? decodeTitle(contest.title) : 'Contest'

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <View className="flex-1 bg-gray-900">
        <View className="flex-row items-center justify-between px-3 py-3 border-b border-gray-700/50 bg-surface gap-2">
          <TouchableOpacity onPress={requestClose} className="px-3 py-2" activeOpacity={0.7}>
            <Text className="text-win font-semibold">Close</Text>
          </TouchableOpacity>
          <View className="flex-1 min-w-0">
            <Text className="text-gray-100 text-sm font-medium" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-gray-500 text-[10px]" numberOfLines={1}>
              {url}
            </Text>
          </View>
          <TouchableOpacity
            onPress={reinject}
            className="px-3 py-2 rounded-lg bg-win"
            activeOpacity={0.8}
          >
            <Text className="text-gray-900 font-semibold text-xs">Auto-Fill</Text>
          </TouchableOpacity>
        </View>

        {(banner || loadError) && (
          <View
            className={`px-3 py-2 border-b border-gray-700/40 ${
              (loadError ? 'err' : banner?.tone) === 'ok'
                ? 'bg-win/10'
                : (loadError ? 'err' : banner?.tone) === 'err'
                  ? 'bg-red-500/15'
                  : 'bg-amber-500/10'
            }`}
          >
            <Text
              className={`text-xs ${
                (loadError ? 'err' : banner?.tone) === 'ok'
                  ? 'text-win'
                  : (loadError ? 'err' : banner?.tone) === 'err'
                    ? 'text-red-300'
                    : 'text-amber-200'
              }`}
            >
              {loadError
                ? `Page failed to load. Open externally if needed, then mark entered.`
                : banner?.text}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <WebView
            ref={webRef}
            source={{ uri: url }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            injectedJavaScript={script}
            onMessage={onMessage}
            onLoadStart={() => {
              setLoading(true)
              setLoadError(null)
            }}
            onLoadEnd={() => {
              setLoading(false)
              // Re-run after load for SPA shells that mount forms late
              setTimeout(() => reinject(), 400)
            }}
            onError={(e) => {
              setLoading(false)
              setLoadError(e.nativeEvent.description || 'load_error')
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 400) {
                setLoadError(`HTTP ${e.nativeEvent.statusCode}`)
              }
            }}
            startInLoadingState
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center bg-gray-900">
                <ActivityIndicator size="large" color="#39FF14" />
                <Text className="mt-3 text-gray-400">Loading contest…</Text>
              </View>
            )}
          />
          {loading && (
            <View className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60">
              <Text className="text-[10px] text-gray-300">Loading…</Text>
            </View>
          )}
        </View>

        <CheatSheetBar autoFillData={autoFillData} />

        <View className="px-3 py-3 border-t border-gray-700/50 bg-surface gap-2">
          {pendingMark && onMarkEntered && contest && (
            <View className="rounded-xl bg-win/15 border border-win/40 p-3 gap-2">
              <Text className="text-sm text-white font-medium">Did you finish entering?</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => void confirmMark('entered')}
                  className="flex-1 py-2.5 rounded-lg bg-win items-center"
                  activeOpacity={0.85}
                >
                  <Text className="text-gray-900 font-semibold text-sm">Yes — Mark Entered</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void confirmMark('submitted')}
                  className="flex-1 py-2.5 rounded-lg border border-win/40 items-center"
                  activeOpacity={0.85}
                >
                  <Text className="text-win font-medium text-sm">Submitted</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={dismissPendingAndClose} className="py-1 items-center">
                <Text className="text-xs text-white/50">Not yet — close anyway</Text>
              </TouchableOpacity>
            </View>
          )}

          {!pendingMark && onMarkEntered && contest && (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => void confirmMark('entered')}
                className="flex-1 py-2.5 rounded-lg bg-win items-center"
                activeOpacity={0.85}
              >
                <Text className="text-gray-900 font-semibold text-sm">Mark Entered</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void confirmMark('submitted')}
                className="flex-1 py-2.5 rounded-lg border border-gray-600/50 items-center"
                activeOpacity={0.85}
              >
                <Text className="text-win font-medium text-sm">Mark Submitted</Text>
              </TouchableOpacity>
            </View>
          )}

          {statusMsg && (
            <Text className="text-xs text-win" accessibilityRole="text">
              {statusMsg}
            </Text>
          )}

          <Text className="text-[10px] text-gray-500">
            Native WebView fills the real contest page (not a blocked iframe). Math /
            skill-test answers still need you.
          </Text>
        </View>
      </View>
    </Modal>
  )
}
