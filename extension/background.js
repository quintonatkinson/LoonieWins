import { getSettings } from './lib/storage.js'
import { toFillPayload, hasUsableProfile } from './lib/profile.js'
import { fillFormWithProfile, aggregateFillResults } from './lib/fill.js'
import { syncAllFromTab, syncFromSupabase } from './lib/sync.js'

const MENU_FILL = 'loonie-fill-page'
const MENU_SYNC = 'loonie-sync-tab'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_FILL,
      title: 'LoonieWins: Try fill this form',
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
 * In-page toast: “review & submit” after a successful fill (Alt+Shift+L / popup / menu).
 * @param {number} tabId
 * @param {string} message
 */
async function showPageToast(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (msg) => {
        try {
          const id = 'loonie-smartfill-toast'
          const old = document.getElementById(id)
          if (old) old.remove()
          const el = document.createElement('div')
          el.id = id
          el.setAttribute('role', 'status')
          el.textContent = msg
          el.style.cssText =
            'position:fixed;z-index:2147483647;left:50%;bottom:24px;transform:translateX(-50%);' +
            'max-width:min(420px,92vw);padding:12px 16px;border-radius:12px;' +
            'background:#0f172a;color:#ecfdf5;font:600 13px/1.35 system-ui,sans-serif;' +
            'box-shadow:0 8px 28px rgba(0,0,0,.35);border:1px solid #2dd4bf;'
          document.documentElement.appendChild(el)
          setTimeout(() => {
            try {
              el.remove()
            } catch (_) {}
          }, 4500)
        } catch (_) {}
      },
      args: [message],
    })
  } catch {
    /* restricted URL / no host permission yet */
  }
}

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
  let summary = { filled: 0, highlighted: 0, requiredEmpty: 0, walls: [] }

  try {
    // Serialize fillFormWithProfile into MAIN world (React-controlled inputs).
    const mainResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: 'MAIN',
      func: fillFormWithProfile,
      args: [payload],
    })
    summary = aggregateFillResults(mainResults)
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? err.message
          : "Can't fill this page (browser restricted URL). Open the contest form tab and try again.",
      summary,
    }
  }

  if (!summary.filled) {
    try {
      const isoResults = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: fillFormWithProfile,
        args: [payload],
      })
      const iso = aggregateFillResults(isoResults)
      if (iso.filled > summary.filled) summary = iso
    } catch {
      /* ignore */
    }
  }

  if (!summary.filled) {
    return {
      ok: true,
      empty: true,
      summary,
      reason:
        'No matching fields on this page. Try again after the form loads, or paste from Open & Fill checklist chips.',
    }
  }

  return { ok: true, summary }
}

function wallHonesty(walls) {
  if (!walls?.length) return ''
  const map = { captcha: 'captcha', 'sign-in': 'sign-in', purchase: 'purchase' }
  const parts = walls.map((w) => map[w] || w)
  return ` Needs your tap: ${parts.join(' / ')}.`
}

async function notifyFillResult(tabId, res) {
  try {
    const n = res.summary?.filled ?? 0
    const walls = res.summary?.walls || []
    const message =
      res.ok && !res.empty
        ? `Review & submit — filled ${n} field(s).${wallHonesty(walls)}`
        : res.reason || 'No matching fields.'
    await chrome.action.setBadgeText({ tabId, text: n > 0 ? String(n) : '!' })
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: n > 0 ? '#2dd4bf' : '#c41e3a',
    })
    setTimeout(() => {
      void chrome.action.setBadgeText({ tabId, text: '' })
    }, 4000)
    if (res.ok && !res.empty) {
      await showPageToast(tabId, message)
    }
  } catch {
    /* ignore */
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return
  if (info.menuItemId === MENU_FILL) {
    const res = await fillActiveTab(tab.id)
    await notifyFillResult(tab.id, res)
  } else if (info.menuItemId === MENU_SYNC) {
    await syncAllFromTab(tab.id)
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-page') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    const res = await fillActiveTab(tab.id)
    await notifyFillResult(tab.id, res)
  }
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
        const res = await fillActiveTab(tab.id)
        await notifyFillResult(tab.id, res)
        sendResponse(res)
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

      if (message?.type === 'PING_EXT') {
        sendResponse({ ok: true, loonieExt: true })
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
