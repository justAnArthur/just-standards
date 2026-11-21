import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Shell } from '@/components/Shell'
import { locations } from '@/content/business'
import type { LegalPage } from '@/content/legal'
import { quotes, readQuery, todayIso } from '@/lib/booking'
import { isLocale, type Locale, type PageId, pageOf } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { Booking } from '@/views/Booking'
import { Contact } from '@/views/Contact'
import { Faq } from '@/views/Faq'
import { Fleet } from '@/views/Fleet'
import { Home } from '@/views/Home'
import { Legal } from '@/views/Legal'
import { Location } from '@/views/Location'
import { Locations } from '@/views/Locations'

type Props = PageProps<'/[lang]/[[...slug]]'>

/** The page a URL names: its language and its slug in that language. */
async function resolve(params: Props['params']): Promise<{ lang: Locale; page: PageId } | undefined> {
  const { lang, slug } = await params
  if (!isLocale(lang)) return undefined
  const page = pageOf(lang, (slug ?? []).join('/'))
  return page && { lang, page }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve(params)
  return found ? pageMetadata(found.page, found.lang) : {}
}

const LEGAL: PageId[] = ['rental-terms', 'terms', 'complaints', 'privacy', 'cookies', 'accessibility']

export default async function Page({ params, searchParams }: Props) {
  const found = await resolve(params)
  if (!found) notFound()
  const { lang, page } = found
  const today = todayIso()
  const search = await searchParams

  let body: React.ReactNode
  if (page === 'home') body = <Home lang={lang} query={readQuery({}, today).query} today={today} />
  else if (page === 'fleet') body = <Fleet lang={lang} />
  else if (page === 'locations') body = <Locations lang={lang} />
  else if (page === 'location-centre' || page === 'location-airport') {
    const branch = locations.find(location => location.page === page)
    const other = locations.find(location => location.page !== page)
    if (!branch || !other) notFound()
    body = <Location lang={lang} branch={branch} other={other} />
  } else if (page === 'booking') {
    const { query, searched, problem } = readQuery(search, today)
    body = <Booking lang={lang} query={query} today={today} problem={problem} results={searched && !problem ? quotes(query) : undefined} />
  } else if (page === 'faq') body = <Faq lang={lang} />
  else if (page === 'contact') body = <Contact lang={lang} />
  else if (LEGAL.includes(page)) body = <Legal page={page as LegalPage} lang={lang} />
  else notFound()

  return (
    <Shell lang={lang} page={page}>
      {body}
    </Shell>
  )
}

