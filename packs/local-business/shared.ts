// What the local-business items share: a page's visible text and links, its JSON-LD, phone numbers and addresses compared
// loosely, the locations the business context lists, and one survey per site of the pages where locations are told.
import { join } from 'node:path'
import type { Context } from '../../core/checks/context.ts'
import { resolve } from '../../core/checks/http.ts'
import { sitemapOf, sitemapPages } from '../../core/crawl.ts'
import { get, isPreview, local } from '../../core/expect.ts'
import { decode, select } from '../../core/html.ts'
import { CONTACT, hostOf, linksOf, pathOf, pick, type Link } from '../eu-consumer/links.ts'

export { pathOf } from '../eu-consumer/links.ts'
export { some } from '../seo/shared.ts'

// ---------------------------------------------------------------------------------------------------------------- pages

export interface Page {
  url: string
  /** where it ended up after redirects */
  final: string
  status: number
  headers: Headers
  /** empty when it isn't HTML or didn't answer */
  html: string
}

const pages = new Map<string, Promise<Page>>()

/** One GET per URL per process: every item reads the same copy. */
export function page(url: string): Promise<Page> {
  const key = local(url)
  let found = pages.get(key)
  if (!found) {
    found = (async () => {
      try {
        const response = await get(url)
        const html = /html/.test(response.headers.get('content-type') ?? '') ? await response.text() : ''
        if (!html) await response.body?.cancel()
        return { url, final: response.url || url, status: response.status, headers: response.headers, html }
      } catch {
        return { url, final: url, status: 0, headers: new Headers(), html: '' }
      }
    })()
    pages.set(key, found)
  }
  return found
}

/** Whether a page may be indexed: no `noindex` in its robots meta tag or (off a preview) its `x-robots-tag` header. */
export async function indexable(found: Page) {
  const meta = await select(found.html, 'meta[name="robots"], meta[name="googlebot"]')
  if (meta.some(tag => /noindex/i.test(tag.attrs.content ?? ''))) return false
  return isPreview(found.final) || !/noindex/i.test(found.headers.get('x-robots-tag') ?? '')
}

// ------------------------------------------------------------------------------------------------------------------ text

const SKIPPED = new Set(['head', 'script', 'style', 'svg', 'noscript', 'template', 'iframe'])
const BLOCKS = new Set(
  'address article aside blockquote br dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td tfoot th thead tr ul button label option select'.split(
    ' ',
  ),
)

/** A stretch of visible text and the `href` of the link it is in, if any. */
export interface Run {
  text: string
  href?: string
}

/** The page's visible text in document order, cut at block elements, each piece with the link it sits in. */
export async function runsOf(html: string): Promise<Run[]> {
  const runs: Run[] = []
  const links: (string | undefined)[] = []
  let skip = 0
  const add = (text: string) => {
    const href = links.at(-1)
    const last = runs.at(-1)
    if (last && last.href === href && !(text === '\n' && last.text.endsWith('\n'))) last.text += text
    else if (!(text === '\n' && (!last || last.text.endsWith('\n')))) runs.push(href === undefined ? { text } : { text, href })
  }
  // One handler per element: a second `onEndTag` on the same element replaces the first.
  await new HTMLRewriter()
    .on('*', {
      element(element) {
        // a void element (`<input hidden>`, `<br>`) has no end tag
        const closes = element.canHaveContent && !element.selfClosing
        const tag = element.tagName.toLowerCase()
        const skipped = closes && (SKIPPED.has(tag) || element.hasAttribute('hidden'))
        const link = closes && tag === 'a'
        const block = BLOCKS.has(tag)
        if (skipped) skip++
        if (link) links.push(element.getAttribute('href') ?? '')
        if (link || block) add('\n')
        if (closes && (skipped || link || block)) {
          element.onEndTag(() => {
            if (skipped) skip--
            if (link) links.pop()
            if (link || block) add('\n')
          })
        }
      },
    })
    .onDocument({
      text(chunk) {
        if (!skip && chunk.text) add(chunk.text)
      },
    })
    .transform(new Response(html))
    .text()
  return runs.map(run => ({ ...run, text: decode(run.text).replace(/[ \t\u00a0]+/g, ' ') })).filter(run => run.text.trim())
}

/** The page's visible text, one block per line. */
export async function textOf(html: string) {
  return (await runsOf(html))
    .map(run => run.text)
    .join('\n')
    .replace(/ *\n[\s\n]*/g, '\n')
    .trim()
}

