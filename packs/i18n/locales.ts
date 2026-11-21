// What the i18n items share: the languages a site declares on its home page, and where each one's home is.
import type { Context } from '../../core/checks/context.ts'
import { crawl, pathOf, type Page } from '../../core/crawl.ts'
import { get } from '../../core/expect.ts'
import { select, type Element } from '../../core/html.ts'
import type { Outcome } from '../../core/schema.ts'
import { challenged } from '../firewall.ts'

export interface Locale {
  /** as declared: `sk`, `en-GB` */
  code: string
  /** the primary language, lowercased: `en` */
  language: string
  /** the URL of its home page */
  home: string
  /** where the site declares it */
  via: string[]
}

export interface Site {
  /** the home page after redirects */
  url: string
  html: string
  locales: Locale[]
}

export const primary = (code: string | undefined) => code?.trim().split(/[-_]/)[0]?.toLowerCase() ?? ''

const englishNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })

/** A language code Intl knows: `sk`, `en-GB`, `fo`; not `xx`, `ai`'s neighbours made up, or a path such as `blog`. */
export function isLanguage(code: string) {
  if (!/^[a-z]{2,3}([-_][a-z]{4})?([-_]([a-z]{2}|\d{3}))?$/i.test(code)) return false
  try {
    return englishNames.of(primary(code)) !== undefined
  } catch {
    return false
  }
}

// How switchers label a language besides its code and its names: Slovak sites say "Slovensky".
const EXTRA: Record<string, string[]> = {
  sk: ['slovensky', 'slovak'],
  cs: ['česky', 'cesky'],
  en: ['english', 'anglicky'],
  de: ['deutsch', 'nemecky'],
  fo: ['føroyskt', 'faroese'],
  da: ['dansk'],
  hu: ['magyar', 'maďarsky'],
  pl: ['polski', 'poľsky'],
  uk: ['українська', 'ukrajinsky'],
}

// Languages whose names a switcher's label is compared with, in English and in the language itself.
const COMMON = ['sk', 'cs', 'en', 'de', 'fo', 'da', 'hu', 'pl', 'uk', 'fr', 'es', 'it', 'nl', 'pt', 'ru', 'sv', 'nb', 'fi', 'is', 'ro', 'hr', 'sl', 'bg', 'el', 'tr', 'zh', 'ja', 'ko']

/** The language a label names exactly: its English name, its own name or a common label ("English", "Slovensky", "Deutsch"). */
export function languageNamed(label: string) {
  const plain = label.replace(/\s+/g, ' ').trim().toLowerCase()
  if (!plain || plain.length > 30) return undefined
  for (const [language, labels] of Object.entries(EXTRA)) if (labels.includes(plain)) return language
  for (const language of COMMON) {
    try {
      const names = [englishNames.of(language), new Intl.DisplayNames([language], { type: 'language', fallback: 'none' }).of(language)]
      if (names.some(name => name?.toLowerCase() === plain)) return language
    } catch {}
  }
}

