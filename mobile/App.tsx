import './global.css'
import { useState, useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { Linking } from 'react-native'
import type { Contest } from './src/lib/rssFetcher'
import { resolveContestUrl } from './src/lib/rssFetcher'
import { UserEarnProvider } from './src/contexts/UserEarnContext'
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext'
import Dashboard from './src/screens/Dashboard'
import ContestBrowser from './src/screens/ContestBrowser'

function AppContent() {
  const { accentColor } = useTheme()
  const [overlayContest, setOverlayContest] = useState<Contest | null>(null)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

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

  return (
    <View className="flex-1 bg-gray-900">
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
          <ActivityIndicator size="large" color={accentColor} />
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
    <ThemeProvider>
      <UserEarnProvider>
        <AppContent />
      </UserEarnProvider>
    </ThemeProvider>
  )
}
