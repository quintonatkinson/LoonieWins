import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Send } from 'lucide-react'
import { useAuthSession } from '../hooks/useAuthSession'
import {
  type ContestEligibility,
  type ContestSubmission,
  listMySubmissions,
  submitContestSuggestion,
  isStaffModerator,
} from '../lib/contestSubmissions'

const ELIG_OPTIONS: { value: ContestEligibility; label: string }[] = [
  { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'United States' },
  { value: 'NA', label: 'North America (CA + US)' },
  { value: 'Unknown', label: 'Unknown / not sure' },
]

function statusBadge(status: ContestSubmission['status']) {
  if (status === 'approved') return 'bg-win/20 text-win border-win/40'
  if (status === 'rejected') return 'bg-red-500/20 text-red-400 border-red-500/40'
  return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
}

export default function SubmitContest() {
  const { session, user, loading, signIn } = useAuthSession()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [eligibility, setEligibility] = useState<ContestEligibility>('CA')
  const [expiryDate, setExpiryDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mine, setMine] = useState<ContestSubmission[]>([])
  const [isStaff, setIsStaff] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const refresh = useCallback(async () => {
    if (!session) {
      setMine([])
      setIsStaff(false)
      return
    }
    const [rows, staff] = await Promise.all([listMySubmissions(), isStaffModerator()])
    setMine(rows)
    setIsStaff(staff)
  }, [session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    setBusy(true)
    try {
      const { id, error } = await submitContestSuggestion({
        title,
        url,
        eligibility,
        expiryDate: expiryDate || null,
      })
      if (error) {
        setErr(error)
        return
      }
      setMsg(`Submitted for review${id ? ` (#${id.slice(0, 8)})` : ''}. Mods will approve before it hits the feed.`)
      setTitle('')
      setUrl('')
      setExpiryDate('')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const { error } = await signIn(email, password)
    if (error) setErr(error)
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
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-win" />
            Submit a contest
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to suggest a giveaway. Submissions are moderated before they reach the Hive Mind feed.
          </p>
        </div>
        <form onSubmit={onSignIn} className="glass rounded-xl p-4 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500"
          />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-win text-gray-900 font-semibold hover:opacity-90"
          >
            Sign in to submit
          </button>
        </form>
        <Link to="/" className="text-sm text-gray-400 hover:text-win">
          ← Back to Home
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-win" />
            Submit a contest
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Share a legit giveaway URL. We review every submission before it lands in the Hive Mind.
          </p>
          <p className="text-gray-500 text-xs mt-1">Signed in as {user?.email}</p>
        </div>
        {isStaff && (
          <Link
            to="/moderate"
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-win/40 text-win hover:bg-win/10"
          >
            Mod queue
          </Link>
        )}
      </div>

      <form onSubmit={onSubmit} className="glass rounded-xl p-4 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Title</span>
          <input
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Win a $500 Tim Hortons gift card"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Contest URL</span>
          <input
            type="url"
            required
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Country eligibility</span>
          <select
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value as ContestEligibility)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white"
          >
            {ELIG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Expiry (optional)
          </span>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600/50 text-white"
          />
        </label>

        <p className="text-xs text-gray-500">
          Limit: 5 submissions per 24 hours. Only http(s) URLs. Duplicates of pending/approved or Hive Mind
          contests are blocked.
        </p>

        {err && <p className="text-red-400 text-sm">{err}</p>}
        {msg && <p className="text-win text-sm">{msg}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-win text-gray-900 font-semibold hover:opacity-90 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>

      <section>
        <h2 className="text-sm font-medium text-gray-300 mb-3">Your submissions</h2>
        {mine.length === 0 ? (
          <p className="text-gray-500 text-sm">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((s) => (
              <li key={s.id} className="glass rounded-xl p-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white font-medium leading-snug">{s.title}</p>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge(s.status)}`}
                  >
                    {s.status}
                  </span>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-win/80 truncate hover:underline"
                >
                  {s.url}
                </a>
                <p className="text-xs text-gray-500">
                  {s.eligibility}
                  {s.expiry_date ? ` · ends ${s.expiry_date.slice(0, 10)}` : ''}
                  {s.status === 'rejected' && s.rejection_reason ? ` · ${s.rejection_reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/" className="inline-block text-sm text-gray-400 hover:text-win">
        ← Back to Home
      </Link>
    </div>
  )
}
