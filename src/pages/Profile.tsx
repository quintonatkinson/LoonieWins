import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  FileText,
  LifeBuoy,
  Scale,
} from 'lucide-react'
import { useUserEarn } from '../contexts/UserEarnContext'
import SubscriptionModal from '../components/SubscriptionModal'
import type { AutoFillData } from '../types/profile'
import { downloadWebDataExport, deleteAccountAndLocalData } from '../lib/account/deleteAccount'
import { SUPPORT_EMAIL } from '../lib/legal/constants'

const SMART_FILLS_REMAINING = 3 // from profile

const AUTO_FILL_FIELDS: { key: string; label: string }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'province', label: 'Province' },
  { key: 'postalCode', label: 'Postal Code' },
]

function getAutoFillValue(key: string, data: Partial<AutoFillData>): string {
  const v = (data as Record<string, unknown>)[key]
  if (v && typeof v === 'string') return v
  if (key === 'firstName' && data.name) return data.name.split(' ')[0] ?? ''
  if (key === 'lastName' && data.name) return data.name.split(' ').slice(1).join(' ') || ''
  return ''
}

export default function Profile() {
  const navigate = useNavigate()
  const { subscriptionTier, setSubscriptionTier } = useUserEarn()
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [smartFillsRemaining] = useState(SMART_FILLS_REMAINING)
  const [autoFillData] = useState<Partial<AutoFillData>>({
    name: 'Jane Doe',
    email: 'jane@example.com',
    address: '123 Main St, Toronto ON',
  })
  const [appliedContests] = useState<
    { id: string; title: string; enteredAt: string; prizeValue?: string; daysLeft?: number; ended?: boolean }[]
  >([
    { id: '1', title: 'Win a $5,000 Home Depot Gift Card', enteredAt: '2025-02-22', prizeValue: '$5K', daysLeft: 18 },
    { id: '2', title: 'Tech Bundle Giveaway', enteredAt: '2025-02-20', prizeValue: '$10K', daysLeft: 35 },
    { id: '3', title: 'Summer Vacation Draw', enteredAt: '2025-02-15', prizeValue: '$4.5K', ended: true },
  ])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

  const isPro = subscriptionTier === 'weekly' || subscriptionTier === 'monthly'
  const planLabel = subscriptionTier === 'weekly' ? 'Bi-Weekly Pro' : subscriptionTier === 'monthly' ? 'Monthly Pro' : 'Free Tier'

  const handleDelete = async () => {
    setDeleteBusy(true)
    setDeleteMsg(null)
    try {
      const result = await deleteAccountAndLocalData()
      setDeleteMsg(result.message)
      setSubscriptionTier('free')
      setTimeout(() => {
        setDeleteOpen(false)
        navigate('/')
        window.location.reload()
      }, 1200)
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleteBusy(false)
    }
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

      {/* Current Plan banner – match reference: Current Plan / Free Tier, subtext, Upgrade to Pro (neon green) */}
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

      {/* Applied Contests – trophy icon, count, cards with green border, checkmark, prize, time, Entered tag, link */}
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

      {/* Auto-Fill Info – header, 8 fields (label + value or "Not set"), Edit button */}
      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Auto-Fill Info</h2>
        <div className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
          {AUTO_FILL_FIELDS.map(({ key, label }) => {
            const value = getAutoFillValue(key, autoFillData)
            return (
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-sm text-gray-300">{value || 'Not set'}</span>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          className="w-full mt-3 py-3 rounded-xl bg-gray-800 border border-gray-600/50 text-white font-medium text-sm hover:bg-gray-700/80 transition-colors"
        >
          Edit Auto-Fill Data
        </button>
      </section>

      {/* Settings – icon + title + description per row */}
      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Settings</h2>
        <ul className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
          <li>
            <button
              type="button"
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
            <Link
              to="/privacy"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Shield className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Privacy Policy</p>
                <p className="text-xs text-gray-500">What we collect and how to delete it</p>
              </div>
            </Link>
          </li>
          <li>
            <Link
              to="/terms"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Scale className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Terms of Use</p>
                <p className="text-xs text-gray-500">Contest aggregation &amp; subscriptions</p>
              </div>
            </Link>
          </li>
          <li>
            <Link
              to="/support"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <LifeBuoy className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Support</p>
                <p className="text-xs text-gray-500">{SUPPORT_EMAIL.startsWith('REPLACE_') ? 'Contact & help' : SUPPORT_EMAIL}</p>
              </div>
            </Link>
          </li>
          <li>
            <a
              href="/legal/privacy.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <FileText className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Hosted legal pages</p>
                <p className="text-xs text-gray-500">Static URLs for App Store / Play Console</p>
              </div>
            </a>
          </li>
          <li>
            <button
              type="button"
              onClick={() => downloadWebDataExport()}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Download className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Export Data</p>
                <p className="text-xs text-gray-500">Download a JSON copy of local data</p>
              </div>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setDeleteMsg(null)
                setDeleteOpen(true)
              }}
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
      </section>

      {deleteOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => !deleteBusy && setDeleteOpen(false)} aria-hidden />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-600/50 p-6 shadow-xl space-y-4"
            role="dialog"
            aria-modal
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title" className="text-lg font-bold text-white">
              Delete account &amp; data?
            </h2>
            <p className="text-sm text-gray-400">
              This clears LoonieWins data on this device and deletes your cloud account if you are signed in.
              This cannot be undone. Prefer the full page?{' '}
              <Link to="/delete-account" className="text-win underline" onClick={() => setDeleteOpen(false)}>
                Open delete account
              </Link>
              .
            </p>
            {deleteMsg && <p className="text-sm text-win">{deleteMsg}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-600 text-gray-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      <SubscriptionModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={(planId) => setSubscriptionTier(planId)}
        showComparison
      />
    </div>
  )
}
