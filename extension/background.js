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
 * MAIN-world filler (inline — no module imports). Keep in sync with lib/fill.js.
 * @param {Record<string, string | undefined>} u
 */
function mainWorldFill(u) {
  const summary = { filled: 0, highlighted: 0 }
  try {
    const HUMANIZE = (el) => {
      if (!el || typeof el.dispatchEvent !== 'function') return
      try {
        el.dispatchEvent(new Event('focus', { bubbles: true }))
      } catch (_) {}
      try {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: el.value,
          }),
        )
      } catch (_) {
        try {
          el.dispatchEvent(new Event('input', { bubbles: true }))
        } catch (_) {}
      }
      ;['change', 'blur'].forEach((ev) => {
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
      if (el.disabled || el.readOnly) return false
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
    const hay = (el) => {
      const n = (el.name || '').toLowerCase()
      const i = (el.id || '').toLowerCase()
      const p = (el.placeholder || '').toLowerCase()
      const a = ((el.getAttribute && el.getAttribute('aria-label')) || '').toLowerCase()
      const auto = (el.autocomplete || '').toLowerCase()
      let lbl = ''
      try {
        if (el.labels && el.labels[0]) lbl = (el.labels[0].textContent || '').toLowerCase()
        else if (el.id) {
          const by = document.querySelector(
            'label[for="' + String(el.id).replace(/"/g, '') + '"]',
          )
          if (by) lbl = (by.textContent || '').toLowerCase()
        }
      } catch (_) {}
      return [n, i, p, a, auto, lbl].join(' ')
    }
    const match = (el) => {
      const s = hay(el)
      const type = (el.type || '').toLowerCase()
      if ((type === 'email' || /e-?mail/i.test(s)) && u.email) return fill(el, u.email)
      if (/(first.*name|fname|given-name)/i.test(s) && u.first_name)
        return fill(el, u.first_name)
      if (/(last.*name|lname|family-name|surname)/i.test(s) && u.last_name)
        return fill(el, u.last_name)
      if (/(full.?name|your.?name|display.?name)/i.test(s) && u.name) return fill(el, u.name)
      if (/(^|[\s_-])name([\s_-]|$)/i.test(s) && !/user.?name|company|org|file/i.test(s)) {
        if (u.name) return fill(el, u.name)
        if (u.first_name) return fill(el, u.first_name)
      }
      if (/(address|street|addr1|address-line1)/i.test(s) && u.address)
        return fill(el, u.address)
      if (/(city|town|locality)/i.test(s) && u.city) return fill(el, u.city)
      if (/(province|state|region)/i.test(s) && u.province) return fill(el, u.province)
      if (/(postal|zip|post.?code)/i.test(s) && u.postal_code) return fill(el, u.postal_code)
      if (/(phone|mobile|tel)/i.test(s) && u.phone) return fill(el, u.phone)
      return false
    }
    const runOnce = () => {
      document.querySelectorAll('input,select,textarea').forEach((el) => {
        const type = (el.type || '').toLowerCase()
        if (
          type === 'hidden' ||
          type === 'submit' ||
          type === 'button' ||
          type === 'checkbox' ||
          type === 'radio' ||
          type === 'file' ||
          type === 'password' ||
          type === 'image'
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
          if (target && !target.dataset.loonieSkillHi) {
            target.style.border = '2px solid ' + pink
            target.style.boxShadow = '0 0 8px ' + pink
            target.dataset.loonieSkillHi = '1'
            summary.highlighted += 1
          }
        }
      })
    }
    runOnce()
    ;[600, 1800, 3500].forEach((ms) => {
      try {
        setTimeout(runOnce, ms)
      } catch (_) {}
    })
  } catch (_) {}
  return summary
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
  let summary = { filled: 0, highlighted: 0 }

  try {
    const mainResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: 'MAIN',
      func: mainWorldFill,
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

  // Isolated fallback if MAIN found nothing (some frames block MAIN injection)
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
        'No matching fields on this page. Try again after the form loads, or paste from Open & Enter copy chips.',
    }
  }

  return { ok: true, summary }
}

async function notifyFillResult(tabId, res) {
  try {
    const n = res.summary?.filled ?? 0
    const title = res.ok && !res.empty ? 'LoonieWins Smart-Fill' : 'LoonieWins Smart-Fill'
    const message =
      res.ok && !res.empty
        ? `Matched ${n} field(s). Review before submit.`
        : res.reason || 'No matching fields.'
    await chrome.action.setBadgeText({ tabId, text: n > 0 ? String(n) : '!' })
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: n > 0 ? '#2dd4bf' : '#c41e3a',
    })
    setTimeout(() => {
      void chrome.action.setBadgeText({ tabId, text: '' })
    }, 4000)
    void title
    void message
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
