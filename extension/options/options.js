import {
  getSettings,
  saveSettings,
  clearSessionTokens,
} from '../lib/storage.js'
import { assertAnonKey } from '../lib/security.js'

const form = document.getElementById('options-form')
const statusEl = document.getElementById('status')

function setStatus(text, kind = '') {
  statusEl.textContent = text
  statusEl.className = `status ${kind}`.trim()
}

async function load() {
  const settings = await getSettings()
  form.elements.supabaseUrl.value = settings.supabaseUrl
  form.elements.supabaseAnonKey.value = settings.supabaseAnonKey
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault()
  const supabaseUrl = form.elements.supabaseUrl.value
  const supabaseAnonKey = form.elements.supabaseAnonKey.value
  const check = assertAnonKey(supabaseAnonKey)
  if (!check.ok) {
    setStatus(check.reason, 'err')
    return
  }
  try {
    await saveSettings({ supabaseUrl, supabaseAnonKey })
    setStatus('Saved. Anon key stored locally in the extension only.', 'ok')
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Save failed', 'err')
  }
})

document.getElementById('clear-session').addEventListener('click', async () => {
  await clearSessionTokens()
  setStatus('Cleared access/refresh tokens from extension storage.', 'ok')
})

load().catch((err) => {
  setStatus(err instanceof Error ? err.message : 'Load failed', 'err')
})
