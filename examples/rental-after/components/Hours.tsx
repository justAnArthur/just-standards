import type { Location } from '@/content/business'
import type { Locale } from '@/lib/i18n'
import { closedDays, hoursLine } from '@/lib/format'

/** A branch's opening hours, one line per rule, and the days it is closed. */
export function Hours({ location, lang }: { location: Location; lang: Locale }) {
  const closed = closedDays(location.hours, lang)
  return (
    <ul className="space-y-0.5">
      {location.hours.map(hours => (
        <li key={hours.days.join()}>{hoursLine(hours, lang)}</li>
      ))}
      {closed ? <li>{closed}</li> : null}
    </ul>
  )
}
