import type { Locale, PageId } from '@/lib/i18n'
import { graphFor } from '@/lib/jsonld'
import { Footer } from './Footer'
import { Header } from './Header'
import { JsonLd } from './JsonLd'

/** Every page's frame: skip link and header, the main landmark, the footer, and the page's JSON-LD. */
export function Shell({ lang, page, children }: { lang: Locale; page?: PageId; children: React.ReactNode }) {
  return (
    <>
      <Header lang={lang} page={page} />
      <main id="obsah" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer lang={lang} />
      {page ? <JsonLd data={graphFor(page, lang)} /> : null}
    </>
  )
}
