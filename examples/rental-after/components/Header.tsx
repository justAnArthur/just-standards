import Link from 'next/link'
import { t } from '@/content/dictionary'
import { type Locale, languageName, locales, type PageId, pathOf } from '@/lib/i18n'
import { Logo } from './Logo'

/** The skip link, the logo, the main navigation and the language switch, which keeps the visitor on the same page. */
export function Header({ lang, page }: { lang: Locale; page?: PageId }) {
  const d = t(lang)
  const other = locales.find(locale => locale !== lang) as Locale
  const nav: [PageId, string][] = [
    ['fleet', d.nav.fleet],
    ['locations', d.nav.locations],
    ['faq', d.nav.faq],
    ['contact', d.nav.contact],
  ]
  return (
    <>
      <a
        href="#obsah"
        className="sr-only z-50 rounded-md bg-ink px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {d.skip}
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href={pathOf('home', lang)} className="shrink-0" aria-label={`${d.home}: Príklad Rent`}>
            <Logo className="h-9 w-auto" />
          </Link>
          <nav aria-label={d.nav.label} className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-medium">
              {nav.map(([id, label]) => (
                <li key={id}>
                  <Link
                    href={pathOf(id, lang)}
                    aria-current={page === id ? 'page' : undefined}
                    className="inline-block py-1 hover:text-brand aria-[current=page]:text-brand aria-[current=page]:underline aria-[current=page]:underline-offset-4"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href={pathOf(page ?? 'home', other)}
              hrefLang={other}
              lang={other}
              className="rounded-md px-2 py-1 text-sm font-semibold text-muted hover:text-ink"
            >
              {languageName[other]}
            </Link>
            <Link href={pathOf('booking', lang)} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep">
              {d.nav.book}
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}
