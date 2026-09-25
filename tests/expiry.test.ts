import { describe, expect, it } from 'vitest'
import { normalizeXmlItem } from '../src/lib/data/normalizer'
import { MASTER_SOURCES } from '../src/lib/data/sources'

const source = MASTER_SOURCES.find((s) => s.enabled !== false && s.type !== 'scaffold')!
const expiryOf = (description: string) =>
  normalizeXmlItem({ title: 'Win a prize', link: 'https://example.com/c', description }, source, 0)

const localDate = (iso?: string) => {
  if (!iso) return undefined
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('expiry extraction', () => {
  it.each([
    ['Contest ends 2027-10-01. Good luck', '2027-10-01'],
    ['Ends: March 5, 2027', '2027-03-05'],
    ['Contest ends Friday, March 5, 2027', '2027-03-05'],
    ['closes on Oct 3rd, 2027', '2027-10-03'],
    ['Deadline: 20 March 2027', '2027-03-20'],
    ['Expires 12/31/2027', '2027-12-31'],
    ['Contest ended 2026-09-15', '2026-09-15'],
  ])('%s', (text, expected) => {
    const c = expiryOf(text)
    expect(localDate(c.expiryDate)).toBe(expected)
    expect(c.is_estimated_expiry).toBe(false)
  })

  it('leaves expiry undefined when no date is stated (never guesses)', () => {
    const c = expiryOf('Enter for your chance to win!')
    expect(c.expiryDate).toBeUndefined()
  })

  it('rolls a year-less date that is long past into next year', () => {
    const past = new Date(Date.now() - 120 * 86400000)
    const month = past.toLocaleString('en-US', { month: 'long' })
    const c = expiryOf(`Ends ${month} ${past.getDate()}`)
    expect(new Date(c.expiryDate!).getTime()).toBeGreaterThan(Date.now())
  })
})
