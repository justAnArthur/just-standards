import type { Day, Hours } from '@/content/business'
import type { Locale } from '@/lib/i18n'

const intl: Record<Locale, string> = { sk: 'sk-SK', en: 'en-GB' }

/** A price in euros as each language writes it: "29 €", "0,20 €"; "€29", "€0.20". */
export function eur(amount: number, lang: Locale) {
  const digits = Number.isInteger(amount) ? 0 : 2
  return new Intl.NumberFormat(intl[lang], { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
}

export const number = (value: number, lang: Locale) => new Intl.NumberFormat(intl[lang]).format(value)

const DAY_NAMES: Record<Locale, Record<Day, string>> = {
  sk: { Monday: 'po', Tuesday: 'ut', Wednesday: 'st', Thursday: 'št', Friday: 'pi', Saturday: 'so', Sunday: 'ne' },
  en: { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' },
}

const LONG_DAY_NAMES: Record<Locale, Record<Day, string>> = {
  sk: { Monday: 'pondelok', Tuesday: 'utorok', Wednesday: 'streda', Thursday: 'štvrtok', Friday: 'piatok', Saturday: 'sobota', Sunday: 'nedeľa' },
  en: { Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday', Saturday: 'Saturday', Sunday: 'Sunday' },
}

export const dayName = (day: Day, lang: Locale) => LONG_DAY_NAMES[lang][day]

/** "po – pi", "denne"; "Mon – Fri", "daily". */
export function days(list: Day[], lang: Locale) {
  if (list.length === 7) return lang === 'sk' ? 'denne' : 'daily'
  if (list.length === 1) return DAY_NAMES[lang][list[0] as Day]
  return `${DAY_NAMES[lang][list[0] as Day]} – ${DAY_NAMES[lang][list.at(-1) as Day]}`
}

/** "8:00 – 18:00" */
export const time = (value: string) => value.replace(/^0/, '')

export const hoursLine = (hours: Hours, lang: Locale) => `${days(hours.days, lang)} ${time(hours.opens)} – ${time(hours.closes)}`

/** The closed days, for "ne zatvorené" / "Sun closed". */
export function closedDays(hours: Hours[], lang: Locale) {
  const open = new Set(hours.flatMap(h => h.days))
  const closed = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as Day[]).filter(day => !open.has(day))
  if (closed.length === 0) return undefined
  return `${days(closed, lang)} ${lang === 'sk' ? 'zatvorené' : 'closed'}`
}

/** "21. novembra 2026"; "21 November 2026". */
export const longDate = (iso: string, lang: Locale) =>
  new Intl.DateTimeFormat(intl[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bratislava' }).format(new Date(`${iso}T12:00:00Z`))
