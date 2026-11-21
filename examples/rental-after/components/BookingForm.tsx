import { locations } from '@/content/business'
import { t } from '@/content/dictionary'
import { addDays } from '@/lib/booking'
import { type Locale, pathOf } from '@/lib/i18n'

export interface BookingQuery {
  pickup: string
  dropoff: string
  from: string
  fromTime: string
  to: string
  toTime: string
}

const TIMES = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`)
/** How far ahead the form books. */
const DAYS_AHEAD = 180

const dayLabel = (iso: string, lang: Locale) =>
  new Intl.DateTimeFormat(lang === 'sk' ? 'sk-SK' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  )

/** The dates on offer, as a list: one Tab stop, the same in every browser, readable by every screen reader. */
function DateOptions({ today, lang, selected }: { today: string; lang: Locale; selected: string }) {
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i))
  // a date in the URL beyond the list stays selectable
  if (!dates.includes(selected) && selected >= today) dates.push(selected)
  return (
    <>
      {dates.map(date => (
        <option key={date} value={date}>
          {dayLabel(date, lang)}
        </option>
      ))}
    </>
  )
}

/**
 * The booking search: pick-up and return point, dates and times. A plain GET form of selects to the booking page, so it
 * works with the keyboard alone and without JavaScript.
 */
export function BookingForm({ lang, query, today, compact = false }: { lang: Locale; query: BookingQuery; today: string; compact?: boolean }) {
  const d = t(lang).booking
  const field = 'mt-1 block w-full rounded-md border border-muted bg-white px-3 py-2.5 text-base text-ink'
  const label = 'block text-sm font-semibold text-ink'
  return (
    <form action={pathOf('booking', lang)} method="get" className="rounded-lg bg-white p-5 text-ink shadow-lg sm:p-6" aria-labelledby="booking-form-title">
      <h2 id="booking-form-title" className={compact ? 'sr-only' : 'text-xl font-semibold'}>
        {d.title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pickup" className={label}>
            {d.pickup}
          </label>
          <select id="pickup" name="pickup" defaultValue={query.pickup} className={field}>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name[lang]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dropoff" className={label}>
            {d.dropoff}
          </label>
          <select id="dropoff" name="dropoff" defaultValue={query.dropoff} className={field}>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name[lang]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_9rem] gap-3 sm:col-span-2">
          <div>
            <label htmlFor="from" className={label}>
              {d.from}
            </label>
            <select id="from" name="from" required defaultValue={query.from} className={field}>
              <DateOptions today={today} lang={lang} selected={query.from} />
            </select>
          </div>
          <div>
            <label htmlFor="fromTime" className={label}>
              {d.fromTime}
            </label>
            <select id="fromTime" name="fromTime" defaultValue={query.fromTime} className={field}>
              {TIMES.map(time => (
                <option key={time}>{time}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_9rem] gap-3 sm:col-span-2">
          <div>
            <label htmlFor="to" className={label}>
              {d.to}
            </label>
            <select id="to" name="to" required defaultValue={query.to} className={field}>
              <DateOptions today={today} lang={lang} selected={query.to} />
            </select>
          </div>
          <div>
            <label htmlFor="toTime" className={label}>
              {d.toTime}
            </label>
            <select id="toTime" name="toTime" defaultValue={query.toTime} className={field}>
              {TIMES.map(time => (
                <option key={time}>{time}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <button type="submit" className="mt-5 w-full rounded-md bg-accent px-5 py-3 text-base font-semibold text-ink hover:bg-[#e0a600] sm:w-auto">
        {d.submit}
      </button>
      <p className="mt-3 text-sm text-muted">{d.note}</p>
    </form>
  )
}
