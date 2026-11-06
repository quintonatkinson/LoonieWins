import { View, Text, TouchableOpacity } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'
import type { AccentId } from '../lib/themes'

export default function AccentPicker() {
  const { accentId, themes, setAccentId } = useTheme()

  return (
    <View className="rounded-xl bg-surface border border-gray-600/50 p-4">
      <Text className="text-sm font-medium text-white mb-1">App accent</Text>
      <Text className="text-xs text-gray-500 mb-3">
        Buttons and highlights. Neon Green stays default until you pick another.
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {themes.map((t) => {
          const selected = t.id === accentId
          return (
            <TouchableOpacity
              key={t.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t.name}
              onPress={() => setAccentId(t.id as AccentId)}
              className={`items-center rounded-xl p-2 ${selected ? 'bg-gray-700/80' : ''}`}
              style={
                selected
                  ? { borderWidth: 2, borderColor: t.win }
                  : { borderWidth: 2, borderColor: 'transparent' }
              }
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: t.win,
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              />
              <Text className="text-gray-400 text-[11px] mt-1.5">{t.name}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}
