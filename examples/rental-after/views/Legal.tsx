import { PageHeader } from '@/components/PageHeader'
import { RichText } from '@/components/RichText'
import { type LegalPage, legal } from '@/content/legal'
import { longDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

/** A legal page from content/legal.ts: an intro, numbered or named sections, and the date it last changed. */
export function Legal({ page, lang }: { page: LegalPage; lang: Locale }) {
  const doc = legal[page][lang]
  return (
    <>
      <PageHeader page={page} lang={lang} />
      <div className="prose mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-lg">
          <RichText text={doc.intro} />
        </p>
        {doc.sections.map(section => (
          <section key={section.h}>
            <h2>{section.h}</h2>
            {section.blocks.map((block, i) =>
              typeof block === 'string' ? (
                <p key={i}>
                  <RichText text={block} />
                </p>
              ) : (
                <ul key={i}>
                  {block.list.map(item => (
                    <li key={item}>
                      <RichText text={item} />
                    </li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
        <p className="mt-10 text-sm text-muted">
          {lang === 'sk' ? 'Platné od' : 'Valid from'} <time dateTime={doc.updated}>{longDate(doc.updated, lang)}</time>
        </p>
      </div>
    </>
  )
}
