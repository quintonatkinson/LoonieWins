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
    <div className="inline-flex rounded-full bg-surface border border-gray-600/50 p-1" role="group" aria-label="Filter by country">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 min-w-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-gray-700 text-gray-50'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="mr-1.5" aria-hidden>{opt.emoji}</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
