import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { getInjectionScript } from '../lib/autofill/assassin'
import type { AutoFillData } from '../types/profile'

interface ContestBrowserProps {
  url: string
  onClose: () => void
  autoFillData?: AutoFillData
}

const DEFAULT_AUTOFILL: AutoFillData = {
  name: 'John Doe',
  email: 'test@email.com',
  address: '123 Main St, Toronto ON',
}

export default function ContestBrowser({
  url,
  onClose,
  autoFillData = DEFAULT_AUTOFILL,
}: ContestBrowserProps) {
  const script = getInjectionScript(autoFillData)

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-gray-900">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-surface">
          <TouchableOpacity onPress={onClose} className="px-3 py-2" activeOpacity={0.7}>
            <Text className="text-win font-semibold">Close</Text>
          </TouchableOpacity>
          <Text className="flex-1 mx-3 text-gray-400 text-xs" numberOfLines={1}>
            {url}
          </Text>
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
