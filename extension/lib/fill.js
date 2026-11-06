/**
 * Heuristic form filler (Assassin-aligned). Aggressive matching + required/submit cues.
 * Safe: try/catch; never throws out of the function.
 */

/**
 * @param {Record<string, string | undefined>} u
 * @returns {{ filled: number, highlighted: number, requiredEmpty: number, walls: string[] }}
 */
export function fillFormWithProfile(u) {
  const summary = { filled: 0, highlighted: 0, requiredEmpty: 0, walls: [] }
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
      const a = (
        (el.getAttribute && el.getAttribute('aria-label')) ||
        ''
      ).toLowerCase()
      const auto = (el.autocomplete || '').toLowerCase()
      const tit = ((el.getAttribute && el.getAttribute('title')) || '').toLowerCase()
      const dn = (
        (el.getAttribute &&
          (el.getAttribute('data-name') ||
            el.getAttribute('data-field') ||
            el.getAttribute('data-testid'))) ||
        ''
      ).toLowerCase()
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
        if (!lbl && el.parentElement) {
          const prev = el.previousElementSibling
          if (
            prev &&
            (/^LABEL$/i.test(prev.tagName) || /label/i.test(prev.className || ''))
          ) {
            lbl = (prev.textContent || '').toLowerCase()
          }
        }
      } catch {
        /* ignore */
      }
      return [n, i, p, a, auto, tit, dn, lbl].join(' ')
    }

    const dobParts = (raw) => {
      const s = String(raw || '').trim()
      if (!s) return null
      let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
      if (m) return { y: m[1], mo: ('0' + m[2]).slice(-2), d: ('0' + m[3]).slice(-2) }
      m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
      if (m) return { y: m[3], mo: ('0' + m[1]).slice(-2), d: ('0' + m[2]).slice(-2) }
      return null
    }

    const fillDob = (el) => {
      if (!u.dob) return false
      const parts = dobParts(u.dob)
      const type = (el.type || '').toLowerCase()
      if (type === 'date' && parts) {
        return fill(el, parts.y + '-' + parts.mo + '-' + parts.d)
      }
      const s = hay(el)
      if (/yyyy|year|birth[_\s-]?year/i.test(s) && parts) return fill(el, parts.y)
      if (/mm|month|birth[_\s-]?month/i.test(s) && parts && !/yyyy|year/i.test(s)) {
        return fill(el, parts.mo)
      }
      if (/\bdd\b|day|birth[_\s-]?day/i.test(s) && parts && !/birthday|dob/i.test(s)) {
        return fill(el, parts.d)
      }
      if (parts) {
        if (/iso|yyyy/.test(s)) return fill(el, parts.y + '-' + parts.mo + '-' + parts.d)
        return fill(el, parts.mo + '/' + parts.d + '/' + parts.y)
      }
      return fill(el, u.dob)
    }

    const match = (el) => {
      const s = hay(el)
      const type = (el.type || '').toLowerCase()

      if ((type === 'email' || /e-?mail|autocomplete=["']?email/i.test(s)) && u.email) {
        return fill(el, u.email)
      }
      if (
        /(first[_\s-]?name|fname|given[-_]?name|autocomplete[^\\s]*given-name)/i.test(s) &&
        u.first_name
      ) {
        return fill(el, u.first_name)
      }
      if (
        /(last[_\s-]?name|lname|family[-_]?name|surname|autocomplete[^\\s]*family-name)/i.test(
          s,
        ) &&
        u.last_name
      ) {
        return fill(el, u.last_name)
      }
      if (
        /(full[_\s-]?name|your[_\s-]?name|display[_\s-]?name|\bname\b)/i.test(s) &&
        !/(user|file|company|org|team|user[_\s-]?name)/i.test(s)
      ) {
        if (u.name) return fill(el, u.name)
        if (u.first_name) return fill(el, u.first_name)
      }
      if (
        /(address|street|addr1|address1|address[_\s-]?line|address-line1)/i.test(s) &&
        !/email/i.test(s) &&
        u.address
      ) {
        return fill(el, u.address)
      }
      if (/(city|town|locality)/i.test(s) && u.city) return fill(el, u.city)
      if (/(province|state|region|admin)/i.test(s) && u.province) {
        return fill(el, u.province)
      }
      if (/(postal|zip|post[_\s-]?code)/i.test(s) && u.postal_code) {
        return fill(el, u.postal_code)
      }
      if ((type === 'tel' || /(phone|mobile|tel|cell)/i.test(s)) && u.phone) {
        return fill(el, u.phone)
      }
      if (
        type === 'date' ||
        /(birth|dob|date[_\s-]?of[_\s-]?birth|birthday|bday|born)/i.test(s)
      ) {
        return fillDob(el)
      }
      return false
    }

    const isEmpty = (el) => {
      if (el.tagName === 'SELECT') return !el.value || el.selectedIndex <= 0
      return !String(el.value || '').trim()
    }

    const highlightRequiredEmpty = () => {
      let first = null
      summary.requiredEmpty = 0
      document.querySelectorAll('input,select,textarea').forEach((el) => {
        const type = (el.type || '').toLowerCase()
        if (
          type === 'hidden' ||
          type === 'submit' ||
          type === 'button' ||
          type === 'image' ||
          type === 'file'
        ) {
          return
        }
        const req =
          el.required ||
          el.getAttribute('aria-required') === 'true' ||
          /required|mandatory/i.test(hay(el))
        if (!req || !isEmpty(el) || el.disabled) return
        summary.requiredEmpty += 1
        el.style.outline = '2px solid #fbbf24'
        el.style.outlineOffset = '2px'
        if (!first) first = el
      })
      return first
    }

    const findSubmit = () => {
      const cand = document.querySelectorAll(
        'button,input[type=submit],input[type=button],a[role=button]',
      )
      for (const el of cand) {
        const t = (
          (el.innerText || el.value || el.getAttribute?.('aria-label') || '') + ''
        ).toLowerCase()
        if (
          /submit|enter|enter now|apply|register|sign me up|join|claim|send|continue|next|finish|done/i.test(
            t,
          ) &&
          !/cancel|back|previous|login|sign in|log in/i.test(t)
        ) {
          return el
        }
      }
      return document.querySelector('button[type=submit],input[type=submit]')
    }

    const detectWalls = () => {
      summary.walls = []
      const html = ((document.body && document.body.innerHTML) || '').toLowerCase()
      const text = (
        (document.body && (document.body.innerText || document.body.textContent)) ||
        ''
      ).toLowerCase()
      if (
        /recaptcha|hcaptcha|g-recaptcha|cf-turnstile|captcha|i'?m not a robot/.test(html) ||
        /\bcaptcha\b/.test(text)
      ) {
        summary.walls.push('captcha')
      }
      if (
        /\b(sign\s*in|log\s*in|create (an )?account|already have an account)\b/.test(text) &&
        document.querySelector('input[type=password]')
      ) {
        summary.walls.push('sign-in')
      }
      if (
        /\b(purchase|buy now|add to cart|checkout|order now|pay now)\b/.test(text) &&
        !/no purchase|without purchase|no purchase necessary/i.test(text)
      ) {
        summary.walls.push('purchase')
      }
    }

    const scrollFocus = (el) => {
      if (!el) return
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        try {
          el.scrollIntoView(true)
        } catch {
          /* ignore */
        }
      }
      try {
        el.focus()
      } catch {
        /* ignore */
      }
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
      const labels = document.querySelectorAll('label,legend,p,span,div')
      let scanned = 0
      for (const lbl of labels) {
        if (scanned++ > 400) break
        const t = (lbl.textContent || '').toLowerCase()
        if (
          !/\b(math|skill[_\s-]?testing|equation|answer correctly)\b/i.test(t) &&
          !/\d+\s*[+\-*/]\s*\d+/.test(lbl.textContent || '')
        ) {
          continue
        }
        const forId = lbl.getAttribute?.('for')
        let target = forId
          ? document.getElementById(forId)
          : lbl.querySelector?.('input,select,textarea')
        if (
          !target &&
          lbl.nextElementSibling &&
          /^(INPUT|SELECT|TEXTAREA)$/i.test(lbl.nextElementSibling.tagName)
        ) {
          target = lbl.nextElementSibling
        }
        if (target && !target.dataset.loonieSkillHi) {
          target.style.border = `2px solid ${pink}`
          target.style.boxShadow = `0 0 8px ${pink}`
          target.dataset.loonieSkillHi = '1'
          summary.highlighted += 1
        }
      }

      detectWalls()
      const emptyEl = highlightRequiredEmpty()
      const submit = findSubmit()
      if (emptyEl) scrollFocus(emptyEl)
      else if (submit) {
        try {
          submit.style.outline = '2px solid #2dd4bf'
          submit.style.outlineOffset = '3px'
        } catch {
          /* ignore */
        }
        scrollFocus(submit)
      }
    }

    runOnce()
    ;[600, 1800, 3500, 8000].forEach((ms) => {
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
 * @param {Array<{ result?: { filled?: number, highlighted?: number, requiredEmpty?: number, walls?: string[] } } | undefined>} results
 */
export function aggregateFillResults(results) {
  let best = { filled: 0, highlighted: 0, requiredEmpty: 0, walls: [] }
  let totalFilled = 0
  let totalHighlighted = 0
  const wallSet = new Set()
  for (const row of results || []) {
    const r = row?.result
    if (!r || typeof r !== 'object') continue
    const filled = Number(r.filled) || 0
    const highlighted = Number(r.highlighted) || 0
    totalFilled += filled
    totalHighlighted += highlighted
    for (const w of r.walls || []) wallSet.add(w)
    if (filled > best.filled) {
      best = {
        filled,
        highlighted,
        requiredEmpty: Number(r.requiredEmpty) || 0,
        walls: [...(r.walls || [])],
      }
    }
  }
  if (totalFilled > best.filled) {
    return {
      filled: totalFilled,
      highlighted: totalHighlighted,
      requiredEmpty: best.requiredEmpty,
      walls: [...wallSet],
    }
  }
  best.walls = [...new Set([...(best.walls || []), ...wallSet])]
  return best
}
