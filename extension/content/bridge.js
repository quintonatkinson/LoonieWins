/**
 * Content bridge on LoonieWins origins.
 * Pushes localStorage autofill + optional Supabase session into the extension.
 */
;(() => {
  const AUTOFILL_KEY = 'looniewins_autofill'

  function readAutofill() {
    try {
      const raw = localStorage.getItem(AUTOFILL_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function readSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) {
          continue
        }
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        const access =
          parsed?.access_token ||
          parsed?.currentSession?.access_token ||
          parsed?.session?.access_token
        const refresh =
          parsed?.refresh_token ||
          parsed?.currentSession?.refresh_token ||
          parsed?.session?.refresh_token
        if (access) {
          return { accessToken: access, refreshToken: refresh || '' }
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }

  function push() {
    const data = readAutofill()
    if (data) {
      chrome.runtime.sendMessage({
        type: 'BRIDGE_AUTOFILL',
        source: 'content-bridge',
        data,
      })
    }
    const session = readSession()
    if (session) {
      chrome.runtime.sendMessage({
        type: 'BRIDGE_SESSION',
        ...session,
      })
    }
  }

  push()
  window.addEventListener('loonie_autofill_updated', push)
  window.addEventListener('storage', (ev) => {
    if (
      ev.key === AUTOFILL_KEY ||
      (ev.key && ev.key.startsWith('sb-') && ev.key.endsWith('-auth-token'))
    ) {
      push()
    }
  })

  // Periodic light poll — Profile saves may not dispatch the custom event on main yet.
  setInterval(push, 15000)
})()
