// What the eu-consumer items share: a page's links, its language, the words legal pages go by in each language, and
// a way to hand the right pages to an AI check.
import { ai } from '../../core/checks/ai.ts'
import type { Context } from '../../core/checks/context.ts'
import { get } from '../../core/expect.ts'
import type { Outcome } from '../../core/schema.ts'

export interface Link {
  /** absolute, without its fragment */
  href: string
  /** the visible text, aria-label, title and image alt, lowercased and collapsed */
  text: string
}

/** Every http(s) link of a page, resolved against its URL, in document order. */
export async function linksOf(html: string, base: string): Promise<Link[]> {
  const links: Link[] = []
  let open: Link | undefined
  await new HTMLRewriter()
    .on('a[href]', {
      element(element) {
        let href: URL
        try {
          href = new URL(element.getAttribute('href') ?? '', base)
        } catch {
          open = undefined
          return
        }
        if (!/^https?:$/.test(href.protocol)) return void (open = undefined)
        href.hash = ''
        open = { href: href.href, text: [element.getAttribute('aria-label'), element.getAttribute('title')].filter(Boolean).join(' ') }
        links.push(open)
        element.onEndTag(() => void (open = undefined))
      },
      text(chunk) {
        if (open) open.text += chunk.text
      },
    })
    .on('a[href] img[alt]', {
      element(element) {
        if (open) open.text += ` ${element.getAttribute('alt')}`
      },
    })
    .transform(new Response(html))
    .text()
  for (const link of links) link.text = decode(link.text).replace(/\s+/g, ' ').trim().toLowerCase()
  return links
}