/** The text of the page's `<footer>` (all of them), or undefined when it has none. */
export async function footerOf(html: string) {
  const parts: string[] = []
  let depth = 0
  await new HTMLRewriter()
    .on('footer', {
      element(element) {
        if (!element.canHaveContent) return
        if (depth++ === 0) parts.push('')
        element.onEndTag(() => void depth--)
      },
    })
    .on('footer script, footer style, footer svg', { element: element => void element.remove() })
    .on('footer *', {
      element(element) {
        if (BLOCKS.has(element.tagName.toLowerCase()) || element.tagName === 'a') parts[parts.length - 1] += '\n'
      },
    })
    .onDocument({
      text(chunk) {
        if (depth > 0) parts[parts.length - 1] += chunk.text
      },
    })
    .transform(new Response(html))
    .text()
  return parts.length ? decode(parts.join('\n')).replace(/[ \t\u00a0]+/g, ' ') : undefined
}

const FOLD: Record<string, string> = { ø: 'o', æ: 'ae', ð: 'd', þ: 'th', ß: 'ss', ł: 'l', đ: 'd', œ: 'oe' }

/** Lowercased, without diacritics and punctuation, whitespace collapsed: for comparing names and addresses as written. */
export function fold(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[øæðþßłđœ]/g, char => FOLD[char] ?? char)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// ---------------------------------------------------------------------------------------------------------------- JSON-LD

export type Node = Record<string, unknown>

/** Every object in a JSON-LD value: through arrays, `@graph` and nested properties. */
export function* nodesIn(value: unknown): Generator<Node> {
  if (Array.isArray(value)) for (const entry of value) yield* nodesIn(entry)
  else if (value && typeof value === 'object') {
    yield value as Node
    for (const child of Object.values(value)) yield* nodesIn(child)
  }
}

/** Every JSON-LD object on the page, and how many blocks don't parse. */
export async function jsonLd(html: string) {
  const nodes: Node[] = []
  let invalid = 0
  for (const script of await select(html, 'script[type="application/ld+json"]')) {
    try {
      nodes.push(...nodesIn(JSON.parse(script.text)))
    } catch {
      invalid++
    }
  }
  return { nodes, invalid }
}

export const typesOf = (node: Node) => {
  const type = node['@type']
  return (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string').map(t => t.replace(/^(https?:\/\/)?schema\.org\//, ''))
}

/** schema.org's LocalBusiness and its subtypes (https://schema.org/LocalBusiness, "More specific Types"). */
export const LOCAL_BUSINESS = new Set(
  `LocalBusiness AnimalShelter ArchiveOrganization AutomotiveBusiness AutoBodyShop AutoDealer AutoPartsStore AutoRental
  AutoRepair AutoWash GasStation MotorcycleDealer MotorcycleRepair ChildCare Dentist DryCleaningOrLaundry EmergencyService
  FireStation Hospital PoliceStation EmploymentAgency EntertainmentBusiness AdultEntertainment AmusementPark ArtGallery
  Casino ComedyClub MovieTheater NightClub FinancialService AccountingService AutomatedTeller BankOrCreditUnion
  InsuranceAgency FoodEstablishment Bakery BarOrPub Brewery CafeOrCoffeeShop Distillery FastFoodRestaurant IceCreamShop
  Restaurant Winery GovernmentOffice PostOffice HealthAndBeautyBusiness BeautySalon DaySpa HairSalon HealthClub NailSalon
  TattooParlor HomeAndConstructionBusiness Electrician GeneralContractor HVACBusiness HousePainter Locksmith MovingCompany
  Plumber RoofingContractor InternetCafe LegalService Attorney Notary Library LodgingBusiness BedAndBreakfast Campground
  Hostel Hotel Motel Resort SkiResort VacationRental MedicalBusiness MedicalClinic Optician Pharmacy Physician
  ProfessionalService RadioStation RealEstateAgent RecyclingCenter SelfStorage ShoppingCenter SportsActivityLocation
  BowlingAlley ExerciseGym GolfCourse PublicSwimmingPool SportsClub StadiumOrArena TennisComplex Store BikeStore BookStore
  ClothingStore ComputerStore ConvenienceStore DepartmentStore ElectronicsStore Florist FurnitureStore GardenStore
  GroceryStore HardwareStore HobbyShop HomeGoodsStore JewelryStore LiquorStore MensClothingStore MobilePhoneStore MovieRentalStore
  MusicStore OfficeEquipmentStore OutletStore PawnShop PetStore ShoeStore SportingGoodsStore TireShop ToyStore WholesaleStore
  TelevisionStation TouristInformationCenter TravelAgency`.split(/\s+/),
)

export const isLocalBusiness = (node: Node) => typesOf(node).some(type => LOCAL_BUSINESS.has(type))

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value)

