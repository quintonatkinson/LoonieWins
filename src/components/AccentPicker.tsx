import { Check } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import type { AccentId } from '../lib/themes'

export default function AccentPicker() {
  const { accentId, themes, setAccentId } = useTheme()

  return (
    <div>
      <p className="text-sm font-medium text-white mb-1">App accent</p>
      <p className="text-xs text-gray-500 mb-3">
        Buttons, highlights, and active states. Default stays Neon Green until you pick another.
      </p>
      <div
        className="flex flex-wrap gap-3"
        role="radiogroup"
        aria-label="App accent color"
      >
        {themes.map((t) => {
          const selected = t.id === accentId
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t.name}
              title={t.name}
              onClick={() => setAccentId(t.id as AccentId)}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors ${
                selected ? 'bg-white/10 ring-2 ring-win' : 'hover:bg-white/5'
              }`}
            >
              <span
                className="h-10 w-10 rounded-full border-2 border-white/20 shadow-inner"
                style={{ backgroundColor: t.win }}
                aria-hidden
              />
              {selected && (
                <span
                  className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-win"
                  aria-hidden
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span className="text-[11px] text-gray-400">{t.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
