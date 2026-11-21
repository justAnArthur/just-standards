import Image from 'next/image'
import Link from 'next/link'
import { BookingForm, type BookingQuery } from '@/components/BookingForm'
import { PageHeader } from '@/components/PageHeader'
import { company, locations, tel, terms } from '@/content/business'
import { t } from '@/content/dictionary'
import type { Problem, Quote } from '@/lib/booking'
import { eur, longDate } from '@/lib/format'
import { type Locale, pathOf } from '@/lib/i18n'

const copy = {
  sk: {
    lead: 'Vyberte pobočku a termín. Ukážeme vám voľné triedy áut s konečnou cenou za celý prenájom vrátane DPH.',
    results: 'Voľné autá',
    summary: (from: string, to: string, days: number, pickup: string, dropoff: string) =>
      `${pickup} → ${dropoff}, ${from} – ${to}, ${days} ${days === 1 ? 'deň' : days < 5 ? 'dni' : 'dní'}`,
    total: 'Spolu za prenájom',
    perDay: 'za deň',
    included: 'V cene: DPH, poistenie, kilometre',
    deposit: 'Záloha na kreditnej karte',
    weekly: `Zľava ${terms.weeklyDiscount} % za prenájom na ${terms.weeklyFrom} a viac dní je už započítaná.`,
    reserve: 'Rezervujte telefonicky alebo e-mailom',
    demo: 'Príklad Rent je vymyslená požičovňa, preto sa tu rezervácia neodosiela. Skutočná požičovňa by tu pokračovala k údajom vodiča a potvrdeniu.',
    problems: {
      dates: 'Zadajte dátum vyzdvihnutia aj vrátenia.',
      order: 'Dátum a čas vrátenia musia byť po vyzdvihnutí.',
      past: 'Dátum vyzdvihnutia nemôže byť v minulosti.',
    } satisfies Record<Problem, string>,
    terms: 'Podmienky prenájmu',
  },
  en: {
    lead: 'Choose a branch and dates. We show the available car classes with the final price for the whole rental, VAT included.',
    results: 'Available cars',
    summary: (from: string, to: string, days: number, pickup: string, dropoff: string) =>
      `${pickup} → ${dropoff}, ${from} – ${to}, ${days} ${days === 1 ? 'day' : 'days'}`,
    total: 'Total for the rental',
    perDay: 'a day',
    included: 'Included: VAT, insurance, kilometres',
    deposit: 'Deposit on a credit card',
    weekly: `The ${terms.weeklyDiscount}% discount for ${terms.weeklyFrom} days or more is already applied.`,
    reserve: 'Book by phone or e-mail',
    demo: 'Príklad Rent is a fictional rental, so no booking is sent from here. A real rental would continue to the driver’s details and a confirmation.',
    problems: {
      dates: 'Enter both a pick-up and a return date.',
      order: 'The return date and time must come after the pick-up.',
      past: 'The pick-up date can’t be in the past.',
    } satisfies Record<Problem, string>,
    terms: 'Rental terms',
  },
}

export function Booking({
  lang,
  query,
  today,
  results,
  problem,
}: {
  lang: Locale
  query: BookingQuery
  today: string
  results?: Quote[]
  problem?: Problem
}) {
  const c = copy[lang]
  const d = t(lang).fleet
  const name = (id: string) => locations.find(location => location.id === id)?.name[lang] ?? id
  const days = results?.[0]?.days ?? 0
  return (
    <>
      <PageHeader page="booking" lang={lang} lead={c.lead} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-lg bg-brand-deep p-1">
          <BookingForm lang={lang} query={query} today={today} compact />
        </div>
        <div aria-live="polite">
          {problem ? (
            <p role="alert" className="mt-6 rounded-md border-2 border-danger bg-white p-4 font-semibold text-danger">
              {c.problems[problem]}
            </p>
          ) : null}
          {results ? (
            <section aria-labelledby="results-title" className="mt-10">
              <h2 id="results-title" className="text-2xl font-semibold">
                {c.results}
              </h2>
              <p className="mt-1 text-muted">
                {c.summary(longDate(query.from, lang), longDate(query.to, lang), days, name(query.pickup), name(query.dropoff))}
              </p>
              {days >= terms.weeklyFrom ? <p className="mt-1 text-success">{c.weekly}</p> : null}
              <ul className="mt-6 space-y-4">
                {results.map(quote => (
                  <li key={quote.car.id} className="grid items-center gap-4 rounded-lg border border-line p-4 sm:grid-cols-[180px_1fr_auto]">
                    <Image src={`/fleet/${quote.car.id}.png`} alt={d.imageAlt(quote.car.name[lang])} width={960} height={480} sizes="180px" className="h-auto w-full rounded-md bg-surface" />
                    <div>
                      <h3 className="text-lg font-semibold">{quote.car.name[lang]}</h3>
                      <p className="text-sm text-muted">
                        {quote.car.seats} {d.seats.toLowerCase()} · {quote.car.transmission === 'manual' ? d.manual : d.automatic} · {quote.km} km
                      </p>
                      <p className="text-sm text-muted">
                        {c.deposit}: {eur(quote.car.deposit, lang)}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-sm text-muted">{c.total}</p>
                      <p className="text-2xl font-semibold">{eur(quote.total, lang)}</p>
                      <p className="text-sm text-muted">
                        {eur(quote.perDay, lang)} {c.perDay} · {c.included}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-lg border border-line bg-surface p-5">
                <h3 className="font-semibold">{c.reserve}</h3>
                <p className="mt-1">
                  <a href={tel(company.phone)} className="text-brand underline underline-offset-2">
                    {company.phone}
                  </a>{' '}
                  ·{' '}
                  <a href={`mailto:${company.email}`} className="text-brand underline underline-offset-2">
                    {company.email}
                  </a>
                </p>
                <p className="mt-2 text-sm text-muted">{c.demo}</p>
              </div>
            </section>
          ) : null}
        </div>
        <p className="mt-8">
          <Link href={pathOf('rental-terms', lang)} className="font-semibold text-brand underline underline-offset-2">
            {c.terms}
          </Link>
        </p>
      </div>
    </>
  )
}