// --------------------------------------------------------------------------------------------------------------- places

export interface Place {
  name: string
  /** the street and number, as written */
  street?: string
  postcode?: string
  locality?: string
  /** the whole address in one line, as written */
  address?: string
  telephone?: string
  url?: string
  /** where it was found: a page's path, or `business context` */
  source: string
  node?: Node
}

/** The street of a one-line address: its first comma-separated part with a number in it ("OC Cassovia, Pri prachárni 4"). */
export function streetOf(address: string) {
  const parts = address.split(/\s*,\s*/).filter(Boolean)
  return parts.find(part => /\d/.test(part) && !/^\d{3}\s?\d{2}\b|^\d{4,5}\b/.test(part)) ?? parts[0]
}

/** A postcode in a one-line address: `821 04`, `100`, `10115`. */
export const postcodeOf = (address: string) => address.match(/\b\d{3}\s?\d{2}\b/)?.[0] ?? address.match(/(?:^|,\s*|\s)(\d{3,5})(?=\s|,|$)/)?.[1]

/** A JSON-LD node's place: its name, address (a PostalAddress or a line of text) and telephone. */
export function placeOf(node: Node, source: string): Place {
  const raw = first(node.address)
  const place: Place = { name: str(node.name), source, node }
  if (typeof raw === 'string' && raw.trim()) {
    place.address = raw.trim()
    place.street = streetOf(place.address)
    place.postcode = postcodeOf(place.address)
  } else if (raw && typeof raw === 'object') {
    const address = raw as Node
    place.street = str(address.streetAddress) || undefined
    place.postcode = str(address.postalCode) || undefined
    place.locality = str(address.addressLocality) || undefined
    place.address = [place.street, [place.postcode, place.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined
  }
  const phone = str(first(node.telephone))
  if (phone) place.telephone = phone
  const url = str(node.url) || (/^https?:/.test(str(node['@id'])) ? str(node['@id']) : '')
  if (url) place.url = url
  return place
}

/** A place someone can go to: a LocalBusiness or a Place (a contactPoint, a location) with an address that isn't blank. */
export const isLocation = (node: Node) =>
  (isLocalBusiness(node) || typesOf(node).includes('Place')) && Boolean(placeOf(node, '').street || placeOf(node, '').postcode)

/** Words that say nothing about which branch it is: the brand and the trade. */
const GENERIC = new Set('a the and of car cars van vans rent rental rentals hire autopozicovna pozicovna aut prenajom branch pobocka'.split(' '))

/** The words that tell a location apart: its name folded, without the brand's words and the trade's. */
export function nameTokens(name: string, brand: string[]) {
  const skip = new Set([...GENERIC, ...brand.flatMap(word => fold(word).split(' '))])
  return fold(name)
    .split(' ')
    .filter(word => word && !skip.has(word))
}

/** The words of the business name and of the site's host (`avis` of www.avis.sk), which every location shares. */
export const brandOf = (ctx: Context) => [ctx.business.name, ...(ctx.asset.url ? [hostOf(ctx.asset.url).split('.')[0] as string] : [])]

/** Whether two places are one: the same street, or every telling word of one's name in the other's. */
export function samePlace(a: Place, b: Place, brand: string[]) {
  if (a.street && b.street && fold(a.street) === fold(b.street) && (!a.postcode || !b.postcode || digits(a.postcode) === digits(b.postcode))) {
    // two branches at one address (a city desk and an airport desk) tell apart by name
    const [x, y] = [nameTokens(a.name, brand), nameTokens(b.name, brand)]
    return x.length === 0 || y.length === 0 || x.every(word => y.includes(word)) || y.every(word => x.includes(word))
  }
  const words = nameTokens(a.name, brand)
  const other = new Set(fold(`${b.name} ${b.address ?? ''}`).split(' '))
  return words.length > 0 && words.every(word => other.has(word))
}

/** Whether the text holds the place's street (or the street's name and its postcode), however it is spelled. */
export function hasAddress(text: string, place: Place) {
  if (!place.street) return false
  const folded = ` ${fold(text)} `
  if (folded.includes(` ${fold(place.street)} `)) return true
  const name = fold(place.street.replace(/\d+[\w/]*/g, ' '))
  return Boolean(name && place.postcode && folded.includes(` ${name} `) && digits(text).includes(digits(place.postcode)))
}

const TIME = String.raw`(?:[01]?\d|2[0-4])[:.][0-5]\d`
const HOURS_RANGE = new RegExp(String.raw`${TIME}\s*(?:[-–—]|to|do|až|until|bis|til|-)?\s*${TIME}|non-?stop|24\s*/\s*7|0\s*[-–]\s*24\s*h?`, 'i')
const HOURS_WORDS =
  /pondel|utor|stred|štvrt|piat|sobot|nedel|pracovn|víkend|otv[aá]r|hodin|monday|tuesday|friday|saturday|sunday|\bmon\b|\bsun\b|weekday|weekend|opening|hours|montag|sonntag|öffnungs|m[aá]nadag|sunnudag|leygardag|mandag|søndag|non-?stop|24\s*\/\s*7/i

/** Whether the text states opening hours: a time range (`08:00 – 18:00`, `nonstop`) with a day or an "opening hours" word. */
export const hasHours = (text: string) => HOURS_RANGE.test(text) && HOURS_WORDS.test(text)

// --------------------------------------------------------------------------------------------------------------- phones

export const digits = (text: string) => text.replace(/\D/g, '')

/** The digits that identify a number wherever it's written: without `+`, `00`, the trunk `0`. */
const core = (phone: string) => digits(phone).replace(/^00/, '').replace(/^0/, '')

/** Two numbers are one: the same digits, give or take the country code (`+421 2 2086 2620` and `02/2086 2620`). */
export function samePhone(a: string, b: string) {
  const [x, y] = [core(a), core(b)]
  if (x.length < 6 || y.length < 6) return false
  const [long, short] = x.length >= y.length ? [x, y] : [y, x]
  return long === short || (long.endsWith(short) && long.length - short.length <= 3)
}

// one separator at most between digits, and a `(0)` after the country code: "+421 900 200 200 (0,60 €/min)" ends at 200
const INTERNATIONAL = /(?<![\w+])\+[1-9]\d{0,3}(?:\s?\(0\))?(?:[ \u00a0.\/-]?\d){5,13}(?!\d)/g
const LABELED =
  /(?:\btel\b\.?|telef[oó]n\w*|phone|mobil\w*|\bmob\b\.?|\bgsm\b|call us|volajte|zavolajte|infolinka|hotline|s[ií]mi|telefon)\s*[:.]?\s*((?:\+|00)?\d(?:[ \u00a0.\/-]?\d){6,14})(?!\d)/gi

/** The phone numbers written in a text: international ones (`+421 …`) anywhere, national ones after a label (`Tel.: 02/…`). */
export function phonesIn(text: string) {
  const found: string[] = []
  const add = (number: string, at: number) => {
    const count = digits(number).length
    if (count < 7 || count > 15) return
    if (/fax\W*$/i.test(text.slice(Math.max(0, at - 12), at))) return
    if (!found.some(other => samePhone(other, number))) found.push(number.trim())
  }
  for (const match of text.matchAll(INTERNATIONAL)) add(match[0], match.index)
  for (const match of text.matchAll(LABELED)) add(match[1] as string, match.index)
  return found
}

export const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g

// -------------------------------------------------------------------------------------------------------------- context

const LOCATIONS_HEADING = /location|pick-?up|branch|pobo[cč]k|station|office|store|shop|prev[aá]dzk|standort|filial|predaj/i

/**
 * The locations the business context lists: the bullets under a heading such as "## Locations" (or "Pick-up points",
 * "Pobočky"), each `name: street, postcode town` (or `name — …`); a link in a bullet is that location's page.
 */
export function parseLocations(markdown: string): Place[] {
  const places: Place[] = []
  let inside = false
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      inside = LOCATIONS_HEADING.test(heading[1] as string)
      continue
    }
    const bullet = inside && line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
    if (!bullet) continue
    let text = bullet[1] as string
    const url = text.match(/\]\((https?:\/\/[^)\s]+)\)/)?.[1] ?? text.match(/<?(https?:\/\/[^\s>)]+)>?/)?.[1]
    text = text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<?https?:\/\/[^\s>)]+>?/g, '')
      .replace(/[*_`]/g, '')
      .replace(/\(\s*\)/g, '')
      .trim()
    const [name, address] = text.split(/\s+[—–|]\s+|:\s+|\s+-\s+/, 2).map(part => part?.trim().replace(/[,;.]$/, ''))
    if (!name) continue
    const place: Place = { name, source: 'business context' }
    if (address) {
      place.address = address
      place.street = streetOf(address)
      place.postcode = postcodeOf(address)
    }
    if (url) place.url = url
    places.push(place)
  }
  return places
}

/** The locations in `businesses/<id>.context.md` of the workspace; none when there is no such file or list. */
export async function contextLocations(ctx: Context) {
  if (!ctx.wsDir) return []
  const file = Bun.file(join(ctx.wsDir, 'businesses', `${ctx.business.id}.context.md`))
  return (await file.exists()) ? parseLocations(await file.text()) : []
}

// --------------------------------------------------------------------------------------------------------------- survey

/** Paths that name a page of locations or of one location. */
const LOCATION_PATH = /pobo[cč]k|locations?\b|branch|stanic|offices?\b|prevadzk|standort|filial|pick-?up|stations?\b|predajn|kde-nas|where-to-find/i
/** Paths of posts and offers, which mention a branch without being its page. */
const NOT_A_PLACE = /\/(blogs?|aktuality|news|novinky|clanky?|articles?|ponuky|akcie|offers?|promo|tag|kategoria|category)(\/|$)/i
const MAX_PAGES = 12
const CONTACT_PATH = /^(\/[a-z]{2})?\/(kontakt\w*|contacts?|contact-us|samband|kapcsolat)\/?$/

export interface Survey {
  /** the home page, after redirects */
  home: Page
  contact?: Page
  /** every page read: home, contact, then location pages */
  read: Page[]
  /** every LocalBusiness node, with the page it is on */
  businesses: Place[]
  /** every place with an address (LocalBusiness or Place), deduplicated */
  locations: Place[]
  /** what the business context lists */
  listed: Place[]
  /** the site's own URLs from the home and contact pages' links and the sitemap */
  urls: string[]
  /** the home and contact pages' links */
  links: Link[]
  /** JSON-LD blocks that don't parse, by page path */
  invalid: string[]
}

const surveys = new Map<string, Promise<Survey | undefined>>()

/** One survey per site per process: the pages where locations are told, and what they say. */
export function survey(ctx: Context): Promise<Survey | undefined> {
  const url = ctx.asset.url as string
  const key = `${ctx.business.id} ${ctx.wsDir ?? ''} ${local(url)}`
  let found = surveys.get(key)
  if (!found) {
    found = surveyFresh(ctx, url)
    surveys.set(key, found)
  }
  return found
}

async function surveyFresh(ctx: Context, url: string): Promise<Survey | undefined> {
  const home = await page(url)
  if (home.status !== 200 || !home.html) return undefined
  const host = hostOf(home.final)
  const homeLinks = await linksOf(home.html, home.final)
  // on a preview, the sitemap and the JSON-LD name production URLs: they are read from the preview
  const sitemap = ((await sitemapPages(await sitemapOf(home.final)).catch(() => undefined)) ?? []).map(local)
  // a contact page the menu builds in the browser is still in the sitemap
  const contactUrl = pick(homeLinks, [CONTACT], host) ?? sitemap.find(url => CONTACT_PATH.test(pathOf(url)))
  const contact = contactUrl ? await page(contactUrl) : undefined
  const links = [...homeLinks, ...(contact?.html ? await linksOf(contact.html, contact.final) : [])]
  const own = (link: string) => {
    try {
      return hostOf(local(link)) === host
    } catch {
      return false
    }
  }
  const urls = [...new Set([...links.map(link => local(link.href)), ...sitemap].filter(own).map(link => link.replace(/[?#].*$/, '')))]
  const listed = await contextLocations(ctx)
  const brand = brandOf(ctx)

  const read: Page[] = [home, ...(contact && contact.status === 200 && contact.final !== home.final ? [contact] : [])]
  const businesses: Place[] = []
  const locations: Place[] = []
  const invalid: string[] = []
  const take = async (found: Page) => {
    const { nodes, invalid: broken } = await jsonLd(found.html)
    if (broken) invalid.push(pathOf(found.final))
    for (const node of nodes) {
      const place = placeOf(node, pathOf(found.final))
      if (isLocalBusiness(node)) businesses.push(place)
      if (isLocation(node) && !locations.some(other => samePlace(other, place, brand) && other.name === place.name)) locations.push(place)
    }
  }
  for (const found of read) await take(found)

  // Location pages: those the JSON-LD and the context point at, those whose path says "branch" or names a listed place.
  const named = [...locations, ...listed]
  const candidates = new Set<string>()
  for (const place of named) {
    const match = pageFor(place, urls, brand, home.final, named)
    if (match) candidates.add(match)
  }
  for (const place of named) if (place.url && own(place.url)) candidates.add(place.url)
  for (const link of urls) if (LOCATION_PATH.test(pathOf(link)) && !NOT_A_PLACE.test(pathOf(link))) candidates.add(link)
  const extra = [...candidates].filter(link => !read.some(found => found.final === link || found.url === link)).slice(0, MAX_PAGES - read.length)
  for (const found of await Promise.all(extra.map(page))) {
    if (found.status !== 200 || !found.html) continue
    if (read.some(other => other.final === found.final)) continue
    read.push(found)
    await take(found)
  }
  return { home, contact: read.includes(contact as Page) ? contact : undefined, read, businesses, locations, listed, urls, links, invalid }
}

/** Words that only say which of a town's branches it is: dropped when no slug names the place in full. */
const QUARTER = new Set(['mesto', 'city', 'centrum', 'center', 'centre', 'downtown', 'town'])

/**
 * The site's URL that is this place's own page by its path: every telling word of the name in its slug, the shortest.
 * Failing that, the words without "city" or "centrum", on a path that names no other place in full.
 */
export function pageFor(place: Place, urls: string[], brand: string[], home: string, others: Place[] = []) {
  const words = nameTokens(place.name, brand)
  if (words.length === 0) return undefined
  const slugOf = (link: string) => new Set(fold(pathOf(link)).split(' '))
  const usable = urls.filter(link => !NOT_A_PLACE.test(pathOf(link)) && resolve('/', link) !== link && link !== home)
  const shortest = (list: string[]) => list.sort((a, b) => a.length - b.length)[0]
  const full = shortest(usable.filter(link => words.every(word => slugOf(link).has(word))))
  if (full) return full
  const loose = words.filter(word => !QUARTER.has(word))
  if (loose.length === 0 || loose.length === words.length) return undefined
  const claimed = others
    .filter(other => other !== place && other.name !== place.name)
    .map(other => nameTokens(other.name, brand))
    .filter(tokens => tokens.length > 0)
  return shortest(
    usable.filter(link => {
      const slug = slugOf(link)
      return loose.every(word => slug.has(word)) && !claimed.some(tokens => tokens.every(word => slug.has(word)))
    }),
  )
}

/** Every location the site and the context know, the JSON-LD's first, with the context's that match none of them added. */
export function allLocations(found: Survey, brand: string[]) {
  const all = [...found.locations]
  for (const place of found.listed) if (!all.some(other => samePlace(place, other, brand))) all.push(place)
  return all
}

/** The page that is this location's own: its JSON-LD or context `url` if it answers, else one whose slug names it. */
export async function locationPage(place: Place, found: Survey, brand: string[]) {
  const listed = found.listed.find(other => samePlace(place, other, brand))
  const declared = [place.url, listed?.url].filter((link): link is string => Boolean(link))
  const broken: string[] = []
  for (const link of declared) {
    const answer = await page(link)
    if (answer.status === 200 && answer.html && answer.final !== found.home.final) return { page: answer, broken }
    if (answer.status !== 200) broken.push(`${pathOf(link)} answers ${answer.status || 'nothing'}`)
  }
  const others = allLocations(found, brand)
  const match = pageFor(place, found.urls, brand, found.home.final, others) ?? (listed && pageFor(listed, found.urls, brand, found.home.final, others))
  if (match) {
    const answer = await page(match)
    if (answer.status === 200 && answer.html) return { page: answer, broken }
  }
  return { page: undefined, broken }
}

export const describe = (place: Place) => `${place.name || '(no name)'}${place.street ? ` (${place.street})` : ''}`

/** The error for a site whose home page can't be read: its status (a 403 from a bot checkpoint, a 5xx), not a guess. */
export async function unreachable(ctx: Context) {
  const home = await page(ctx.asset.url as string)
  const why = home.status === 0 ? 'did not respond' : home.status === 200 ? 'answered 200 without HTML' : `answered ${home.status}`
  return { state: 'error' as const, evidence: `${ctx.asset.url} ${why}` }
}
