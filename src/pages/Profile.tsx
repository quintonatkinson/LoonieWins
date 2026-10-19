import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  Trophy,
  Settings,
  Shield,
  Download,
  Trash2,
  Crown,
  ChevronRight,
  FileText,
  LifeBuoy,
  Scale,
  LogOut,
  PlusCircle,
  Link2,
  History,
  Award,
  Package,
} from 'lucide-react'
import { useUserEarn } from '../contexts/UserEarnContext'
import { useAuth } from '../contexts/AuthContext'
import { useContestEntries } from '../hooks/useContestEntries'
import { useUserLimits } from '../hooks/useUserLimits'
import SubscriptionModal from '../components/SubscriptionModal'
import NotificationPreferences from '../components/NotificationPreferences'
import AccentPicker from '../components/AccentPicker'
import DisplayPreferences from '../components/DisplayPreferences'
import type { AutoFillData } from '../types/profile'
import { downloadWebDataExport, deleteAccountAndLocalData } from '../lib/account/deleteAccount'
import { displaySupportEmail } from '../lib/legal/constants'
import { loadAutoFillData, saveAutoFillData } from '../lib/utils/autoFillStorage'
import { isSupabaseConfigured } from '../lib/supabase'
import { PRO_LOCKED_FEATURES } from '../lib/monetization/tiers'
import { isCurrentContestEntry } from '../lib/utils/contestEntryScope'
import PageShell from '../components/PageShell'

