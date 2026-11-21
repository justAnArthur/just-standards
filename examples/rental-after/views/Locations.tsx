import { LocationCard } from '@/components/LocationCard'
import { PageHeader } from '@/components/PageHeader'
import { locations } from '@/content/business'
import type { Locale } from '@/lib/i18n'

const lead = {
  sk: 'Auto si vyzdvihnete v centre Bratislavy alebo na letisku a vrátite na ktorejkoľvek z oboch pobočiek, bez príplatku za jednosmerný prenájom.',
  en: 'Pick up your car in Bratislava city centre or at the airport, and return it at either branch with no one-way fee.',
}

export function Locations({ lang }: { lang: Locale }) {
  return (
    <>
      <PageHeader page="locations" lang={lang} lead={lead[lang]} />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-2">
        {locations.map(location => (
          <div key={location.id} className="space-y-3">
            <LocationCard location={location} lang={lang} heading="h2" />
            <p className="px-1 text-muted">{location.directions[lang]}</p>
          </div>
        ))}
      </div>
    </>
  )
}
