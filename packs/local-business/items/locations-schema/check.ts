import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { brandOf, describe, page, pathOf, type Node, type Place, samePlace, some, survey, typesOf, unreachable } from '../../shared.ts'

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')
const filled = (value: unknown) => (Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '')
const numeric = (value: unknown) => text(value) !== '' && Number.isFinite(Number(text(value)))

/** What a LocalBusiness node lacks of what maps and search read: name, a full PostalAddress, phone, geo, hours, url. */
export function missingOf(node: Node) {
  const missing: string[] = []
  if (!text(node.name)) missing.push('name')
  const address = Array.isArray(node.address) ? node.address[0] : node.address
  if (!address) missing.push('address')
  else if (typeof address === 'string') missing.push('a PostalAddress (address is plain text)')
  else {
    const postal = address as Node
    const country = postal.addressCountry
    const fields = {
      streetAddress: text(postal.streetAddress),
      postalCode: text(postal.postalCode),
      addressLocality: text(postal.addressLocality),
      addressCountry: typeof country === 'object' && country ? text((country as Node).name) : text(country),
    }
    const empty = Object.entries(fields).filter(([, value]) => !value)
    if (empty.length) missing.push(`address.${empty.map(([key]) => key).join('/')}`)
  }
  if (!text(Array.isArray(node.telephone) ? node.telephone[0] : node.telephone)) missing.push('telephone')
  const geo = (Array.isArray(node.geo) ? node.geo[0] : node.geo) as Node | undefined
  const [lat, lng] = geo && typeof geo === 'object' ? [geo.latitude, geo.longitude] : [node.latitude, node.longitude]
  if (!numeric(lat) || !numeric(lng)) missing.push('geo')
  if (!filled(node.openingHoursSpecification) && !filled(node.openingHours)) missing.push('openingHoursSpecification')
  if (!text(node.url)) missing.push('url')
  return missing
}

export default async function locationsSchema(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const found = await survey(ctx)
  if (!found) return unreachable(ctx)
  const brand = brandOf(ctx)
  const read = `read ${some(found.read.map(p => pathOf(p.final)), 6, ', ')}`
  const broken = found.invalid.length ? `; JSON-LD that doesn't parse on ${found.invalid.join(', ')}` : ''

  // one entry per business, though home and its own page may both carry it
  const businesses: Place[] = []
  for (const place of found.businesses) if (!businesses.some(other => other.name === place.name && samePlace(other, place, brand))) businesses.push(place)

  if (businesses.length === 0) {
    const places = found.locations.filter(place => typesOf(place.node ?? {}).includes('Place'))
    const near = places.length
      ? `; ${places.length} schema.org Place node${places.length > 1 ? 's' : ''} with an address (${some(places.map(describe), 3, ', ')}) on ${[...new Set(places.map(p => p.source))].join(', ')}: make each a LocalBusiness subtype such as AutoRental`
      : ''
    return { state: 'fail', evidence: `no LocalBusiness JSON-LD (AutoRental or another subtype)${near}${broken} (${read})` }
  }

  const problems: string[] = []
  for (const place of businesses) {
    const missing = missingOf(place.node as Node)
    if (missing.length) problems.push(`${describe(place)} on ${place.source} lacks ${missing.join(', ')}`)
  }
  const urls = [...new Set(businesses.map(place => place.url).filter((url): url is string => Boolean(url)))]
  for (const answer of await Promise.all(urls.map(page))) {
    if (answer.status !== 200) problems.push(`its url ${answer.url} answers ${answer.status || 'nothing'}`)
  }
  const unlisted = found.listed.filter(place => !businesses.some(other => samePlace(place, other, brand)))
  if (unlisted.length) {
    problems.push(`${unlisted.length} of the ${found.listed.length} locations in the business context have no LocalBusiness: ${some(unlisted.map(describe), 4, ', ')}`)
  }

  const count = `${businesses.length} LocalBusiness node${businesses.length > 1 ? 's' : ''} (${some([...new Set(businesses.map(p => typesOf(p.node ?? {})[0]))], 3, ', ')})`
  if (problems.length) return { state: 'fail', evidence: `${some(problems, 4)}${broken} (${count}; ${read})` }
  return { state: 'pass', evidence: `${count}, each with a name, a full PostalAddress, telephone, geo, opening hours and a url that answers${broken} (${read})` }
}