const AUTO_FILL_FIELDS: { key: keyof AutoFillData; label: string }[] = [
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
  const { subscriptionTier, upgradeToPro, weeklyEntriesUsed } = useUserEarn()
  const { profile, updateProfile, signOut, user } = useAuth()
  const { entries } = useContestEntries()
  const { smartFillsRemaining, smartFillsUnlimited, weeklyEntryCap, weeklyLimitReached } =
    useUserLimits()

  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingAutoFill, setEditingAutoFill] = useState(false)
  const [draftAutoFill, setDraftAutoFill] = useState<Partial<AutoFillData>>({})
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)

  const activeGiveaways = useMemo(
    () => entries.filter(isCurrentContestEntry).length,
    [entries]
  )

  const autoFillData: Partial<AutoFillData> = useMemo(() => {
    const af = profile?.auto_fill_data
    if (af && (af.email || af.name || af.firstName || af.address)) {
      return {
        ...af,
        email: af.email || profile?.email || '',
        name:
          af.name ||
          [af.firstName, af.lastName].filter(Boolean).join(' ') ||
          profile?.display_name ||
          '',
      }
    }
    return loadAutoFillData()
  }, [profile])

  const smartFillsLabel = smartFillsUnlimited
    ? 'Unlimited Smart-Fills'
    : `${smartFillsRemaining} Smart-Fills remaining`
  const isPro = subscriptionTier === 'weekly' || subscriptionTier === 'monthly'
  const planLabel =
    subscriptionTier === 'weekly'
      ? 'Bi-Weekly Pro'
      : subscriptionTier === 'monthly'
        ? 'Monthly Pro'
        : 'Free Tier'
  const entryCapLabel = isPro
    ? 'Unlimited entries · No points needed'
    : weeklyEntryCap != null
      ? `${weeklyEntriesUsed}/${weeklyEntryCap} free entries this week${
          weeklyLimitReached ? ' — cap reached (pts or Pro for more)' : ''
        } · ${smartFillsLabel}`
      : smartFillsLabel

  const startEditAutoFill = () => {
    setDraftAutoFill({ ...autoFillData })
    setEditingAutoFill(true)
    setSaveMsg(null)
  }

  const saveAutoFill = async () => {
    const first = draftAutoFill.firstName?.trim() || ''
    const last = draftAutoFill.lastName?.trim() || ''
    const name =
      draftAutoFill.name?.trim() ||
      [first, last].filter(Boolean).join(' ') ||
      profile?.display_name ||
      ''
    const next: AutoFillData = {
      ...draftAutoFill,
      firstName: first || undefined,
      lastName: last || undefined,
      name,
      email: draftAutoFill.email?.trim() || profile?.email || '',
    }
    saveAutoFillData(next)
    const { error } = await updateProfile({ auto_fill_data: next })
    if (error) {
      setSaveMsg(error)
      return
    }
    setEditingAutoFill(false)
    setSaveMsg(user ? 'Saved to your account.' : 'Saved on this device.')
  }

  const handleExport = async () => {
    await downloadWebDataExport()
  }

  const handleDelete = async () => {
    setDeleteBusy(true)
    setDeleteMsg(null)
    try {
      const result = await deleteAccountAndLocalData()
      setDeleteMsg(result.message)
      setTimeout(() => {
        setDeleteOpen(false)
        navigate('/delete-account')
        window.location.reload()
      }, 1000)
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <PageShell className="space-y-6" testId="profile">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-win/20 border border-win/40">
          <User className="w-5 h-5 text-win" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-white">Profile</h1>
          <p className="text-gray-400 text-sm truncate">
            {profile?.email || user?.email || (isSupabaseConfigured ? 'Signed in' : 'Guest (local)')}
          </p>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-600/50 text-sm text-gray-300 hover:text-win"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        )}
      </div>

      <section className="rounded-xl bg-gray-800/80 border border-gray-600/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Plan</p>
            <p className="text-lg font-bold text-white mt-0.5">{planLabel}</p>
            <p className="text-sm text-gray-400 mt-1">{entryCapLabel}</p>
          </div>
          {!isPro && (
            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Crown className="w-4 h-4" />
              Upgrade to Pro
            </button>
          )}
        </div>
        {!isPro && (
          <div className="mt-4 pt-3 border-t border-gray-600/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90 mb-2">
              Locked behind Pro
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PRO_LOCKED_FEATURES.map((f) => (
                <li key={f.id} className="text-xs text-gray-400 flex gap-1.5">
                  <span className="text-amber-400/80 shrink-0" aria-hidden>
                    ·
                  </span>
                  <span>
                    <span className="text-gray-200 font-medium">{f.title}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-500 mt-2">
              Weekly or monthly only — tap Upgrade for the full checklist.
            </p>
          </div>
        )}
        {isPro && user && (
          <p className="mt-3 text-xs text-win border-t border-gray-600/40 pt-3">
            Priority multi-device sync on — Applied Contests & prefs follow this account.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-gray-800/80 border border-gray-600/50 p-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-gray-500 uppercase">XP</p>
          <p className="text-lg font-bold text-win">{profile?.xp ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Level</p>
          <p className="text-lg font-bold text-white">{profile?.level ?? 1}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Streak</p>
          <p className="text-lg font-bold text-amber-400">{profile?.streak ?? 0}d</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {profile?.streak_grace_available === false
              ? 'Grace used — don’t miss tomorrow'
              : '1-day grace miss available'}
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-win" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
            My Giveaways
          </h2>
        </div>
        <Link
          to="/my-giveaways"
          className="flex items-center gap-3 rounded-xl border-2 border-win/40 bg-gray-800/60 px-4 py-3 hover:bg-gray-800 transition-colors"
          data-testid="profile-my-giveaways-link"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Contests you&apos;re in</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeGiveaways} active · {entries.length} all-time
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Current &amp; All-time tabs, status filters, end dates
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-win shrink-0" />
        </Link>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">
          Auto-Fill Info
        </h2>
        {!editingAutoFill ? (
          <>
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
              onClick={startEditAutoFill}
              className="w-full mt-3 py-3 rounded-xl bg-gray-800 border border-gray-600/50 text-white font-medium text-sm hover:bg-gray-700/80 transition-colors"
            >
              Edit Auto-Fill Data
            </button>
            {saveMsg && <p className="text-sm text-win mt-2">{saveMsg}</p>}
          </>
        ) : (
          <div className="rounded-xl bg-gray-800/80 border border-gray-600/50 p-4 space-y-3">
            {AUTO_FILL_FIELDS.map(({ key, label }) => (
              <label key={key} className="block">
                <span className="text-xs text-gray-400">{label}</span>
                <input
                  type="text"
                  value={getAutoFillValue(key, draftAutoFill)}
                  onChange={(e) =>
                    setDraftAutoFill((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600/50 text-white text-sm"
                />
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => void saveAutoFill()}
                className="flex-1 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingAutoFill(false)}
                className="px-4 py-2.5 rounded-lg border border-gray-600/50 text-sm text-gray-300"
              >
                Cancel
              </button>
            </div>
            {saveMsg && <p className="text-sm text-red-400">{saveMsg}</p>}
          </div>
        )}
      </section>

      {/* History — also in bottom-nav History sheet */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-win" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">History</h2>
        </div>
        <ul className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
          <li>
            <Link
              to="/winners"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Award className="w-5 h-5 text-win shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">Winners</p>
                <p className="text-xs text-gray-500">Community wins shared with LoonieWins</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
            </Link>
          </li>
          <li>
            <Link
              to="/past"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Package className="w-5 h-5 text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">Past contests</p>
                <p className="text-xs text-gray-500">FOMO vault — expired Hive Mind drops</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
            </Link>
          </li>
        </ul>
      </section>

      {/* Community */}
      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Community</h2>
        <ul className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
          <li>
            <Link
              to="/submit"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <PlusCircle className="w-5 h-5 text-win shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Submit a contest</p>
                <p className="text-xs text-gray-500">Moderated — approved items join the Hive Mind feed</p>
              </div>
            </Link>
          </li>
          <li>
            <Link
              to="/referrals"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Link2 className="w-5 h-5 text-win shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Referrals</p>
                <p className="text-xs text-gray-500">Invite codes &amp; friend link credits</p>
              </div>
            </Link>
          </li>
          <li>
            <Link
              to="/moderate"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Shield className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Moderation queue</p>
                <p className="text-xs text-gray-500">Mods / admins only</p>
              </div>
            </Link>
          </li>
        </ul>
      </section>

      <NotificationPreferences />

      {/* Appearance – accent themes */}
      <section className="rounded-xl bg-gray-800/80 border border-gray-600/50 p-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Appearance</h2>
        <AccentPicker />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Settings</h2>
        <ul className="rounded-xl bg-gray-800/80 border border-gray-600/50 divide-y divide-gray-600/50 overflow-hidden">
          <li>
            <button
              type="button"
              onClick={() => setShowPrefs((v) => !v)}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
              aria-expanded={showPrefs}
            >
              <Settings className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Preferences</p>
                <p className="text-xs text-gray-500">
                  Your feed fingerprint — filters, density, sort, open-in, invite
                </p>
              </div>
              <span className="text-gray-500 text-xs">{showPrefs ? 'Hide' : 'Edit'}</span>
            </button>
            {showPrefs && <DisplayPreferences />}
          </li>
          <li>
            <Link
              to="/privacy"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Shield className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Privacy Policy</p>
                <p className="text-xs text-gray-500">How we handle your data</p>
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
                <p className="text-xs text-gray-500">Contest aggregation rules</p>
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
                <p className="text-xs text-gray-500">{displaySupportEmail()}</p>
              </div>
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => void handleExport()}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Download className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Export Data</p>
                <p className="text-xs text-gray-500">Download account + local JSON</p>
              </div>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(true)
                setDeleteMsg(null)
              }}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Delete Account</p>
                <p className="text-xs text-gray-500">Permanently remove your cloud account</p>
              </div>
            </button>
          </li>
          <li>
            <Link
              to="/delete-account"
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <FileText className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Deletion help page</p>
                <p className="text-xs text-gray-500">Store listing / external URL</p>
              </div>
            </Link>
          </li>
        </ul>
      </section>

      {deleteOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => !deleteBusy && setDeleteOpen(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(92vw,400px)] rounded-2xl bg-gray-800 border border-gray-600 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white">Delete account?</h3>
            <p className="text-sm text-gray-400">
              This calls <code className="text-win">delete_own_account</code> on Supabase (removes
              auth user + profile, entries, transactions, referrals, wins) and clears local cache.
            </p>
            {deleteMsg && <p className="text-sm text-win">{deleteMsg}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void handleDelete()}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : 'Delete forever'}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-gray-600 text-sm text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <SubscriptionModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={(planId) => void upgradeToPro(planId)}
        showComparison
      />
    </PageShell>
  )
}
