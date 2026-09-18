import './global.css'
import { useState, useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native'
import { Linking } from 'react-native'
import type { Contest } from './src/lib/rssFetcher'
import { resolveContestUrl } from './src/lib/rssFetcher'
import { UserEarnProvider } from './src/contexts/UserEarnContext'
import Dashboard from './src/screens/Dashboard'
import ContestBrowser from './src/screens/ContestBrowser'
import SettingsScreen from './src/screens/SettingsScreen'

function AppContent() {
  const [overlayContest, setOverlayContest] = useState<Contest | null>(null)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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
    Linking.openURL(url)
  }, [])

  const handleCloseOverlay = useCallback(() => {
    setOverlayContest(null)
    setResolvedUrl(null)
  }, [])

  const showBrowser = overlayContest && resolvedUrl

  if (showSettings) {
    return <SettingsScreen onClose={() => setShowSettings(false)} />
  }

  return (
    <View className="flex-1 bg-gray-900">
      <View
        style={{
          position: 'absolute',
          top: 52,
          right: 16,
          zIndex: 20,
        }}
      >
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
      <Dashboard onOpenOverlay={handleOpenOverlay} onPressUrl={handlePressUrl} />
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
          onClose={handleCloseOverlay}
        />
      )}
      <StatusBar style="light" />
    </View>
  )
}

export default function App() {
  return (
    <UserEarnProvider>
      <AppContent />
    </UserEarnProvider>
  )
}
