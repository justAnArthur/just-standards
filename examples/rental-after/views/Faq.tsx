import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { RichText } from '@/components/RichText'
import { company } from '@/content/business'
import { faq } from '@/content/faq'
import { type Locale, pathOf } from '@/lib/i18n'

const copy = {
  sk: {
    lead: 'Odpovede na otázky, ktoré nám zákazníci kladú pred rezerváciou. Všetky podmienky nájdete aj v podmienkach prenájmu.',
    more: 'Nenašli ste odpoveď? Zavolajte nám na',
    or: 'alebo napíšte na',
    terms: 'Podmienky prenájmu',
  },
  en: {
    lead: 'Answers to the questions customers ask us before they book. Every condition is also in the rental terms.',
    more: 'Didn’t find your answer? Call us on',
    or: 'or write to',
    terms: 'Rental terms',
  },
}

export function Faq({ lang }: { lang: Locale }) {
  const c = copy[lang]
  return (
    <>
      <PageHeader page="faq" lang={lang} lead={c.lead} />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="space-y-8">
          {faq[lang].map((entry, i) => (
            <section key={entry.q} aria-labelledby={`q${i}`}>
              <h2 id={`q${i}`} className="text-xl font-semibold">
                {entry.q}
              </h2>
              <p className="mt-2 leading-relaxed">
                <RichText text={entry.a} />
              </p>
            </section>
          ))}
        </div>
        <p className="prose mt-10 border-t border-line pt-6">
          <RichText text={`${c.more} ${company.phone} ${c.or} ${company.email}.`} />{' '}
          <Link href={pathOf('rental-terms', lang)}>{c.terms}</Link>
        </p>
      </div>
    </>
  )
}
