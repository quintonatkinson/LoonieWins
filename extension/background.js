import { getSettings } from './lib/storage.js'
import { toFillPayload, hasUsableProfile } from './lib/profile.js'
import { fillFormWithProfile } from './lib/fill.js'
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
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: (u) => {
      // Inline a minimal copy so MAIN world does not depend on extension modules.
      const summary = { filled: 0, highlighted: 0 }
      try {
        const HUMANIZE = (el) => {
          if (!el || typeof el.dispatchEvent !== 'function') return
          ;['input', 'change', 'blur'].forEach((ev) => {
            try {
              el.dispatchEvent(new Event(ev, { bubbles: true }))
            } catch (_) {}
          })
        }
        const setNativeValue = (el, val) => {
          const proto =
            el.tagName === 'TEXTAREA'
              ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype
          const desc = Object.getOwnPropertyDescriptor(proto, 'value')
          if (desc && desc.set) desc.set.call(el, val)
          else el.value = val
        }
        const fill = (el, val) => {
          if (!val) return false
          if (el.tagName === 'SELECT') {
            const opts = Array.from(el.options || [])
            const lower = String(val).toLowerCase()
            const exact = opts.find(
              (o) => (o.text || o.value || '').toLowerCase() === lower,
            )
            if (exact) {
              el.value = exact.value
              HUMANIZE(el)
              return true
            }
            const partial = opts.find((o) =>
              (o.value || o.text || '').toLowerCase().includes(lower),
            )
            if (partial) {
              el.value = partial.value
              HUMANIZE(el)
              return true
            }
            return false
          }
          setNativeValue(el, val)
          el.setAttribute('value', val)
          HUMANIZE(el)
          return true
        }
        const match = (el) => {
          const n = (el.name || '').toLowerCase()
          const i = (el.id || '').toLowerCase()
          const p = (el.placeholder || '').toLowerCase()
          const a = ((el.getAttribute && el.getAttribute('aria-label')) || '').toLowerCase()
          const auto = (el.autocomplete || '').toLowerCase()
          const s = [n, i, p, a, auto].join(' ')
          if (/e-?mail/i.test(s) && u.email) return fill(el, u.email)
          if (/(first.*name|fname|given-name)/i.test(s) && u.first_name)
            return fill(el, u.first_name)
          if (/(last.*name|lname|family-name|surname)/i.test(s) && u.last_name)
            return fill(el, u.last_name)
          if (/(full.?name|your.?name)/i.test(s) && u.name) return fill(el, u.name)
          if (/(^|[\s_-])name([\s_-]|$)/i.test(s) && !/user.?name|company/i.test(s)) {
            if (u.name) return fill(el, u.name)
            if (u.first_name) return fill(el, u.first_name)
          }
          if (/(address|street|addr1)/i.test(s) && u.address) return fill(el, u.address)
          if (/(city|town|locality)/i.test(s) && u.city) return fill(el, u.city)
          if (/(province|state|region)/i.test(s) && u.province) return fill(el, u.province)
          if (/(postal|zip)/i.test(s) && u.postal_code) return fill(el, u.postal_code)
          if (/(phone|mobile|tel)/i.test(s) && u.phone) return fill(el, u.phone)
          return false
        }
        document.querySelectorAll('input,select,textarea').forEach((el) => {
          const type = (el.type || '').toLowerCase()
          if (
            type === 'hidden' ||
            type === 'submit' ||
            type === 'button' ||
            type === 'checkbox' ||
            type === 'radio' ||
            type === 'file' ||
            type === 'password'
          ) {
            return
          }
          if (match(el)) summary.filled += 1
        })
        const pink = '#FF10F0'
        document.querySelectorAll('label').forEach((lbl) => {
          const t = (lbl.textContent || '').toLowerCase()
          if (
            /\b(math|skill testing|equation|answer correctly)\b/i.test(t) ||
            /\d+\s*[+\-*/]\s*\d+/.test(lbl.textContent || '')
          ) {
            const forId = lbl.getAttribute('for')
            const target = forId
              ? document.getElementById(forId)
              : lbl.querySelector('input,select,textarea')
            if (target) {
              target.style.border = '2px solid ' + pink
              target.style.boxShadow = '0 0 8px ' + pink
              summary.highlighted += 1
            }
          }
        })
      } catch (_) {}
      return summary
    },
    args: [payload],
  })

  // Also try isolated world as fallback summary if MAIN returned nothing
  let summary = result || { filled: 0, highlighted: 0 }
  if (!summary.filled) {
    try {
      const [{ result: iso } = {}] = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: fillFormWithProfile,
        args: [payload],
      })
      if (iso && iso.filled > summary.filled) summary = iso
    } catch {
      /* ignore */
    }
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
