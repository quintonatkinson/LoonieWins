import { getSettings, saveSettings } from '../lib/storage.js'
import { normalizeProfile } from '../lib/profile.js'

const form = document.getElementById('profile-form')
const statusEl = document.getElementById('status')
const syncMeta = document.getElementById('sync-meta')

function setStatus(text, kind = '') {
  statusEl.textContent = text
  statusEl.className = `status ${kind}`.trim()
}

function fillForm(profile) {
  for (const [key, value] of Object.entries(profile)) {
    const input = form.elements.namedItem(key)
    if (input && 'value' in input) input.value = value ?? ''
  }
}

function readForm() {
  const data = {}
  for (const el of form.elements) {
    if (el.name) data[el.name] = el.value
  }
  return normalizeProfile(data)
}

function formatSync(settings) {
  if (!settings.lastSyncAt) return 'Not synced yet'
  const when = new Date(settings.lastSyncAt).toLocaleString()
  return `Last sync: ${when} (${settings.lastSyncSource || 'unknown'})`
}

async function refresh() {
  const settings = await getSettings()
  fillForm(settings.profile)
  syncMeta.textContent = formatSync(settings)
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault()
  try {
    await saveSettings({ profile: readForm() })
    setStatus('Profile saved in extension storage.', 'ok')
    await refresh()
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Save failed', 'err')
  }
})

document.getElementById('fill-btn').addEventListener('click', async () => {
  setStatus('Trying best-effort fill on the active tab…')
  const res = await chrome.runtime.sendMessage({ type: 'FILL_ACTIVE_TAB' })
  if (!res?.ok) {
    setStatus(res?.reason || 'Fill failed', 'err')
    return
  }
  const n = res.summary?.filled ?? 0
  const h = res.summary?.highlighted ?? 0
  if (res.empty || n === 0) {
    setStatus(
      res.reason ||
        'No matching fields on this page. Try again after the form loads, or paste from Open & Enter copy chips.',
      'err',
    )
    return
  }
  const walls = res.summary?.walls || []
  const wallBit = walls.length
    ? ` Needs your tap: ${walls.join(' / ')}.`
    : ''
  setStatus(
    `Review & submit — filled ${n} field(s).${h ? ` ${h} skill-test highlighted.` : ''}${wallBit}`,
    'ok',
  )
})

document.getElementById('sync-tab-btn').addEventListener('click', async () => {
  setStatus('Focus the LoonieWins tab, then syncing…')
  const res = await chrome.runtime.sendMessage({ type: 'SYNC_ACTIVE_TAB' })
  if (!res?.ok) {
    setStatus(res?.reason || 'Sync failed — keep the LoonieWins tab focused.', 'err')
    return
  }
  setStatus(`Synced from ${res.source}.`, 'ok')
  await refresh()
})

document.getElementById('sync-cloud-btn').addEventListener('click', async () => {
  setStatus('Pulling profile from Supabase…')
  const res = await chrome.runtime.sendMessage({ type: 'SYNC_SUPABASE' })
  if (!res?.ok) {
    setStatus(res?.reason || 'Cloud sync failed', 'err')
    return
  }
  setStatus('Pulled auto_fill_data from Supabase.', 'ok')
  await refresh()
})

refresh().catch((err) => {
  setStatus(err instanceof Error ? err.message : 'Load failed', 'err')
})
