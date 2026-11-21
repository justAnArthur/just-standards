import Link from 'next/link'
import { company, locations, tel } from '@/content/business'
import { t } from '@/content/dictionary'
import { type Locale, pathOf } from '@/lib/i18n'
import { CookieSettingsButton } from './CookieSettingsButton'
import { CurrentYear } from './CurrentYear'
import { Hours } from './Hours'

/** Who runs the site, how to reach every branch, the legal pages, and the note that the company is fictional. */
export function Footer({ lang }: { lang: Locale }) {
  const d = t(lang)
  const f = d.footer
  const link = 'underline-offset-2 hover:text-white hover:underline'
  return (
    <footer className="mt-16 bg-ink text-[#D3DCE4]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-sm sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <section aria-labelledby="footer-company">
          <h2 id="footer-company" className="text-base font-semibold text-white">
            {f.company}
          </h2>
          <address className="mt-3 space-y-1 not-italic">
            <p className="font-semibold text-white">{company.legalName}</p>
            <p>
              {company.street}, {company.postalCode} {company.city}, {company.countryName[lang]}
            </p>
            <p>
              {f.ico}: {company.ico} · {f.dic}: {company.dic} · {f.icDph}: {company.icDph}
            </p>
            <p>{company.register[lang]}</p>
          </address>
        </section>
        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="text-base font-semibold text-white">
            {f.contact}
          </h2>
          <ul className="mt-3 space-y-1">
            <li>
              {d.phone}:{' '}
              <a href={tel(company.phone)} className={`text-white ${link} underline`}>
                {company.phone}
              </a>
            </li>
            <li>
              {d.email}:{' '}
              <a href={`mailto:${company.email}`} className={`text-white ${link} underline`}>
                {company.email}
              </a>
            </li>
            <li>
              <Link href={pathOf('contact', lang)} className={`text-white underline ${link}`}>
                {d.nav.contact}
              </Link>
            </li>
          </ul>
        </section>
        <section aria-labelledby="footer-branches">
          <h2 id="footer-branches" className="text-base font-semibold text-white">
            {f.branches}
          </h2>
          <ul className="mt-3 space-y-4">
            {locations.map(location => (
              <li key={location.id}>
                <Link href={pathOf(location.page, lang)} className={`font-semibold text-white underline ${link}`}>
                  {location.name[lang]}
                </Link>
                <p>
                  {location.street}, {location.postalCode} {location.city}
                </p>
                <p>
                  <a href={tel(location.phone)} className={`underline ${link}`}>
                    {location.phone}
                  </a>
                </p>
                <Hours location={location} lang={lang} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="footer-legal">
          <h2 id="footer-legal" className="text-base font-semibold text-white">
            {f.legal}
          </h2>
          <ul className="mt-3 space-y-1">
            <li>
              <Link href={pathOf('rental-terms', lang)} className={`underline ${link}`}>
                {f.rentalTerms}
              </Link>
            </li>
            <li>
              <Link href={pathOf('terms', lang)} className={`underline ${link}`}>
                {f.terms}
              </Link>
            </li>
            <li>
              <Link href={pathOf('complaints', lang)} className={`underline ${link}`}>
                {f.complaints}
              </Link>
            </li>
            <li>
              <Link href={pathOf('privacy', lang)} className={`underline ${link}`}>
                {f.privacy}
              </Link>
            </li>
            <li>
              <Link href={pathOf('cookies', lang)} className={`underline ${link}`}>
                {f.cookies}
              </Link>
            </li>
            <li>
              <Link href={pathOf('accessibility', lang)} className={`underline ${link}`}>
                {f.accessibility}
              </Link>
            </li>
            <li>
              <Link href={pathOf('faq', lang)} className={`underline ${link}`}>
                {d.nav.faq}
              </Link>
            </li>
            <li>
              <CookieSettingsButton label={f.cookieSettings} />
            </li>
          </ul>
          <p className="mt-4">{f.adr}</p>
        </section>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-sm sm:px-6">
          <p>{f.fictional}</p>
          <p>
            © <CurrentYear /> {company.legalName} {f.rights}
          </p>
        </div>
      </div>
    </footer>
  )
}
