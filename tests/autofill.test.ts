// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { AUTOFILL_ENGINE_SOURCE } from '../src/lib/autofill/engine.generated'
import { getInjectionScript } from '../src/lib/autofill/assassin'

type Summary = { filled: number; candidates: number; fields: string[] }
const engine = new Function(`${AUTOFILL_ENGINE_SOURCE}; return loonieAutofill`)() as (u: object) => Summary

const on = {
  first_name: 'Quinton', last_name: 'Atkinson', email: 'q@example.com', address: '123 Main St',
  city: 'Toronto', province: 'ON', postal_code: 'm5v 2t6', phone: '+1 (416) 555-0199',
}
const val = (sel: string) => (document.querySelector(sel) as HTMLInputElement).value

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('shared autofill engine', () => {
  it('fills a typical Canadian contest form', () => {
    document.body.innerHTML = `
      <label for="f">First name</label><input id="f" name="fname">
      <label for="l">Last name</label><input id="l" name="lname">
      <input type="email" name="email">
      <label for="a">Street address</label><input id="a" name="address1">
      <label for="c">City</label><input id="c" name="billing_city">
      <select name="province"><option value=""></option><option value="BC">British Columbia</option><option value="ON">Ontario</option></select>
      <label for="p">Postal code</label><input id="p" name="postal_code" maxlength="6">
      <select name="country"><option value="">Choose</option><option value="US">United States</option><option value="CA">Canada</option></select>
      <input type="tel" name="phone">`
    const s = engine(on)
    expect(val('[name=fname]')).toBe('Quinton')
    expect(val('[name=lname]')).toBe('Atkinson')
    expect(val('[name=email]')).toBe('q@example.com')
    expect(val('[name=address1]')).toBe('123 Main St')
    expect(val('[name=billing_city]')).toBe('Toronto')
    expect(val('[name=province]')).toBe('ON')
    expect(val('[name=postal_code]')).toBe('M5V2T6')
    expect(val('[name=country]')).toBe('CA')
    expect(val('[name=phone]')).toBe('416-555-0199')
    expect(s.filled).toBe(9)
  })

  it('maps province/state codes to full-name options and back', () => {
    document.body.innerHTML = `
      <select name="state"><option>Pick</option><option>New York</option><option>Texas</option></select>
      <input name="province" maxlength="2">`
    engine({ province: 'NY', country: 'US' })
    expect(val('[name=state]')).toBe('New York')
    expect(val('[name=province]')).toBe('NY')
  })

  it('leaves friend / referral, username, company, promo and address-line-2 fields alone', () => {
    document.body.innerHTML = `
      <label for="fe">Friend's email</label><input id="fe" name="friend_email">
      <input name="referral_email" placeholder="Refer a friend">
      <input name="username"><input name="company_name"><input name="promo_code">
      <input name="address_line_2" placeholder="Apt / Suite">
      <label for="e">Ethnicity</label><input id="e" name="ethnicity">
      <label for="h">Hotel</label><input id="h" name="hotel">`
    const s = engine(on)
    expect(s.filled).toBe(0)
    for (const el of Array.from(document.querySelectorAll('input'))) expect(el.value).toBe('')
  })

  it('never overwrites a value the user typed, even on re-run', () => {
    document.body.innerHTML = `<input name="first_name" value="Q"><input name="last_name">`
    engine(on)
    ;(document.querySelector('[name=last_name]') as HTMLInputElement).value = 'Edited'
    engine(on)
    expect(val('[name=first_name]')).toBe('Q')
    expect(val('[name=last_name]')).toBe('Edited')
  })

  it('does not auto-answer skill-testing questions, only highlights them', () => {
    document.body.innerHTML = `<label for="q">Skill testing question: 6 x 3 + 2 =</label><input id="q" name="skill">`
    engine(on)
    const el = document.querySelector('#q') as HTMLInputElement
    expect(el.value).toBe('')
    expect(el.style.border).toContain('solid')
  })
})

describe('web injection wrapper', () => {
  it('produces a script that runs the engine in-page', () => {
    document.body.innerHTML = `<input type="email" name="email">`
    new Function(getInjectionScript({ email: 'x@y.com' }))()
    expect(val('[name=email]')).toBe('x@y.com')
  })
})
