import Link from 'next/link'
import { company, type Location, tel } from '@/content/business'
import { t } from '@/content/dictionary'
import { type Locale, pathOf } from '@/lib/i18n'
import { mapUrl } from '@/lib/jsonld'
import { Hours } from './Hours'

/** A pick-up point with its address, hours, phone and the way to its page and the map. */
export function LocationCard({ location, lang, heading = 'h3' }: { location: Location; lang: Locale; heading?: 'h2' | 'h3' }) {
  const d = t(lang)
  const Heading = heading
  return (
    <article className="flex flex-col rounded-lg border border-line bg-white p-6">
      <Heading className="text-xl font-semibold">
        <Link href={pathOf(location.page, lang)} className="hover:underline">
          {company.brand} – {location.name[lang]}
        </Link>
      </Heading>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">{d.address}</dt>
          <dd>
            {location.street}, {location.postalCode} {location.city}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{d.hours}</dt>
          <dd>
            <Hours location={location} lang={lang} />
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{d.phone}</dt>
          <dd>
            <a href={tel(location.phone)} className="text-brand underline underline-offset-2">
              {location.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{d.email}</dt>
          <dd>
            <a href={`mailto:${location.email}`} className="text-brand underline underline-offset-2">
              {location.email}
            </a>
          </dd>
        </div>
      </dl>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href={pathOf(location.page, lang)} className="font-semibold text-brand underline underline-offset-2">
          {d.detail}
        </Link>
        <a href={mapUrl(location)} className="text-brand underline underline-offset-2">
          {d.map}
        </a>
      </p>
    </article>
  )
}
