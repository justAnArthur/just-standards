// The 404 for a URL no route matches. There are two root layouts (`app/[lang]`), so Next.js renders this file, on its own
// html and body, instead of a not-found inside a layout. Most such URLs never get here: proxy.ts answers them first with
// the same page as plain HTML (lib/not-found-page.ts), complete without JavaScript.
import './globals.css'
import type { Metadata } from 'next'
import { company } from '@/content/business'
import { t } from '@/content/dictionary'
import { pathOf } from '@/lib/i18n'

const d = t('sk')

export const metadata: Metadata = {
  title: `${d.notFound.title} · ${company.brand}`,
  robots: { index: false, follow: true },
}

export default function GlobalNotFound() {
  return (
    <html lang="sk">
      <body>
        <main className="mx-auto max-w-6xl px-6 py-20">
          <p className="font-semibold text-[#0E5A8A]">404</p>
          <h1 className="mt-2 mb-4 text-4xl">{d.notFound.title}</h1>
          <p className="mb-8 text-lg text-[#4B5966]">{d.notFound.text}</p>
          <nav aria-label={d.nav.label}>
            <ul className="flex flex-wrap gap-4">
              <li>
                <a className="inline-block rounded-md bg-[#0E5A8A] px-5 py-3 font-semibold text-white" href={pathOf('home', 'sk')}>
                  {d.notFound.home}
                </a>
              </li>
              <li>
                <a className="inline-block rounded-md border border-[#D6DEE6] px-5 py-3 font-semibold" href={pathOf('contact', 'sk')}>
                  {d.nav.contact}
                </a>
              </li>
            </ul>
          </nav>
          <p className="mt-10" lang="en">
            <a className="text-[#0E5A8A]" href={pathOf('home', 'en')} hrefLang="en">
              Page not found. Go to the English home page
            </a>
          </p>
        </main>
      </body>
    </html>
  )
}
