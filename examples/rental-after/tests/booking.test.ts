import { describe, expect, test } from 'bun:test'
import { addDays, quotes, readQuery, rentalDays } from '@/lib/booking'

const today = '2026-11-21'

describe('booking search', () => {
  test('a bare visit starts tomorrow and lasts three days', () => {
    const { query, searched, problem } = readQuery({}, today)
    expect(searched).toBe(false)
    expect(problem).toBeUndefined()
    expect(query.from).toBe('2026-11-22')
    expect(rentalDays(query)).toBe(3)
  })

  test('a return before the pick-up is a problem', () => {
    const { problem } = readQuery({ from: '2026-11-25', to: '2026-11-24' }, today)
    expect(problem).toBe('order')
  })

  test('a pick-up in the past is a problem', () => {
    expect(readQuery({ from: '2026-11-20', to: '2026-11-24' }, today).problem).toBe('past')
  })

  test('every started day counts, after 59 minutes of grace', () => {
    const base = { pickup: 'centre', dropoff: 'centre', from: today, fromTime: '09:00', to: addDays(today, 2), toTime: '09:00' }
    expect(rentalDays(base)).toBe(2)
    expect(rentalDays({ ...base, toTime: '10:00' })).toBe(3)
    expect(rentalDays({ ...base, to: today, toTime: '12:00' })).toBe(1)
  })

  test('a week or more is 10 % cheaper per day', () => {
    const week = readQuery({ from: '2026-12-01', to: '2026-12-08' }, today).query
    const [city] = quotes(week)
    expect(city?.days).toBe(7)
    expect(city?.perDay).toBe(26.1)
    expect(city?.total).toBe(182.7)
  })
})
