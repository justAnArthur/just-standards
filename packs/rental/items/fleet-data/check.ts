import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { jsonLd, page, pathOf, some, textOf, type Node, typesOf, unreachable } from '../../../local-business/shared.ts'
import { fleetPages, homeOf } from '../../shared.ts'

/** The facts a renter compares, as a page's visible text states them. */
const FACTS: [string, RegExp][] = [
  ['seats', /\d+\s*-?\s*(miest|sedad|seat|sitz|pláss|sæde|sete|osob|person|passeng)|počet (miest|sedadiel)|\bseats\b|sitzplätze/i],
  ['transmission', /automat|manu[aá]l|prevodovk|transmission|gearbox|getriebe|schaltung|gírkass|gearkass|\bgear\b/i],
  ['luggage or category', /batož|kufr|kufor|luggage|\bbags?\b|suitcase|gepäck|koffer|kuffert|taska|categor|kategór|skupina|\bgroup\b|segment|\bclass\b|trieda|klasse|bólkur/i],
  ['"from" price', /(?:\bod|\bfrom|\bab|\bfrá|\bfra|\bjá od|starting at)\s*:?\s*(?:€|eur\b|kr\.?|dkk|czk|kč|\$|£)?\s*\d[\d\s.,]*\s*(?:€|eur\b|kr\b|dkk|czk|kč|,-)|(?:\bod|\bfrom|\bab|\bfrá|\bfra)\s*:?\s*(?:€|eur|kr\.?|dkk|czk|kč|\$|£)\s*\d/i],
]

const VEHICLE = /^(Car|Vehicle|Product|BusOrCoach|Motorcycle|MotorizedBicycle|IndividualProduct|ProductModel)$/

/** Whether an Offer (or AggregateOffer, or its priceSpecification) has a price and a currency. */
function priced(offer: unknown): boolean {
  if (Array.isArray(offer)) return offer.some(priced)
  if (!offer || typeof offer !== 'object') return false
  const node = offer as Node
  const spec = (Array.isArray(node.priceSpecification) ? node.priceSpecification[0] : node.priceSpecification) as Node | undefined
  const price = node.price ?? node.lowPrice ?? spec?.price
  const currency = node.priceCurrency ?? spec?.priceCurrency
  return price !== undefined && price !== '' && typeof currency === 'string' && currency.length === 3
}

/** What a vehicle page lacks: facts in its text, and a Car/Vehicle/Product node with a priced Offer. */
export async function lacksOf(html: string) {
  const text = (await textOf(html)).replace(/\s+/g, ' ')
  const lacks = FACTS.filter(([, pattern]) => !pattern.test(text)).map(([name]) => name)
  const { nodes } = await jsonLd(html)
  const vehicles = nodes.filter(node => typesOf(node).some(type => VEHICLE.test(type)))
  if (vehicles.length === 0) lacks.push('Car/Product JSON-LD')
  else if (!vehicles.some(node => priced(node.offers))) lacks.push('an Offer with price and priceCurrency in its JSON-LD')
  return lacks
}

export default async function fleetData(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const home = await homeOf(ctx)
  if (!home) return unreachable(ctx)
  const fleet = await fleetPages(home)
  if (fleet.vehicles.length === 0 && !fleet.index) {
    const why = fleet.indexUrl ? `the fleet link ${pathOf(fleet.indexUrl)} doesn't answer 200` : 'the home page links no fleet page'
    return { state: 'fail', evidence: `${why}, and neither it nor the sitemap lists vehicle pages` }
  }

  // no vehicle pages: the fleet's index page must carry the facts itself
  const urls = fleet.vehicles.length ? fleet.vehicles : [fleet.index!.final]
  const problems: string[] = []
  for (const answer of await Promise.all(urls.map(page))) {
    const path = pathOf(answer.final)
    if (answer.status !== 200 || !answer.html) {
      problems.push(`${path} answers ${answer.status || 'nothing'}`)
      continue
    }
    const lacks = await lacksOf(answer.html)
    if (lacks.length) problems.push(`${path} lacks ${lacks.join(', ')}`)
  }
  const read = fleet.vehicles.length
    ? `${urls.length} of ${fleet.total} vehicle pages`
    : `the fleet page ${pathOf(urls[0]!)}, as no vehicle has a page of its own`
  if (problems.length) return { state: 'fail', evidence: `${problems.length} of ${urls.length}: ${some(problems, 3)} (${read})` }
  return { state: 'pass', evidence: `seats, transmission, luggage or class and a "from" price in the text, and Car/Product JSON-LD with a priced Offer (${read})` }
}
