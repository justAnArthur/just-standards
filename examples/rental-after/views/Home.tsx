import Link from 'next/link'
import { BookingForm, type BookingQuery } from '@/components/BookingForm'
import { FleetCard } from '@/components/FleetCard'
import { LocationCard } from '@/components/LocationCard'
import { RichText } from '@/components/RichText'
import { fleet, locations, priceFrom, terms } from '@/content/business'
import { faq } from '@/content/faq'
import { pageCopy } from '@/content/pages'
import { type Locale, pathOf } from '@/lib/i18n'

const KM = fleet[0]?.kmPerDay ?? 300

const copy = {
  sk: {
    lead: `Osobné autá, minibusy a dodávky na prenájom pre súkromné osoby aj firmy, s vyzdvihnutím v centre Bratislavy alebo na letisku. Ceny od ${priceFrom} € na deň vrátane DPH, poistenie a ${KM} km denne v cene.`,
    points: [
      'Konečné ceny s DPH, bez skrytých poplatkov',
      'Vyzdvihnutie aj vrátenie v centre alebo na letisku',
      `Bezplatné zrušenie do ${terms.freeCancellationHours} hodín pred vyzdvihnutím`,
    ],
    fleetTitle: 'Vozový park',
    fleetLead: 'Šesť tried od malého mestského auta po dodávku 3,5 t, ktorú odveziete s vodičským preukazom skupiny B.',
    fleetAll: 'Celý vozový park a ceny',
    locationsTitle: 'Kde si auto vyzdvihnete',
    locationsLead: 'Dve pobočky v Bratislave. Auto môžete vrátiť na ktorejkoľvek z nich bez príplatku.',
    stepsTitle: 'Ako prenájom prebieha',
    steps: [
      ['Vyberte termín', 'Zvoľte pobočku a dátumy a uvidíte konečnú cenu každej triedy vrátane DPH.'],
      ['Potvrďte rezerváciu', 'Rezerváciu potvrdíme telefonicky alebo e-mailom. Platíte až pri vyzdvihnutí.'],
      ['Vyzdvihnite si auto', 'Prineste doklad totožnosti, vodičský preukaz a kreditnú kartu na zálohu.'],
    ],
    faqTitle: 'Najčastejšie otázky',
    faqAll: 'Všetky otázky a odpovede',
    termsLink: 'Podmienky prenájmu',
  },
  en: {
    lead: `Cars, minibuses and vans to rent for private customers and companies, picked up in Bratislava city centre or at the airport. Prices from €${priceFrom} a day including VAT, with insurance and ${KM} km a day included.`,
    points: [
      'Final prices with VAT, no hidden fees',
      'Pick up and return in the city centre or at the airport',
      `Free cancellation up to ${terms.freeCancellationHours} hours before pick-up`,
    ],
    fleetTitle: 'Our fleet',
    fleetLead: 'Six classes, from a small city car to a 3.5 t cargo van you can drive on a category B licence.',
    fleetAll: 'The whole fleet and prices',
    locationsTitle: 'Where you pick up the car',
    locationsLead: 'Two branches in Bratislava. You can return the car at either one with no extra charge.',
    stepsTitle: 'How renting works',
    steps: [
      ['Choose your dates', 'Pick a branch and dates, and see the final price of every class, VAT included.'],
      ['Confirm the booking', 'We confirm your booking by phone or e-mail. You pay when you pick up the car.'],
      ['Pick up the car', 'Bring an identity document, your driving licence and a credit card for the deposit.'],
    ],
    faqTitle: 'Common questions',
    faqAll: 'All questions and answers',
    termsLink: 'Rental terms',
  },
}

export function Home({ lang, query, today }: { lang: Locale; query: BookingQuery; today: string }) {
  const c = copy[lang]
  return (
    <>
      <section className="bg-brand-deep text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-16">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{pageCopy.home[lang].h1}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#E3EEF6]">{c.lead}</p>
            <ul className="mt-6 space-y-2 text-[15px]">
              {c.points.map(point => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden="true" className="font-semibold text-accent">
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <BookingForm lang={lang} query={query} today={today} />
        </div>
      </section>

      <section aria-labelledby="fleet-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="fleet-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {c.fleetTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-muted">{c.fleetLead}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {fleet.map(car => (
            <FleetCard key={car.id} car={car} lang={lang} />
          ))}
        </div>
        <p className="mt-6">
          <Link href={pathOf('fleet', lang)} className="font-semibold text-brand underline underline-offset-2">
            {c.fleetAll}
          </Link>
        </p>
      </section>

      <section aria-labelledby="locations-title" className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="locations-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {c.locationsTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-muted">{c.locationsLead}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {locations.map(location => (
              <LocationCard key={location.id} location={location} lang={lang} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="steps-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {c.stepsTitle}
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {c.steps.map(([title, text], i) => (
            <li key={title} className="rounded-lg border border-line p-6">
              <p className="text-sm font-semibold text-brand">{i + 1}.</p>
              <h3 className="mt-1 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq-title" className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="faq-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {c.faqTitle}
          </h2>
          <dl className="mt-8 grid gap-6 md:grid-cols-2">
            {faq[lang].slice(0, 4).map(entry => (
              <div key={entry.q} className="rounded-lg bg-white p-6">
                <dt className="font-semibold">{entry.q}</dt>
                <dd className="mt-2 text-muted">
                  <RichText text={entry.a} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Link href={pathOf('faq', lang)} className="font-semibold text-brand underline underline-offset-2">
              {c.faqAll}
            </Link>
            <Link href={pathOf('rental-terms', lang)} className="font-semibold text-brand underline underline-offset-2">
              {c.termsLink}
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
