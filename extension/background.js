import { getSettings } from './lib/storage.js'
import { toFillPayload, hasUsableProfile } from './lib/profile.js'
import { loonieAutofill } from './lib/engine.generated.js'
import { syncAllFromTab, syncFromSupabase } from './lib/sync.js'

const MENU_FILL = 'loonie-fill-page'
const MENU_SYNC = 'loonie-sync-tab'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_FILL,
      title: 'LoonieWins: Fill this form',
      contexts: ['page', 'editable', 'frame'],
    })
    chrome.contextMenus.create({
      id: MENU_SYNC,
      title: 'LoonieWins: Sync profile from this tab',
      contexts: ['page'],
    })
  })
})

/**
 * @param {number} tabId
 */
async function fillActiveTab(tabId) {
  const settings = await getSettings()
  if (!hasUsableProfile(settings.profile)) {
    return {
      ok: false,
      reason: 'No profile saved. Sync from LoonieWins or edit fields in the popup.',
    }
  }

  const payload = toFillPayload(settings.profile)
  // Shared engine (same matcher as the web + mobile apps). MAIN world so React/Vue
  // controlled inputs see the native value setter; allFrames for embedded entry widgets.
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: loonieAutofill,
    args: [payload],
  })

  const summary = { filled: 0, candidates: 0, highlighted: 0, fields: [] }
  for (const frame of results || []) {
    const r = frame?.result
    if (!r) continue
    summary.filled += r.filled || 0
    summary.candidates += r.candidates || 0
    summary.highlighted += r.highlighted || 0
    summary.fields.push(...(r.fields || []))
  }

  return { ok: true, summary }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return
  if (info.menuItemId === MENU_FILL) {
    await fillActiveTab(tab.id)
  } else if (info.menuItemId === MENU_SYNC) {
    await syncAllFromTab(tab.id)
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-page') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) await fillActiveTab(tab.id)
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    try {
      if (message?.type === 'FILL_ACTIVE_TAB') {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (!tab?.id) {
          sendResponse({ ok: false, reason: 'No active tab.' })
          return
        }
        sendResponse(await fillActiveTab(tab.id))
        return
      }

      if (message?.type === 'SYNC_ACTIVE_TAB') {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (!tab?.id) {
          sendResponse({ ok: false, reason: 'No active tab.' })
          return
        }
        sendResponse(await syncAllFromTab(tab.id))
        return
      }

      if (message?.type === 'SYNC_SUPABASE') {
        sendResponse(await syncFromSupabase())
        return
      }

      if (message?.type === 'BRIDGE_AUTOFILL' && message.data) {
        const { applySyncedProfile } = await import('./lib/storage.js')
        sendResponse(
          await applySyncedProfile(message.data, message.source || 'bridge'),
        )
        return
      }

      if (message?.type === 'BRIDGE_SESSION' && message.accessToken) {
        const { saveSettings } = await import('./lib/storage.js')
        await saveSettings({
          accessToken: message.accessToken,
          refreshToken: message.refreshToken || '',
        })
        sendResponse({ ok: true })
        return
      }

      if (message?.type === 'GET_STATUS') {
        const settings = await getSettings()
        sendResponse({
          ok: true,
          profile: settings.profile,
          lastSyncAt: settings.lastSyncAt,
          lastSyncSource: settings.lastSyncSource,
          hasSupabaseConfig: Boolean(
            settings.supabaseUrl && settings.supabaseAnonKey,
          ),
          hasAccessToken: Boolean(settings.accessToken),
        })
        return
      }

      sendResponse({ ok: false, reason: 'Unknown message type.' })
    } catch (err) {
      sendResponse({
        ok: false,
        reason: err instanceof Error ? err.message : 'Extension error',
      })
    }
  })()
  return true
})