const decode = (text: string) =>
  text.replace(/&(amp|nbsp|#(\d+)|#x([0-9a-f]+));/gi, (_, name: string, dec?: string, hex?: string) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : name === 'amp' ? '&' : ' ',
  )

/** The primary language subtag of `<html lang>`: `sk` for `sk-SK`; undefined when there is none. */
export function langOf(html: string) {
  return html.match(/<html\b[^>]*\blang\s*=\s*["']?([a-z]{2,3})/i)?.[1]?.toLowerCase()
}

/** Words per language; a pattern matches the lowercased link text. */
export type Words = Record<string, RegExp>

export const PRIVACY: Words = {
  sk: /ochran\S* osobn|osobn\S* údaj|spracúv\S* osobn|súkromi/,
  cs: /ochran\S* osobn|osobní\S* údaj|soukromí/,
  en: /privacy|data protection|personal data|personal information/,
  de: /datenschutz|privatsphäre|dsgvo/,
  // Faroese: privatlív (privacy), persónsupplýsingar or persónupplýsingar (personal data), dátuvernd (data protection)
  fo: /privatlív|pers[oó]ns?uppl[yý]sing|d[aá]tuvern/,
  da: /privatliv|persondata|databeskyttelse/,
  pl: /prywatno|ochron\S* danych|rodo\b/,
  hu: /adatvédelm|adatkezel/,
  fr: /confidentialit|données personnelles|rgpd/,
  es: /privacidad|protección de datos/,
  it: /privacy|protezione dei dati|trattamento dei dati/,
  '*': /\bgdpr\b/,
}
export const PRIVACY_HREF = /privacy|gdpr|osobn\w*-udaj|datenschutz|privatliv|persons?upplysing|datuvernd/

export const TERMS: Words = {
  sk: /obchodn\S* podmien|\bvop\b|podmien\S* prenájm|nájomn\S* zmluv|zmluvn\S* podmien|reklamačn\S* poriad/,
  cs: /obchodní podmín|\bvop\b|reklamační řád|podmínky pronájm/,
  en: /terms|conditions|\bt ?& ?c\b|complaints/,
  de: /\bagb\b|geschäftsbedingung|mietbedingung|nutzungsbedingung|beschwerde/,
  // Faroese: treytir (conditions), leigutreytir (rental conditions)
  fo: /treyt/,
  da: /betingelser|vilkår/,
  pl: /regulamin|warunki/,
  hu: /\bászf\b|feltétel/,
  fr: /conditions|\bcgv\b|\bcgu\b/,
  es: /condiciones|términos/,
  it: /condizioni|termini/,
}
export const TERMS_HREF = /terms|conditions|podmienk|\bvop\b|agb|treytir|vilkar|reklamac/
/** The complaints procedure, which the terms often hold; reported, not required. */
export const COMPLAINTS = /reklamačn\S* (poriad|podmien)|reklamační řád|complaints|beschwerde|reklamation|klagu|kæru/

export const CONTACT = /kontakt|contact|samband|kapcsolat|contatt|contacto/
export const IMPRINT = /impressum|imprint|legal notice|o nás|o nas|o-nas|about|o spoločnosti|o firme|um okkum|prevádzkovateľ|company info/

/** The patterns that hold for a page in `lang`: its own and the universal ones, or every language when it is unknown. */
export function wordsFor(words: Words, lang: string | undefined) {
  const own = lang && words[lang]
  const all = Object.values(words)
  return own ? [own, ...(words['*'] ? [words['*']] : [])] : all
}

const matchesAny = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text))

/**
 * The links that name a legal page in the page's language: by their text, or by the URL when the link has no text (an
 * icon). `also` lists links that name it in another language, for the evidence.
 */
export function legalLinks(links: Link[], words: Words, href: RegExp, lang: string | undefined, not?: RegExp) {
  const own = wordsFor(words, lang)
  const any = Object.values(words)
  const candidates = links.filter(link => !(not && not.test(link.text)))
  const named = candidates.filter(link => (link.text ? matchesAny(link.text, own) : href.test(pathOf(link.href))))
  const also = candidates.filter(link => link.text && !named.includes(link) && matchesAny(link.text, any))
  return { named: unique(named), also: unique(also) }
}

/** A link's path, decoded and lowercased, for matching slugs such as `/ochrana-osobnych-udajov`. */
export const pathOf = (url: string) => {
  const { pathname } = new URL(url)
  try {
    return decodeURI(pathname).toLowerCase()
  } catch {
    return pathname.toLowerCase()
  }
}

const unique = (links: Link[]) => links.filter((link, i) => links.findIndex(other => other.href === link.href) === i)

/** The first link (in document order) for the first pattern that any link matches, by text or by path. */
export function pick(links: Link[], patterns: RegExp[], host: string) {
  const own = links.filter(link => sameSite(link.href, host))
  for (const pattern of patterns) {
    const found = own.find(link => pattern.test(link.text) || pattern.test(pathOf(link.href)))
    if (found) return found.href
  }
}

export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')
const sameSite = (url: string, host: string) => hostOf(url) === host

/** The status a URL ends on after redirects; 0 when it does not answer. */
export async function statusOf(url: string) {
  try {
    const response = await get(url)
    await response.body?.cancel()
    return response.status
  } catch {
    return 0
  }
}

/** The page's HTML, or undefined when it does not answer 200. */
export async function htmlOf(url: string) {
  try {
    const response = await get(url)
    if (response.status !== 200) {
      await response.body?.cancel()
      return undefined
    }
    return { html: await response.text(), final: response.url || url }
  } catch {
    return undefined
  }
}

/**
 * Asks the item's `prompt.md` of the given pages (each answering 200, the home page first), and names the pages read in
 * the evidence. `extra` is appended to the prompt: facts the stripped HTML loses, such as JSON-LD.
 */
export async function askAbout(ctx: Context, pages: string[], extra = ''): Promise<Outcome> {
  const prompt = (await Bun.file(`${ctx.item.dir}/prompt.md`).text()).trim()
  const outcome = await ai({ kind: 'ai', model: 'haiku', prompt: extra ? `${prompt}\n\n${extra}` : prompt, pages }, ctx)
  return { ...outcome, evidence: `${outcome.evidence} (read ${pages.map(pathOf).join(', ')})` }
}

export interface LegalPages {
  home: string
  contact?: string
  imprint?: string
  terms?: string
  complaints?: string
  /** every link of the home page, for checks of their own */
  links: Link[]
}

/** The home page (after redirects) and the contact, imprint or about, terms and complaints pages it links on its own site. */
export async function legalPages(url: string): Promise<LegalPages | undefined> {
  const home = await htmlOf(url)
  if (!home) return undefined
  const links = await linksOf(home.html, home.final)
  const host = hostOf(home.final)
  const terms = Object.values(TERMS)
  // the general terms first: they open with who the operator is
  const general = [/obchodn\S* podmien|\bvop\b|obchodní podmín|geschäftsbedingung|\bagb\b|terms|treyt|vilkår|betingelser/, ...terms]
  return {
    home: home.final,
    contact: pick(links, [CONTACT], host),
    imprint: pick(links, [IMPRINT], host),
    terms: pick(links, general, host),
    complaints: pick(links, [COMPLAINTS], host),
    links,
  }
}

/** The distinct pages of `found` among `keys`, home first, keeping only those that answer 200. */
export async function answering(found: LegalPages, keys: (keyof Omit<LegalPages, 'links' | 'home'>)[]) {
  const urls = [...new Set([found.home, ...keys.map(key => found[key]).filter((url): url is string => Boolean(url))])]
  const statuses = await Promise.all(urls.map(statusOf))
  return urls.filter((_, i) => statuses[i] === 200)
}
