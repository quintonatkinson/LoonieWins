export type GeoFilterValue = 'CA' | 'US' | 'ANY'

interface CountryToggleProps {
  value: GeoFilterValue
  onChange: (val: GeoFilterValue) => void
}

const OPTIONS: { value: GeoFilterValue; label: string; emoji: string; hint: string }[] = [
  { value: 'CA', label: 'Canada', emoji: '🇨🇦', hint: 'Canada-only and open-to-both' },
  { value: 'US', label: 'US', emoji: '🇺🇸', hint: 'United States and open-to-both' },
  { value: 'ANY', label: 'All', emoji: '🌐', hint: 'Show every region' },
]

export default function CountryToggle({ value, onChange }: CountryToggleProps) {
  return (
    <div
      className="inline-flex rounded-full bg-surface border border-gray-600/50 p-1"
      role="group"
      aria-label="Filter giveaways by country eligibility"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.hint}
          className={`flex-1 min-w-0 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors ${
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
