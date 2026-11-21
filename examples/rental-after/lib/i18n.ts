// Locales and URLs. Slovak is the default and has no prefix (`/vozovy-park`); English lives under `/en` (`/en/fleet`).
// proxy.ts rewrites unprefixed paths to the `[lang]` segment and redirects `/sk/...` to the unprefixed URL.

export const locales = ['sk', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'sk'

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value)

/** Open Graph spells locales language_TERRITORY. */
export const ogLocale: Record<Locale, string> = { sk: 'sk_SK', en: 'en_GB' }

/** The language's own name, for the language switcher. */
export const languageName: Record<Locale, string> = { sk: 'Slovenčina', en: 'English' }

/** Every page of the site, by id, with its slug in each language ('' is the home page). */
export const slugs = {
  home: { sk: '', en: '' },
  fleet: { sk: 'vozovy-park', en: 'fleet' },
  locations: { sk: 'pobocky', en: 'locations' },
  'location-centre': { sk: 'pobocky/bratislava-centrum', en: 'locations/bratislava-city-centre' },
  'location-airport': { sk: 'pobocky/letisko-bratislava', en: 'locations/bratislava-airport' },
  booking: { sk: 'rezervacia', en: 'booking' },
  faq: { sk: 'casto-kladene-otazky', en: 'faq' },
  'rental-terms': { sk: 'podmienky-prenajmu', en: 'rental-terms' },
  terms: { sk: 'obchodne-podmienky', en: 'terms' },
  complaints: { sk: 'reklamacny-poriadok', en: 'complaints' },
  privacy: { sk: 'ochrana-osobnych-udajov', en: 'privacy' },
  cookies: { sk: 'zasady-cookies', en: 'cookies' },
  accessibility: { sk: 'vyhlasenie-o-pristupnosti', en: 'accessibility' },
  contact: { sk: 'kontakt', en: 'contact' },
} as const satisfies Record<string, Record<Locale, string>>

export type PageId = keyof typeof slugs
export const pageIds = Object.keys(slugs) as PageId[]

/** The path of a page in a language: `/`, `/vozovy-park`, `/en`, `/en/fleet`. */
export function pathOf(page: PageId, lang: Locale) {
  const slug = slugs[page][lang]
  const prefix = lang === defaultLocale ? '' : `/${lang}`
  return slug ? `${prefix}/${slug}` : prefix || '/'
}

/** The page a slug names in a language, or undefined. */
export function pageOf(lang: Locale, slug: string): PageId | undefined {
  return pageIds.find(page => slugs[page][lang] === slug)
}
