import { useMemo, useState } from 'react'
import { AlertTriangle, Inbox, Megaphone, Sparkles } from 'lucide-react'
import type { InboxShieldPrefs, InboxShieldTab } from '../lib/inboxShield/types'
import {
  PLANNED_GMAIL_RULES,
  filterItemsByTab,
  placeholderInboxItems,
  suggestPlusAddress,
} from '../lib/inboxShield/rulesEngine'

const TABS: { id: InboxShieldTab; label: string; icon: typeof Inbox }[] = [
  { id: 'primary', label: 'Primary wins & confirmations', icon: Sparkles },
  { id: 'promotions', label: 'Promotions & newsletters', icon: Megaphone },
  { id: 'spam', label: 'Likely spam', icon: AlertTriangle },
]

interface InboxShieldPanelProps {
  prefs: InboxShieldPrefs
  onOpenConsent?: () => void
}

export default function InboxShieldPanel({ prefs, onOpenConsent }: InboxShieldPanelProps) {
  const [tab, setTab] = useState<InboxShieldTab>('primary')

  const items = useMemo(
    () => placeholderInboxItems(prefs.entry_email_for_giveaways),
    [prefs.entry_email_for_giveaways]
  )
  const visible = filterItemsByTab(items, tab)
  const plusTip = suggestPlusAddress(prefs.entry_email_for_giveaways)

  return (
    <div className="space-y-4" data-testid="inbox-shield-panel">
      <div className="rounded-xl bg-gray-800/80 border border-gray-600/50 p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
        <p className="text-sm text-white mt-1">
          {prefs.inbox_shield_enabled
            ? 'Inbox Shield enabled (local rules — preview mode)'
            : prefs.consent_status === 'skipped'
              ? 'Skipped — turn on anytime'
              : 'Not enabled yet'}
        </p>
        {prefs.entry_email_for_giveaways ? (
          <p className="text-xs text-gray-400 mt-1">
            Entry email:{' '}
            <span className="text-gray-200">{prefs.entry_email_for_giveaways}</span>
          </p>
        ) : (
          <p className="text-xs text-amber-400/90 mt-1">Add an entry email to track confirmations.</p>
        )}
        {plusTip && (
          <p className="text-[11px] text-gray-500 mt-2">
            Plus-address idea: <code className="text-win/90">{plusTip}</code>
          </p>
        )}
        {!prefs.inbox_shield_enabled && onOpenConsent && (
          <button
            type="button"
            onClick={onOpenConsent}
            className="mt-3 text-sm text-win font-medium hover:underline"
          >
            Review email permission…
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? 'bg-win/15 border-win/40 text-win'
                  : 'border-gray-600/50 text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="max-w-[9rem] sm:max-w-none text-left">{label}</span>
            </button>
          )
        })}
      </div>

      <ul className="rounded-xl border border-gray-600/50 divide-y divide-gray-600/40 bg-gray-800/60 overflow-hidden">
        {visible.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-gray-500">
            Nothing in this tab yet. When Gmail connects, matching mail appears here.
          </li>
        ) : (
          visible.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-white line-clamp-1">{m.subject}</p>
                {m.isPlaceholder && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
                    Preview
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{m.from}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{m.preview}</p>
            </li>
          ))
        )}
      </ul>

      <p className="text-[11px] text-gray-500">
        Preview messages show how our rules engine will sort mail. We do not read your real inbox
        until Google OAuth is connected.
      </p>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Rules (stub — Gmail filters in Phase 2)
        </h3>
        <ul className="space-y-2">
          {PLANNED_GMAIL_RULES.map((rule) => (
            <li
              key={rule.id}
              className="rounded-lg border border-gray-600/40 bg-gray-900/50 px-3 py-2.5"
            >
              <p className="text-sm text-white font-medium">{rule.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
              <p className="text-[11px] text-win/80 mt-1">{rule.gmailAction}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
