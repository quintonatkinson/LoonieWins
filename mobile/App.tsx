import './global.css'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, TouchableOpacity, Text, Linking } from 'react-native'
import type { Contest } from './src/lib/rssFetcher'
import { resolveContestUrl } from './src/lib/rssFetcher'
import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import { UserEarnProvider } from './src/contexts/UserEarnContext'
import { useContestEntries } from './src/hooks/useContestEntries'
import AuthScreen from './src/components/AuthScreen'
import Dashboard from './src/screens/Dashboard'
import ContestBrowser from './src/screens/ContestBrowser'
import SettingsScreen from './src/screens/SettingsScreen'
import { parseNotificationPrefs } from './src/lib/notifications/prefs'
import { registerForPushNotifications } from './src/lib/notifications/registerPush'
import type { AutoFillData } from './src/types/profile'

function AppContent() {
  const { session, loading, authReady, profile, user, updateProfile } = useAuth()
  const { enteredIds, markEntered } = useContestEntries()
  const [overlayContest, setOverlayContest] = useState<Contest | null>(null)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Register Expo push token when signed in and alerts are enabled
  useEffect(() => {
    if (!user?.id) return
    const prefs = parseNotificationPrefs(profile?.settings)
    if (!prefs.enabled) return
    void registerForPushNotifications(user.id).then((r) => {
      if (r.error && !r.token) {
        console.warn('[Push]', r.error)
      }
    })
  }, [user?.id, profile?.settings])

  const autoFillData: AutoFillData = useMemo(() => {
    const data = profile?.auto_fill_data ?? {}
    return {
      name: data.name || profile?.display_name || '',
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || profile?.email || '',
      address: data.address || '',
      phone: data.phone,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
    }
  }, [profile])

  const handleOpenOverlay = useCallback((contest: Contest) => {
    setOverlayContest(contest)
    setResolvedUrl(null)
    setResolving(true)
    resolveContestUrl(contest.url, contest.contentSnippet ?? contest.description)
      .then((url) => setResolvedUrl(url))
      .catch(() => setResolvedUrl(contest.url))
      .finally(() => setResolving(false))
  }, [])

  const handlePressUrl = useCallback((url: string) => {
    void Linking.openURL(url)
  }, [])

  const handleCloseOverlay = useCallback(() => {
    setOverlayContest(null)
    setResolvedUrl(null)
  }, [])

  const handleMarkEntered = useCallback(
    async (contest: Contest, status: 'entered' | 'submitted' = 'entered') => {
      await markEntered(contest, status)
    },
    [markEntered]
  )

  const handleAutoFillUsed = useCallback(() => {
    const remaining = profile?.smart_fills_remaining
    if (typeof remaining === 'number' && remaining > 0) {
      void updateProfile({ smart_fills_remaining: remaining - 1 })
    }
  }, [profile?.smart_fills_remaining, updateProfile])

  if (!authReady || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#39FF14" />
        <Text style={{ color: '#39FF14', marginTop: 12, fontWeight: '600' }}>Loading LoonieWins…</Text>
      </View>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  if (showSettings) {
    return <SettingsScreen onClose={() => setShowSettings(false)} />
  }

  const showBrowser = overlayContest && resolvedUrl

  return (
    <UserEarnProvider>
      <View className="flex-1 bg-gray-900">
        <View style={{ position: 'absolute', top: 52, right: 16, zIndex: 20 }}>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={{
              backgroundColor: '#1f2937',
              borderColor: '#4b5563',
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#39FF14', fontSize: 13, fontWeight: '600' }}>Settings</Text>
          </TouchableOpacity>
        </View>
        <Dashboard
          onOpenOverlay={handleOpenOverlay}
          onPressUrl={handlePressUrl}
          enteredIds={enteredIds}
        />
        {resolving && overlayContest && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <ActivityIndicator size="large" color="#39FF14" />
          </View>
        )}
        {showBrowser && (
          <ContestBrowser
            url={resolvedUrl}
            contest={overlayContest}
            onClose={handleCloseOverlay}
            autoFillData={autoFillData}
            onMarkEntered={handleMarkEntered}
            onAutoFillUsed={handleAutoFillUsed}
          />
        )}
        <StatusBar style="light" />
      </View>
    </UserEarnProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
