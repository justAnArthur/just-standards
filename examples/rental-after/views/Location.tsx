import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { company, type Location as Branch, tel } from '@/content/business'
import { t } from '@/content/dictionary'
import { dayName } from '@/lib/format'
import { type Locale, pathOf } from '@/lib/i18n'
import { mapUrl } from '@/lib/jsonld'

const copy = {
  sk: {
    lead: (branch: Branch) => `Pobočka ${company.brand} ${branch.short.sk === 'Letisko' ? 'na letisku' : 'v centre'} Bratislavy: adresa, otváracie hodiny, cesta a vrátenie auta mimo otváracích hodín.`,
    contact: 'Adresa a kontakt',
    hours: 'Otváracie hodiny',
    closed: 'zatvorené',
    way: 'Ako sa k nám dostanete',
    desk: 'Kde nás nájdete',
    after: 'Vrátenie mimo otváracích hodín',
    coords: 'Súradnice GPS',
    book: 'Rezervovať auto na tejto pobočke',
    other: 'Druhá pobočka',
  },
  en: {
    lead: (branch: Branch) => `The ${company.brand} branch ${branch.short.en === 'Airport' ? 'at the airport' : 'in the city centre'} of Bratislava: address, opening hours, directions and returning a car after hours.`,
    contact: 'Address and contact',
    hours: 'Opening hours',
    closed: 'closed',
    way: 'How to get here',
    desk: 'Where to find us',
    after: 'Returning after hours',
    coords: 'GPS coordinates',
    book: 'Book a car at this branch',
    other: 'Our other branch',
  },
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export function Location({ lang, branch, other }: { lang: Locale; branch: Branch; other: Branch }) {
  const c = copy[lang]
  const d = t(lang)
  const time = (value: string) => value.replace(/^0/, '')
  return (
    <>
      <PageHeader page={branch.page} lang={lang} lead={c.lead(branch)} />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
        <section aria-labelledby="branch-contact">
          <h2 id="branch-contact" className="text-xl font-semibold">
            {c.contact}
          </h2>
          <address className="mt-3 space-y-1 not-italic">
            <p className="font-semibold">
              {company.brand} – {branch.name[lang]}
            </p>
            <p>
              {branch.street}, {branch.postalCode} {branch.city}
            </p>
            <p>
              {d.phone}:{' '}
              <a href={tel(branch.phone)} className="text-brand underline underline-offset-2">
                {branch.phone}
              </a>
            </p>
            <p>
              {d.email}:{' '}
              <a href={`mailto:${branch.email}`} className="text-brand underline underline-offset-2">
                {branch.email}
              </a>
            </p>
          </address>
          <p className="mt-3 text-sm text-muted">
            {c.coords}: {branch.lat}, {branch.lon} ·{' '}
            <a href={mapUrl(branch)} className="text-brand underline underline-offset-2">
              {d.map}
            </a>
          </p>

          <h2 className="mt-8 text-xl font-semibold">{c.hours}</h2>
          <table className="mt-3 w-full max-w-sm text-left">
            <caption className="sr-only">{c.hours}</caption>
            <tbody>
              {WEEK.map(day => {
                const rule = branch.hours.find(hours => hours.days.includes(day))
                return (
                  <tr key={day} className="border-b border-line">
                    <th scope="row" className="py-1.5 font-normal capitalize">
                      {dayName(day, lang)}
                    </th>
                    <td className="py-1.5 text-right">{rule ? `${time(rule.opens)} – ${time(rule.closes)}` : c.closed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="branch-way" className="space-y-6">
          <div>
            <h2 id="branch-way" className="text-xl font-semibold">
              {c.way}
            </h2>
            <p className="mt-2">{branch.directions[lang]}</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">{c.desk}</h2>
            <p className="mt-2">{branch.desk[lang]}</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">{c.after}</h2>
            <p className="mt-2">{branch.afterHours[lang]}</p>
          </div>
          <p>
            <Link
              href={`${pathOf('booking', lang)}?pickup=${branch.id}`}
              className="inline-block rounded-md bg-accent px-5 py-3 font-semibold text-ink hover:bg-[#e0a600]"
            >
              {c.book}
            </Link>
          </p>
          <p>
            {c.other}:{' '}
            <Link href={pathOf(other.page, lang)} className="font-semibold text-brand underline underline-offset-2">
              {other.name[lang]}
            </Link>
          </p>
        </section>
      </div>
    </>
  )
}
