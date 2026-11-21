import Image from 'next/image'
import Link from 'next/link'
import type { CarClass } from '@/content/business'
import { t } from '@/content/dictionary'
import { eur } from '@/lib/format'
import { type Locale, pathOf } from '@/lib/i18n'

/** A car class in a grid: picture, seats, gearbox, luggage and the price per day with VAT. */
export function FleetCard({ car, lang, priority = false }: { car: CarClass; lang: Locale; priority?: boolean }) {
  const d = t(lang).fleet
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
      <Image
        src={`/fleet/${car.id}.png`}
        alt={d.imageAlt(car.name[lang])}
        width={960}
        height={480}
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
        priority={priority}
        className="h-auto w-full bg-surface"
      />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold">{car.name[lang]}</h3>
        <p className="mt-1 text-sm text-muted">{car.example[lang]}</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li>
            {car.seats} {d.seats.toLowerCase()}
          </li>
          <li>{car.transmission === 'manual' ? d.manual : d.automatic}</li>
          <li>{d.luggageValue(car.luggage.large, car.luggage.small)}</li>
        </ul>
        <p className="mt-auto pt-4">
          <span className="text-sm text-muted">{d.from} </span>
          <span className="text-2xl font-semibold">{eur(car.pricePerDay, lang)}</span>
          <span className="text-sm text-muted"> {d.perDay}</span>
        </p>
        <Link
          href={`${pathOf('fleet', lang)}#${car.id}`}
          className="mt-3 text-sm font-semibold text-brand underline underline-offset-2"
          aria-label={`${car.name[lang]}: ${lang === 'sk' ? 'parametre a podmienky' : 'details and terms'}`}
        >
          {lang === 'sk' ? 'Parametre a podmienky' : 'Details and terms'}
        </Link>
      </div>
    </article>
  )
}
