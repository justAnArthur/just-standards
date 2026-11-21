import Image from 'next/image'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { company, fleet, terms } from '@/content/business'
import { t } from '@/content/dictionary'
import { eur, number } from '@/lib/format'
import { type Locale, pathOf } from '@/lib/i18n'

const copy = {
  sk: {
    lead: `Všetky ceny sú konečné a zahŕňajú ${company.vatRate} % DPH, povinné zmluvné aj havarijné poistenie a ${fleet[0]?.kmPerDay} km na každý deň prenájmu. Pri prenájme na ${terms.weeklyFrom} a viac dní platíte o ${terms.weeklyDiscount} % menej.`,
    note: 'Triedu auta garantujeme, konkrétnu značku a model nie. Fotografie sú ilustračné.',
    book: 'Vybrať termín a pobočku',
    liters: 'l',
    terms: 'Čo ďalej platí pri prenájme, nájdete v podmienkach prenájmu.',
    termsLink: 'Podmienky prenájmu',
  },
  en: {
    lead: `Every price is final and includes ${company.vatRate}% VAT, third-party and collision insurance and ${fleet[0]?.kmPerDay} km for each day of the rental. Rent for ${terms.weeklyFrom} days or more and you pay ${terms.weeklyDiscount}% less.`,
    note: 'We guarantee the class of the car, not a particular make or model. The pictures are illustrations.',
    book: 'Choose dates and a branch',
    liters: 'l',
    terms: 'Everything else that applies to a rental is in the rental terms.',
    termsLink: 'Rental terms',
  },
}

export function Fleet({ lang }: { lang: Locale }) {
  const c = copy[lang]
  const d = t(lang).fleet
  return (
    <>
      <PageHeader page="fleet" lang={lang} lead={c.lead} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-muted">{c.note}</p>
        <div className="mt-8 space-y-8">
          {fleet.map((car, i) => (
            <article key={car.id} id={car.id} aria-labelledby={`${car.id}-title`} className="grid scroll-mt-6 gap-6 rounded-lg border border-line p-5 md:grid-cols-[340px_1fr] md:p-6">
              <Image
                src={`/fleet/${car.id}.png`}
                alt={d.imageAlt(car.name[lang])}
                width={960}
                height={480}
                sizes="(min-width: 768px) 340px, 100vw"
                preload={i === 0}
                className="h-auto w-full rounded-md bg-surface"
              />
              <div>
                <h2 id={`${car.id}-title`} className="text-2xl font-semibold">
                  {car.name[lang]}
                </h2>
                <p className="mt-1 text-muted">{car.example[lang]}</p>
                <p className="mt-3">
                  <span className="text-sm text-muted">{d.from} </span>
                  <span className="text-3xl font-semibold">{eur(car.pricePerDay, lang)}</span>
                  <span className="text-sm text-muted"> {d.perDay}</span>
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted">{d.seats}</dt>
                    <dd className="font-semibold">{car.seats}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.doors}</dt>
                    <dd className="font-semibold">{car.doors}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.transmission}</dt>
                    <dd className="font-semibold">{car.transmission === 'manual' ? d.manual : d.automatic}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.luggage}</dt>
                    <dd className="font-semibold">{d.luggageValue(car.luggage.large, car.luggage.small)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.cargo}</dt>
                    <dd className="font-semibold">
                      {number(car.cargoLitres, lang)} {c.liters}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.fuel}</dt>
                    <dd className="font-semibold">{car.fuel === 'petrol' ? d.petrol : d.diesel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.deposit}</dt>
                    <dd className="font-semibold">{eur(car.deposit, lang)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.excess}</dt>
                    <dd className="font-semibold">{eur(car.excess, lang)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{d.minAge}</dt>
                    <dd className="font-semibold">
                      {car.minAge} {d.years}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">{lang === 'sk' ? 'Kilometre' : 'Mileage'}</dt>
                    <dd className="font-semibold">
                      {car.kmPerDay} {d.km}
                    </dd>
                  </div>
                </dl>
                <p className="mt-5">
                  <Link href={pathOf('booking', lang)} className="inline-block rounded-md bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-deep">
                    {c.book}
                    <span className="sr-only">: {car.name[lang]}</span>
                  </Link>
                </p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-10">
          {c.terms}{' '}
          <Link href={pathOf('rental-terms', lang)} className="font-semibold text-brand underline underline-offset-2">
            {c.termsLink}
          </Link>
        </p>
      </div>
    </>
  )
}
