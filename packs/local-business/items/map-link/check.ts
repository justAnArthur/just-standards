import type { Context } from '../../../../core/checks/context.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { allLocations, brandOf, describe, locationPage, type Page, pathOf, some, survey, unreachable } from '../../shared.ts'

/** Google Maps, Apple Maps, OpenStreetMap, Mapy.cz, Waze, Bing and HERE, linked or embedded. */
export const MAP =
  /^https?:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl|(www\.)?google\.com\/maps|maps\.apple\.com|(www\.)?openstreetmap\.org|osm\.org|(www\.)?mapy\.(cz|com)|(www\.)?waze\.com|(www\.)?bing\.com\/maps|wego\.here\.com|share\.here\.com)/i

/** The distinct map links and embeds on a page. */
export async function mapsOn(html: string) {
  const links = (await select(html, 'a[href]')).map(link => link.attrs.href ?? '')
  const frames = (await select(html, 'iframe[src], iframe[data-src]')).map(frame => frame.attrs.src ?? frame.attrs['data-src'] ?? '')
  return [...new Set([...links, ...frames].filter(url => MAP.test(url)))]
}

export default async function mapLink(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const found = await survey(ctx)
  if (!found) return unreachable(ctx)
  const brand = brandOf(ctx)
  const locations = allLocations(found, brand)

  // each location's own page; where there are none, the contact page holds them all
  const pages = new Map<string, { page: Page; places: string[] }>()
  for (const place of locations) {
    const { page } = await locationPage(place, found, brand)
    const at = page ?? found.contact
    if (!at) continue
    const entry = pages.get(at.final) ?? { page: at, places: [] }
    entry.places.push(describe(place))
    pages.set(at.final, entry)
  }
  if (pages.size === 0 && found.contact) pages.set(found.contact.final, { page: found.contact, places: [] })
  if (pages.size === 0) return { state: 'fail', evidence: `no location page and no contact page to look for a map on (read ${pathOf(found.home.final)})` }

  const problems: string[] = []
  let maps = 0
  for (const { page, places } of pages.values()) {
    const found = await mapsOn(page.html)
    maps += found.length
    const needed = Math.max(1, places.length)
    if (found.length < needed) {
      problems.push(
        `${pathOf(page.final)} has ${found.length || 'no'} map link${found.length === 1 ? '' : 's'}${places.length > 1 ? ` for ${places.length} locations` : ''}${places.length ? ` (${some(places, 3, ', ')})` : ''}`,
      )
    }
  }
  const read = `${pages.size} page${pages.size > 1 ? 's' : ''} for ${locations.length} location${locations.length === 1 ? '' : 's'}`
  if (problems.length) return { state: 'fail', evidence: `${some(problems, 4)} (${read})` }
  return { state: 'pass', evidence: `every location page links to a map or embeds one: ${maps} map${maps === 1 ? '' : 's'} (${read})` }
}