const resolveHref = (href: string | undefined, base: string) => {
  if (!href?.trim()) return undefined
  try {
    const url = new URL(href.trim(), base)
    url.hash = ''
    return /^https?:$/.test(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')

/** The first path segment under the site's root ('' for the root itself), or undefined outside it. */
function firstSegment(url: string, base: string) {
  const root = new URL(base).pathname.replace(/\/+$/, '')
  const path = new URL(url).pathname.replace(/\/+$/, '')
  if (path === root) return ''
  return path.startsWith(`${root}/`) ? (path.slice(root.length + 1).split('/')[0] as string) : undefined
}

/** The locale a path names right under the site's root: `/en`, `/sk/`, `/en-gb` (and nothing after it). */
export function localeHomeOf(url: string, base: string) {
  const root = new URL(base).pathname.replace(/\/+$/, '')
  const path = new URL(url).pathname.replace(/\/+$/, '')
  if (!path.startsWith(`${root}/`)) return undefined
  const segment = path.slice(root.length + 1)
  return !segment.includes('/') && isLanguage(segment) ? segment : undefined
}

/**
 * The language a link switches to, when it is a language switcher's link on the site's host: its `hreflang` or `lang`; a
 * label that is a language's name ("English", "Slovensky"); or a label that is a code (`EN`, `sk`) when the link goes to
 * that code's path or the site's root, or the code is one of the `known` languages (from `<html lang>` and hreflang). A nav
 * link labelled "IT" to `/it-sluzby` is not a switcher.
 */
export function switchTarget(link: Element, page: string, base: string, known: string[] = []) {
  const href = resolveHref(link.attrs.href, page)
  if (!href || hostOf(href) !== hostOf(base)) return undefined
  const declared = link.attrs.hreflang ?? link.attrs.lang
  if (declared && isLanguage(declared)) return { code: declared, href }
  const label = (link.text.trim() || link.attrs['aria-label'] || link.attrs.title || '').trim()
  const named = languageNamed(label)
  if (named) return { code: named, href }
  const segment = firstSegment(href, base)
  const toIt = segment === '' || (segment !== undefined && isLanguage(segment) && primary(segment) === primary(label))
  if (/^[a-z]{2,3}([-_][a-z]{2,4})?$/i.test(label) && isLanguage(label) && (toIt || known.includes(primary(label)))) {
    return { code: label.toLowerCase(), href }
  }
}

/** The hreflang alternates of a page, x-default left out. */
export async function alternatesOf(html: string, base: string) {
  const links = await select(html, 'link[rel="alternate"][hreflang]')
  return links.flatMap(link => {
    const href = resolveHref(link.attrs.href, base)
    const code = link.attrs.hreflang?.trim() ?? ''
    return href && code.toLowerCase() !== 'x-default' ? [{ code, href }] : []
  })
}

export const langOf = async (html: string) => (await select(html, 'html'))[0]?.attrs.lang?.trim()

/** The languages the home page declares: its `<html lang>`, its hreflang alternates, and its language switcher's links. */
export async function localesOf(url: string, html: string, base = url): Promise<Locale[]> {
  const found: Locale[] = []
  const add = (code: string, home: string, via: string) => {
    const language = primary(code)
    if (!language || !isLanguage(code)) return
    const known = found.find(locale => locale.language === language)
    if (!known) return void found.push({ code, language, home, via: [via] })
    if (!known.via.includes(via)) known.via.push(via)
  }
  const lang = await langOf(html)
  if (lang) add(lang, url, '<html lang>')
  for (const { code, href } of await alternatesOf(html, url)) add(code, href, 'hreflang')
  const known = found.map(locale => locale.language)
  for (const link of await select(html, 'a[href]')) {
    const target = switchTarget(link, url, base, known)
    if (target) add(target.code, target.href, 'switcher')
  }
  return found
}

/** The home page and its declared languages, or the outcome to return when it can't be read. */
export async function siteOf({ asset }: Context): Promise<Site | Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let response: Response
  try {
    response = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  if (response.status !== 200) return { state: 'error', evidence: challenged(response) ?? `${asset.url} answered ${response.status}` }
  const url = response.url || asset.url
  const html = await response.text()
  return { url, html, locales: await localesOf(url, html, asset.url) }
}

/** The crawl's page count: the same as the seo and content items', so the site is crawled once. */
const PAGES = 20

/** The crawled pages that answered 200 with HTML, or an error when the host's firewall answered some of them instead. */
export async function crawled(base: string): Promise<Page[] | Outcome> {
  const pages = await crawl(base, PAGES)
  const blocked = pages.find(page => challenged(page))
  if (blocked) return { state: 'error', evidence: `${pathOf(blocked.url)}: ${challenged(blocked)}` }
  return pages.filter(page => page.status === 200 && page.html)
}

export const isOutcome = (value: unknown): value is Outcome => typeof value === 'object' && value !== null && 'state' in value

/** The pass a single-language site gets from every i18n item. */
export function oneLanguage(site: Site): Outcome | undefined {
  if (site.locales.length > 1) return undefined
  const only = site.locales[0]
  return { state: 'pass', evidence: only ? `one language (${only.code}, from ${only.via.join(', ')}): nothing to check` : 'one language (no <html lang>, no alternates or switcher): nothing to check' }
}
