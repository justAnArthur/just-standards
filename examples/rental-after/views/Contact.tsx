import Link from 'next/link'
import { LocationCard } from '@/components/LocationCard'
import { PageHeader } from '@/components/PageHeader'
import { company, locations, tel } from '@/content/business'
import { t } from '@/content/dictionary'
import { type Locale, pathOf } from '@/lib/i18n'

const copy = {
  sk: {
    lead: 'Zavolajte nám alebo napíšte. Na telefóne sme každý deň od 7:00 do 23:00, e-maily vybavujeme v pracovné dni do 24 hodín.',
    general: 'Rezervácie a otázky',
    company: 'Údaje o spoločnosti',
    complaints: 'Reklamácie',
    complaintsText: 'Reklamáciu nám pošlite e-mailom alebo ju podajte na ktorejkoľvek pobočke. Postup je v reklamačnom poriadku.',
    complaintsLink: 'Reklamačný poriadok',
    privacy: 'Ochrana osobných údajov',
    branches: 'Pobočky',
    registered: 'Sídlo',
  },
  en: {
    lead: 'Call us or write to us. We answer the phone every day from 7:00 to 23:00 and reply to e-mails within 24 hours on working days.',
    general: 'Bookings and questions',
    company: 'Company details',
    complaints: 'Complaints',
    complaintsText: 'Send us your complaint by e-mail or make it at either branch. The steps are in the complaints procedure.',
    complaintsLink: 'Complaints procedure',
    privacy: 'Privacy',
    branches: 'Branches',
    registered: 'Registered office',
  },
}

export function Contact({ lang }: { lang: Locale }) {
  const c = copy[lang]
  const d = t(lang)
  const f = d.footer
  const link = 'text-brand underline underline-offset-2'
  return (
    <>
      <PageHeader page="contact" lang={lang} lead={c.lead} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <section aria-labelledby="contact-general">
            <h2 id="contact-general" className="text-xl font-semibold">
              {c.general}
            </h2>
            <p className="mt-3">
              {d.phone}:{' '}
              <a href={tel(company.phone)} className={link}>
                {company.phone}
              </a>
            </p>
            <p>
              {d.email}:{' '}
              <a href={`mailto:${company.email}`} className={link}>
                {company.email}
              </a>
            </p>
          </section>
          <section aria-labelledby="contact-complaints">
            <h2 id="contact-complaints" className="text-xl font-semibold">
              {c.complaints}
            </h2>
            <p className="mt-3">{c.complaintsText}</p>
            <p className="mt-2">
              <a href={`mailto:${company.complaintsEmail}`} className={link}>
                {company.complaintsEmail}
              </a>{' '}
              ·{' '}
              <Link href={pathOf('complaints', lang)} className={link}>
                {c.complaintsLink}
              </Link>
            </p>
            <p className="mt-2">
              {c.privacy}:{' '}
              <a href={`mailto:${company.privacyEmail}`} className={link}>
                {company.privacyEmail}
              </a>
            </p>
          </section>
          <section aria-labelledby="contact-company">
            <h2 id="contact-company" className="text-xl font-semibold">
              {c.company}
            </h2>
            <address className="mt-3 space-y-1 not-italic">
              <p className="font-semibold">{company.legalName}</p>
              <p>
                {c.registered}: {company.street}, {company.postalCode} {company.city}, {company.countryName[lang]}
              </p>
              <p>
                {f.ico}: {company.ico}
              </p>
              <p>
                {f.dic}: {company.dic}
              </p>
              <p>
                {f.icDph}: {company.icDph}
              </p>
              <p>{company.register[lang]}</p>
            </address>
          </section>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">{c.branches}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {locations.map(location => (
            <LocationCard key={location.id} location={location} lang={lang} />
          ))}
        </div>
      </div>
    </>
  )
}
