import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Shield, X } from 'lucide-react'
import { useAuthSession } from '../hooks/useAuthSession'
import {
  type ContestSubmission,
  isStaffModerator,
  listPendingSubmissions,
  moderateSubmission,
} from '../lib/contestSubmissions'

export default function ModerateContests() {
  const { session, loading, signIn } = useAuthSession()
  const [pending, setPending] = useState<ContestSubmission[]>([])
  const [staff, setStaff] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const refresh = useCallback(async () => {
    if (!session) {
      setPending([])
      setStaff(false)
      return
    }
    const isStaff = await isStaffModerator()
    setStaff(isStaff)
    if (!isStaff) {
      setPending([])
      return
    }
    setPending(await listPendingSubmissions())
  }, [session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const { error } = await signIn(email, password)
    if (error) setErr(error)
  }

  const act = async (id: string, action: 'approve' | 'reject') => {
    setErr(null)
    setMsg(null)
    setBusyId(id)
    try {
      const { result, error } = await moderateSubmission(
        id,
        action,
        action === 'reject' ? rejectReason[id] : undefined
      )
      if (error) {
        setErr(error)
        return
      }
      if (action === 'approve' && result?.contest_id) {
        setMsg(`Approved → Hive Mind contest ${result.contest_id}`)
      } else {
        setMsg('Rejected.')
      }
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-win animate-pulse">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-win" />
          Moderation
        </h1>
        <form onSubmit={onSignIn} className="glass rounded-xl p-4 space-y-3">
          <input
            type="email"
            required
            placeholder="Moderator email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white"
          />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button type="submit" className="w-full py-2.5 rounded-lg bg-win text-gray-900 font-semibold">
            Sign in
          </button>
        </form>
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-white">Moderation</h1>
        <p className="text-gray-400 text-sm">
          Your account is not flagged as moderator or admin. Ask an operator to set{' '}
          <code className="text-win text-xs">is_moderator</code> or{' '}
          <code className="text-win text-xs">is_admin</code> on your profile via the SQL editor.
        </p>
        <Link to="/submit" className="text-sm text-win hover:underline">
          Submit a contest instead →
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 max-w-xl mx-auto pb-24">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-win" />
          Contest moderation
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Approve sends the item into <code className="text-xs text-win">public.contests</code> (Hive Mind)
          with source <code className="text-xs text-win">user-submitted</code>.
        </p>
      </div>

      {err && <p className="text-red-400 text-sm">{err}</p>}
      {msg && <p className="text-win text-sm">{msg}</p>}

      {pending.length === 0 ? (
        <p className="text-gray-500 text-sm">Queue is empty.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((s) => (
            <li key={s.id} className="glass rounded-xl p-4 space-y-3">
              <div>
                <p className="text-white font-medium">{s.title}</p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-win break-all hover:underline"
                >
                  {s.url}
                </a>
                <p className="text-xs text-gray-500 mt-1">
                  Eligibility: {s.eligibility}
                  {s.expiry_date ? ` · Expiry: ${s.expiry_date.slice(0, 10)}` : ' · No expiry given'}
                  {' · '}
                  Submitted {new Date(s.created_at).toLocaleString()}
                </p>
              </div>
              <input
                type="text"
                placeholder="Reject reason (optional)"
                value={rejectReason[s.id] ?? ''}
                onChange={(e) =>
                  setRejectReason((prev) => ({ ...prev, [s.id]: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600/50 text-sm text-white placeholder-gray-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => void act(s.id, 'approve')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-win text-gray-900 font-semibold text-sm disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => void act(s.id, 'reject')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 font-semibold text-sm disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-4 text-sm">
        <Link to="/submit" className="text-gray-400 hover:text-win">
          ← Submit form
        </Link>
        <Link to="/" className="text-gray-400 hover:text-win">
          Home
        </Link>
      </div>
    </div>
  )
}
