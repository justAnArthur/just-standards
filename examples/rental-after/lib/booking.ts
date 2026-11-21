import { type CarClass, fleet, locations, terms } from '@/content/business'
import type { BookingQuery } from '@/components/BookingForm'

const ZONE = 'Europe/Bratislava'
const DAY = 86_400_000

/** Today's date in Bratislava, `YYYY-MM-DD`. */
export const todayIso = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(now)

export const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10)

/** The form's starting values: tomorrow at 9:00, back three days later. */
export function defaultQuery(today: string, pickup = 'centre'): BookingQuery {
  const known = locations.some(location => location.id === pickup) ? pickup : 'centre'
  return { pickup: known, dropoff: known, from: addDays(today, 1), fromTime: '09:00', to: addDays(today, 4), toTime: '09:00' }
}

type Params = Record<string, string | string[] | undefined>
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):00$/

export type Problem = 'dates' | 'order' | 'past'

/** The search in the URL, filled up from the defaults, and what's wrong with it; `searched` is false for a bare visit. */
export function readQuery(params: Params, today: string) {
  const pickup = one(params.pickup)
  const base = defaultQuery(today, pickup)
  const searched = Boolean(one(params.from) || one(params.to))
  const pick = (key: keyof BookingQuery, valid: (value: string) => boolean) => {
    const value = one(params[key])
    return value && valid(value) ? value : base[key]
  }
  const isLocation = (value: string) => locations.some(location => location.id === value)
  const query: BookingQuery = {
    pickup: pick('pickup', isLocation),
    dropoff: pick('dropoff', isLocation),
    from: pick('from', value => DATE.test(value)),
    fromTime: pick('fromTime', value => TIME.test(value)),
    to: pick('to', value => DATE.test(value)),
    toTime: pick('toTime', value => TIME.test(value)),
  }
  let problem: Problem | undefined
  if (searched && (!DATE.test(one(params.from) ?? '') || !DATE.test(one(params.to) ?? ''))) problem = 'dates'
  else if (query.from < today) problem = 'past'
  else if (`${query.to}T${query.toTime}` <= `${query.from}T${query.fromTime}`) problem = 'order'
  return { query, searched, problem }
}

/** Rental days: every started 24 hours, after an hour of grace. */
export function rentalDays(query: BookingQuery) {
  const start = Date.parse(`${query.from}T${query.fromTime}:00Z`)
  const end = Date.parse(`${query.to}T${query.toTime}:00Z`)
  const hours = (end - start) / 3_600_000
  return Math.max(1, Math.ceil((hours - terms.lateReturnGraceMinutes / 60) / 24))
}

export interface Quote {
  car: CarClass
  days: number
  perDay: number
  total: number
  km: number
}

/** The price of each class for the search, VAT included, with the weekly discount. */
export function quotes(query: BookingQuery): Quote[] {
  const days = rentalDays(query)
  const discount = days >= terms.weeklyFrom ? 1 - terms.weeklyDiscount / 100 : 1
  return fleet.map(car => {
    const perDay = Math.round(car.pricePerDay * discount * 100) / 100
    return { car, days, perDay, total: Math.round(perDay * days * 100) / 100, km: car.kmPerDay * days }
  })
}
