import { useState, useEffect } from 'react'
import {
  User,
  Trophy,
  Settings,
  Shield,
  Download,
  Trash2,
  Crown,
  ExternalLink,
  Check,
} from 'lucide-react'
import { useUserEarn } from '../contexts/UserEarnContext'
import SubscriptionModal from '../components/SubscriptionModal'
import type { AutoFillData } from '../types/profile'
import { loadAutoFillData, saveAutoFillData } from '../lib/utils/autoFillStorage'

const SMART_FILLS_REMAINING = 3 // from profile

const AUTO_FILL_FIELDS: { key: keyof AutoFillData; label: string }[] = [
  { key: 'name', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'province', label: 'Province' },
  { key: 'postalCode', label: 'Postal Code' },
]

export default function Profile() {
  const { subscriptionTier, setSubscriptionTier } = useUserEarn()
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [smartFillsRemaining] = useState(SMART_FILLS_REMAINING)
  const [autoFillData, setAutoFillData] = useState<AutoFillData>(loadAutoFillData)
  const [editingAutoFill, setEditingAutoFill] = useState(false)
  const [draftAutoFill, setDraftAutoFill] = useState<AutoFillData>(autoFillData)
  const [savedToast, setSavedToast] = useState(false)
  const [exportToast, setExportToast] = useState(false)
  const [prefsToast, setPrefsToast] = useState<string | null>(null)
  const [appliedContests] = useState<
    { id: string; title: string; enteredAt: string; prizeValue?: string; daysLeft?: number; ended?: boolean }[]
  >([
    { id: '1', title: 'Win a $5,000 Home Depot Gift Card', enteredAt: '2025-02-22', prizeValue: '$5K', daysLeft: 18 },
    { id: '2', title: 'Tech Bundle Giveaway', enteredAt: '2025-02-20', prizeValue: '$10K', daysLeft: 35 },
    { id: '3', title: 'Summer Vacation Draw', enteredAt: '2025-02-15', prizeValue: '$4.5K', ended: true },
  ])

  useEffect(() => {
    if (!savedToast) return
    const t = setTimeout(() => setSavedToast(false), 2500)
    return () => clearTimeout(t)
  }, [savedToast])

  useEffect(() => {
    if (!exportToast) return
    const t = setTimeout(() => setExportToast(false), 2500)
    return () => clearTimeout(t)
  }, [exportToast])

  useEffect(() => {
    if (!prefsToast) return
    const t = setTimeout(() => setPrefsToast(null), 2500)
    return () => clearTimeout(t)
  }, [prefsToast])

  const isPro = subscriptionTier === 'weekly' || subscriptionTier === 'monthly'
  const planLabel = subscriptionTier === 'weekly' ? 'Bi-Weekly Pro' : subscriptionTier === 'monthly' ? 'Monthly Pro' : 'Free Tier'

  const startEditAutoFill = () => {
    setDraftAutoFill({ ...autoFillData })
    setEditingAutoFill(true)
  }

  const saveEditAutoFill = () => {
    saveAutoFillData(draftAutoFill)
    setAutoFillData(draftAutoFill)
    setEditingAutoFill(false)
    setSavedToast(true)
  }

  const handleExport = () => {
    const payload = {
      autoFillData,
      balance: localStorage.getItem('looniewins_balance'),
      entered: localStorage.getItem('looniewins_entered'),
      subscriptionTier: localStorage.getItem('looniewins_subscription_tier'),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'looniewins-data.json'
    a.click()
    URL.revokeObjectURL(url)
    setExportToast(true)
  }

  const handleDeleteAccount = () => {
    const ok = window.confirm('Delete local LoonieWins data on this device? This cannot be undone.')
    if (!ok) return
    ;[
      'looniewins_balance',
      'looniewins_last_daily_entry_at',
      'looniewins_subscription_tier',
      'looniewins_entered',
      'looniewins_autofill',
      'loonie_vault_v1',
    ].forEach((k) => localStorage.removeItem(k))
    setAutoFillData(loadAutoFillData())
    setSubscriptionTier('free')
    setPrefsToast('Local data cleared')
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Profile header with neon green icon */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-win/20 border border-win/40">
          <User className="w-5 h-5 text-win" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Profile</h1>
          <p className="text-gray-400 text-sm">Plan, history, and settings.</p>
        </div>
      </div>

      {/* Current Plan banner */}
      <section className="rounded-xl bg-gray-800/80 border border-gray-600/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Plan</p>
            <p className="text-lg font-bold text-white mt-0.5">{planLabel}</p>
            <p className="text-sm text-gray-400 mt-1">
              {isPro
                ? 'Unlimited entries · No points needed'
                : `${smartFillsRemaining} Smart-Fills remaining today — Unlock unlimited with Pro`}
            </p>
          </div>
          {!isPro && (
            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-win text-gray-900 font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Crown className="w-4 h-4" />
              Upgrade to Pro
            </button>
          )}
        </div>
      </section>

      {/* Applied Contests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-win" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Applied Contests</h2>
          </div>
          <span className="text-sm text-gray-400">{appliedContests.length} entered</span>
        </div>
        <ul className="space-y-2">
          {appliedContests.length === 0 ? (
            <li className="text-gray-500 text-sm py-4 text-center">No entries yet.</li>
          ) : (
            appliedContests.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border-2 border-win/40 bg-gray-800/60 px-4 py-3 flex items-center gap-3"
              >
                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-win/20">
                  <Check className="w-4 h-4 text-win" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white line-clamp-1">{c.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {c.prizeValue && (
                      <span className="text-xs font-semibold text-win">{c.prizeValue}</span>
                    )}
                    {c.ended ? (
                      <span className="text-xs text-red-400">Ended</span>
                    ) : (
                      c.daysLeft != null && (
                        <span className="text-xs text-gray-400">{c.daysLeft}d left</span>
                      )
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-win/20 text-win">
                      Entered
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 p-2 rounded-lg text-win hover:bg-win/10 transition-colors"
                  aria-label="Open contest"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Auto-Fill Info */}
      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Auto-Fill Info</h2>
        <div className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
          {AUTO_FILL_FIELDS.map(({ key, label }) => {
            const value = autoFillData[key] ?? ''
            return (
              <div key={key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-gray-400 shrink-0">{label}</span>
                {editingAutoFill ? (
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    value={draftAutoFill[key] ?? ''}
                    onChange={(e) =>
                      setDraftAutoFill((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="flex-1 min-w-0 text-right text-sm text-gray-50 bg-gray-900/60 border border-gray-600/50 rounded-lg px-3 py-1.5 focus:outline-none focus:border-win/50"
                  />
                ) : (
                  <span className="text-sm text-gray-300 text-right">{value || 'Not set'}</span>
                )}
              </div>
            )
          })}
        </div>
        {editingAutoFill ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveEditAutoFill}
              className="flex-1 py-3 rounded-xl bg-win text-gray-900 font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Save Auto-Fill
            </button>
            <button
              type="button"
              onClick={() => setEditingAutoFill(false)}
              className="flex-1 py-3 rounded-xl bg-gray-800 border border-gray-600/50 text-white font-medium text-sm hover:bg-gray-700/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditAutoFill}
            className="w-full mt-3 py-3 rounded-xl bg-gray-800 border border-gray-600/50 text-white font-medium text-sm hover:bg-gray-700/80 transition-colors"
          >
            Edit Auto-Fill Data
          </button>
        )}
        {savedToast && (
          <p className="text-sm text-win mt-2" role="status">
            Auto-fill saved — used when you enter contests.
          </p>
        )}
      </section>

      {/* Settings */}
      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Settings</h2>
        <ul className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
          <li>
            <button
              type="button"
              onClick={() => setPrefsToast('Preferences coming soon — Quebec filter lives on Home for now')}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Preferences</p>
                <p className="text-xs text-gray-500">Quebec filter, notifications</p>
              </div>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setPrefsToast('Your data stays on this device (localStorage)')}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Shield className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Privacy</p>
                <p className="text-xs text-gray-500">Your data stays on your device</p>
              </div>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Download className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Export Data</p>
                <p className="text-xs text-gray-500">Download all your data</p>
              </div>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Delete Account</p>
                <p className="text-xs text-gray-500">Permanently remove your data</p>
              </div>
            </button>
          </li>
        </ul>
        {(exportToast || prefsToast) && (
          <p className="text-sm text-win mt-2" role="status">
            {exportToast ? 'Data exported.' : prefsToast}
          </p>
        )}
      </section>

      <SubscriptionModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={(planId) => setSubscriptionTier(planId)}
        showComparison
      />
    </div>
  )
}
