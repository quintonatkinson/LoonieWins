import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'signup'

export default function AuthScreen() {
  const {
    signIn,
    signUp,
    needsEmailConfirm,
    pendingEmail,
    clearEmailConfirm,
  } = useAuth()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      const result =
        mode === 'signup'
          ? await signUp(email, password, displayName || undefined)
          : await signIn(email, password)
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  if (needsEmailConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="w-full max-w-md glass rounded-2xl p-6 space-y-4 text-center">
          <h1 className="text-2xl font-bold text-win">Check your email</h1>
          <p className="text-gray-300 text-sm">
            We sent a confirmation link to{' '}
            <span className="text-white font-medium">{pendingEmail}</span>. Open it,
            then come back and log in.
          </p>
          <p className="text-gray-500 text-xs">
            Tip: In Supabase → Authentication → Providers → Email, you can turn off
            “Confirm email” for faster local testing.
          </p>
          <button
            type="button"
            onClick={() => {
              clearEmailConfirm()
              setMode('login')
            }}
            className="w-full py-3 rounded-xl bg-win text-gray-900 font-semibold"
          >
            Go to Log in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md glass rounded-2xl p-6 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-win font-bold text-3xl tracking-tight">LoonieWins</p>
          <p className="text-gray-400 text-sm">Win More, Work Less</p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-800 p-1 border border-gray-600/50 relative z-10">
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError(null)
            }}
            className={`relative z-10 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              mode === 'signup' ? 'bg-win text-gray-900' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
            }}
            className={`relative z-10 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-win text-gray-900' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Log in
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600/50 text-white placeholder-gray-500"
          />
          {error && (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-win text-gray-900 font-semibold disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
