/**
 * Heuristic form filler (Assassin port for pages / executeScript worlds).
 * Safe: try/catch; never throws out of the IIFE.
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
      ;['input', 'change', 'blur'].forEach((ev) => {
        try {
          el.dispatchEvent(new Event(ev, { bubbles: true }))
        } catch {
          /* ignore */
        }
      })
      try {
        el.dispatchEvent(
          new InputEvent('input', { bubbles: true, data: el.value }),
        )
      } catch {
        /* ignore */
      }
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

    const match = (el) => {
      const n = (el.name || '').toLowerCase()
      const i = (el.id || '').toLowerCase()
      const p = (el.placeholder || '').toLowerCase()
      const a = (
        (el.getAttribute && el.getAttribute('aria-label')) ||
        ''
      ).toLowerCase()
      const auto = (el.autocomplete || '').toLowerCase()
      const s = [n, i, p, a, auto].join(' ')

      if (/e-?mail|autocomplete=["']?email/i.test(s) && u.email) {
        return fill(el, u.email) ? 'email' : null
      }
      if (/(first.*name|fname|given-name)/i.test(s) && u.first_name) {
        return fill(el, u.first_name) ? 'first_name' : null
      }
      if (/(last.*name|lname|family-name|surname)/i.test(s) && u.last_name) {
        return fill(el, u.last_name) ? 'last_name' : null
      }
      if (
        /(^|[\s_-])(full.?name|your.?name|display.?name)([\s_-]|$)/i.test(s) &&
        u.name
      ) {
        return fill(el, u.name) ? 'name' : null
      }
      if (/(^|[\s_-])name([\s_-]|$)/i.test(s) && !/user.?name|company/i.test(s)) {
        if (u.name) return fill(el, u.name) ? 'name' : null
        if (u.first_name) return fill(el, u.first_name) ? 'first_name' : null
      }
      if (/(address|street|addr1|address-line1)/i.test(s) && u.address) {
        return fill(el, u.address) ? 'address' : null
      }
      if (/(city|town|locality)/i.test(s) && u.city) {
        return fill(el, u.city) ? 'city' : null
      }
      if (/(province|state|region)/i.test(s) && u.province) {
        return fill(el, u.province) ? 'province' : null
      }
      if (/(postal|zip|post.?code)/i.test(s) && u.postal_code) {
        return fill(el, u.postal_code) ? 'postal_code' : null
      }
      if (/(phone|mobile|tel)/i.test(s) && u.phone) {
        return fill(el, u.phone) ? 'phone' : null
      }
      return null
    }

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
        type === 'password'
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
        if (target) {
          target.style.border = `2px solid ${pink}`
          target.style.boxShadow = `0 0 8px ${pink}`
          summary.highlighted += 1
        }
      }
    }
  } catch {
    /* never break the host page */
  }
  return summary
}
