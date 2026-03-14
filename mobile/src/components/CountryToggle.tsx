import { View, Text, TouchableOpacity } from 'react-native'

export type GeoFilterValue = 'CA' | 'US' | 'ANY'

interface CountryToggleProps {
  value: GeoFilterValue
  onChange: (val: GeoFilterValue) => void
}

const OPTIONS: { value: GeoFilterValue; label: string; emoji: string }[] = [
  { value: 'CA', label: 'CA', emoji: '🇨🇦' },
  { value: 'US', label: 'US', emoji: '🇺🇸' },
  { value: 'ANY', label: 'ANY', emoji: '🌐' },
]

export default function CountryToggle({ value, onChange }: CountryToggleProps) {
  return (
    <View className="flex-row rounded-full bg-surface border border-gray-600/50 p-1">
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`flex-1 flex-row items-center justify-center px-4 py-2 rounded-full ${
            value === opt.value ? 'bg-gray-700' : ''
          }`}
          activeOpacity={0.7}
        >
          <Text className="mr-1.5 text-sm">{opt.emoji}</Text>
          <Text
            className={`text-sm font-medium ${
              value === opt.value ? 'text-gray-50' : 'text-gray-500'
            }`}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}
