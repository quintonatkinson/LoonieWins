import { describe, expect, it } from 'vitest'
import { checkinState, formatPassRemaining, proPassRemainingMs } from '../src/lib/earn/rewards'

const now = new Date('2026-09-26T15:00:00Z')

describe('daily check-in ladder', () => {
  it('starts at day 1 for new users and after a missed day', () => {
    expect(checkinState(null, now)).toEqual({ claimedToday: false, nextDay: 1, nextPoints: 20 })
    expect(checkinState({ checkin_streak: 5, last_checkin_on: '2026-09-20' }, now).nextDay).toBe(1)
  })
  it('continues the streak from yesterday and cycles after day 7', () => {
    expect(checkinState({ checkin_streak: 3, last_checkin_on: '2026-09-25' }, now)).toEqual({ claimedToday: false, nextDay: 4, nextPoints: 50 })
    expect(checkinState({ checkin_streak: 7, last_checkin_on: '2026-09-25' }, now).nextDay).toBe(1)
    expect(checkinState({ checkin_streak: 6, last_checkin_on: '2026-09-25' }, now).nextPoints).toBe(150)
  })
  it('reports claimed today', () => {
    expect(checkinState({ checkin_streak: 2, last_checkin_on: '2026-09-26' }, now).claimedToday).toBe(true)
  })
})

describe('Pro Pass countdown', () => {
  it('formats remaining time', () => {
    const t = Date.parse('2026-09-26T15:00:00Z')
    expect(formatPassRemaining(proPassRemainingMs('2026-09-27T14:00:00Z', t))).toBe('23h left')
    expect(formatPassRemaining(proPassRemainingMs('2026-10-02T15:00:00Z', t))).toBe('6d left')
    expect(proPassRemainingMs('2026-09-01T00:00:00Z', t)).toBe(0)
  })
})
