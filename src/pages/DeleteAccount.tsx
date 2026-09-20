import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL, legalUrl } from '../lib/legal/constants'
import { deleteAccountAndLocalData } from '../lib/account/deleteAccount'

/**
 * In-app + external (Google Play) account / data deletion resource.
 * Functional deletion clears device data and removes a Supabase account when signed in.
 */
export default function DeleteAccountPage() {
  const [busy, setBusy] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const handleDelete = async () => {
    if (!confirmed || busy) return
    setBusy(true)
    setError(null)
    setResultMsg(null)
    try {
      const result = await deleteAccountAndLocalData()
      setResultMsg(result.message)
      if (result.error && !result.deletedRemoteAccount && result.hadSession) {
        setError(
          `Server note: ${result.error}. If a cloud account remains, email ${SUPPORT_EMAIL} from the address on the account.`
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/profile" className="text-sm text-win hover:underline">
          ← Back to Profile
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-3">Delete account &amp; data</h1>
        <p className="text-sm text-gray-400 mt-2">
          Apple App Store and Google Play require a way to delete your account and associated data
          when accounts exist. LoonieWins also lets you wipe on-device data even before you sign in.
        </p>
      </div>

      <section className="rounded-xl bg-gray-800/80 border border-gray-600/50 p-4 space-y-2 text-sm text-gray-300">
        <p className="font-medium text-white">What gets deleted</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>On-device Smart-Fill / points / entered contests / local contest cache</li>
          <li>If you are signed in: your auth account and related profile rows (via delete_own_account)</li>
        </ul>
        <p className="text-gray-400 pt-2">
          Contest feed listings shared with all users are not personal data and are not removed.
          Cancel any real App Store / Play subscription in your store account settings before
          deleting if you have one.
        </p>
      </section>

      <label className="flex items-start gap-3 text-sm text-gray-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I understand this permanently deletes my LoonieWins data on this device and, if signed in, my account.</span>
      </label>

      <button
        type="button"
        disabled={!confirmed || busy}
        onClick={handleDelete}
        className="w-full py-3 rounded-xl bg-red-600/90 text-white font-semibold text-sm disabled:opacity-40 hover:bg-red-600 transition-colors"
      >
        {busy ? 'Deleting…' : 'Delete my data / account'}
      </button>

      {resultMsg && <p className="text-sm text-win">{resultMsg}</p>}
      {error && <p className="text-sm text-amber-400">{error}</p>}

      <p className="text-xs text-gray-500">
        Prefer email? Contact {SUPPORT_EMAIL}. This page is also the Play Console external deletion
        URL ({legalUrl('delete-account')}).
      </p>
    </div>
  )
}
