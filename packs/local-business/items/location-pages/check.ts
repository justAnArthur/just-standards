import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { allLocations, brandOf, describe, hasAddress, hasHours, indexable, locationPage, pathOf, some, survey, textOf, unreachable } from '../../shared.ts'

export default async function locationPages(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const found = await survey(ctx)
  if (!found) return unreachable(ctx)
  const brand = brandOf(ctx)
  const locations = allLocations(found, brand)
  if (locations.length === 0) {
    return {
      state: 'fail',
      evidence: `no locations known: no LocalBusiness or Place with an address in the JSON-LD of ${some(found.read.map(p => pathOf(p.final)), 4, ', ')}, and the business context lists none (a "## Locations" list)`,
    }
  }

  const problems: string[] = []
  const owners = new Map<string, string[]>()
  let good = 0
  for (const place of locations) {
    const own = await locationPage(place, found, brand)
    const { broken } = own
    // a business with one place: its contact page (or home page) is that place's page
    const page = own.page ?? (locations.length === 1 ? (found.contact ?? found.home) : undefined)
    const note = broken.length ? ` (its url ${broken.join(', ')})` : ''
    if (!page) {
      problems.push(`${describe(place)} has no page of its own${note}`)
      continue
    }
    const path = pathOf(page.final)
    owners.set(path, [...(owners.get(path) ?? []), place.name])
    const text = await textOf(page.html)
    const lacks = [
      !(await indexable(page)) && 'is noindex',
      place.street ? !hasAddress(text, place) && `doesn't show the address "${place.street}"` : undefined,
      !hasHours(text) && 'shows no opening hours',
    ].filter(Boolean)
    if (lacks.length) problems.push(`${describe(place)}: ${path} ${lacks.join(', ')}${note}`)
    else good++
  }
  if (locations.length > 1) {
    for (const [path, names] of owners) {
      if (names.length > 1) problems.unshift(`${names.length} locations share ${path} instead of a page each: ${some(names, 3, ', ')}`)
    }
  }
  const sources = [found.locations.length && `${found.locations.length} in JSON-LD`, found.listed.length && `${found.listed.length} in the business context`]
  const counted = `${locations.length} location${locations.length > 1 ? 's' : ''}: ${sources.filter(Boolean).join(', ')}`
  if (problems.length) return { state: 'fail', evidence: `${some(problems, 4)} (${counted})` }
  return { state: 'pass', evidence: `each of the ${counted} has an indexable page with its address and opening hours (${good} pages)` }
}
