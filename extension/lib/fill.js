/**
 * Heuristic form filler (Assassin-aligned for pages / executeScript worlds).
 * Safe: try/catch; never throws out of the function.
 */

/**
 * Runs in the page (or isolated world). Returns a small summary object.
 * @param {Record<string, string | undefined>} u
 * @returns {{ filled: number, highlighted: number }}
 */
export function fillFormWithProfile(u) {
  const summary = { filled: 0, highlighted: 0 }
  try {
    const HUMANIZE = (el) => {
      if (!el || typeof el.dispatchEvent !== 'function') return
      try {
        el.dispatchEvent(new Event('focus', { bubbles: true }))
      } catch {
        /* ignore */
      }
      try {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: el.value,
          }),
        )
      } catch {
        try {
          el.dispatchEvent(new Event('input', { bubbles: true }))
        } catch {
          /* ignore */
        }
      }
      ;['change', 'blur'].forEach((ev) => {
        try {
          el.dispatchEvent(new Event(ev, { bubbles: true }))
        } catch {
          /* ignore */
        }
      })
    }

    const setNativeValue = (el, val) => {
      const proto =
        el.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype
      const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      if (desc?.set) desc.set.call(el, val)
      else el.value = val
    }

    const fill = (el, val) => {
      if (!val) return false
      if (el.disabled || el.readOnly) return false
      if (el.tagName === 'SELECT') {
        const opts = Array.from(el.options || [])
        const lower = val.toLowerCase()
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
      const a = (
        (el.getAttribute && el.getAttribute('aria-label')) ||
        ''
      ).toLowerCase()
      const auto = (el.autocomplete || '').toLowerCase()
      let lbl = ''
      try {
        if (el.labels && el.labels[0]) {
          lbl = (el.labels[0].textContent || '').toLowerCase()
        } else if (el.id) {
          const by = document.querySelector(
            'label[for="' + String(el.id).replace(/"/g, '') + '"]',
          )
          if (by) lbl = (by.textContent || '').toLowerCase()
        }
      } catch {
        /* ignore */
      }
      return [n, i, p, a, auto, lbl].join(' ')
    }

    const match = (el) => {
      const s = hay(el)
      const type = (el.type || '').toLowerCase()

      if (
        (type === 'email' || /e-?mail|autocomplete=["']?email/i.test(s)) &&
        u.email
      ) {
        return fill(el, u.email)
      }
      if (/(first.*name|fname|given-name)/i.test(s) && u.first_name) {
        return fill(el, u.first_name)
      }
      if (/(last.*name|lname|family-name|surname)/i.test(s) && u.last_name) {
        return fill(el, u.last_name)
      }
      if (
        /(^|[\s_-])(full.?name|your.?name|display.?name)([\s_-]|$)/i.test(s) &&
        u.name
      ) {
        return fill(el, u.name)
      }
      if (/(^|[\s_-])name([\s_-]|$)/i.test(s) && !/user.?name|company|org|file/i.test(s)) {
        if (u.name) return fill(el, u.name)
        if (u.first_name) return fill(el, u.first_name)
      }
      if (/(address|street|addr1|address-line1)/i.test(s) && u.address) {
        return fill(el, u.address)
      }
      if (/(city|town|locality)/i.test(s) && u.city) {
        return fill(el, u.city)
      }
      if (/(province|state|region)/i.test(s) && u.province) {
        return fill(el, u.province)
      }
      if (/(postal|zip|post.?code)/i.test(s) && u.postal_code) {
        return fill(el, u.postal_code)
      }
      if (/(phone|mobile|tel)/i.test(s) && u.phone) {
        return fill(el, u.phone)
      }
      return false
    }

    const runOnce = () => {
      const nodes = document.querySelectorAll('input,select,textarea')
      for (const el of nodes) {
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
          continue
        }
        if (match(el)) summary.filled += 1
      }

      const pink = '#FF10F0'
      const labels = document.querySelectorAll('label')
      for (const lbl of labels) {
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
            target.style.border = `2px solid ${pink}`
            target.style.boxShadow = `0 0 8px ${pink}`
            target.dataset.loonieSkillHi = '1'
            summary.highlighted += 1
          }
        }
      }
    }

    runOnce()
    // SPA / delayed mounts (best-effort; isolated world may not keep timers long)
    ;[600, 1800, 3500].forEach((ms) => {
      try {
        setTimeout(runOnce, ms)
      } catch {
        /* ignore */
      }
    })
  } catch {
    /* never break the host page */
  }
  return summary
}

/**
 * Aggregate injection results across frames (prefer highest filled count).
 * @param {Array<{ result?: { filled?: number, highlighted?: number } } | undefined>} results
 */
export function aggregateFillResults(results) {
  let best = { filled: 0, highlighted: 0 }
  let totalFilled = 0
  let totalHighlighted = 0
  for (const row of results || []) {
    const r = row?.result
    if (!r || typeof r !== 'object') continue
    const filled = Number(r.filled) || 0
    const highlighted = Number(r.highlighted) || 0
    totalFilled += filled
    totalHighlighted += highlighted
    if (filled > best.filled) best = { filled, highlighted }
  }
  // Prefer sum across frames (iframe widgets + top page) when both filled.
  if (totalFilled > best.filled) {
    return { filled: totalFilled, highlighted: totalHighlighted }
  }
  return best
}
