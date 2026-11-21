import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { askAbout, hostOf, pathOf } from '../../../eu-consumer/links.ts'
import { allLocations, brandOf, locationPage, survey, unreachable } from '../../shared.ts'

/** Links that announce hours: opening hours, holidays, Christmas, Easter, summer or winter hours. */
export const NOTICE =
  /otv[aá]rac\S* hodin|otv[aá]racie|sviat|vianoc|velk\S* noc|veľk\S* noc|nov\S* rok|silvest|leto|letn|zimn|opening hours|holiday|christmas|easter|new year|summer hours|winter hours|öffnungszeit|feiertag|weihnacht|opnunartí|jól|páskir|hodiny|hours/
const MAX_LOCATION_PAGES = 3
const MAX_NOTICES = 2

/** The home page, the contact page, a few location pages, and the notices about hours the home page links. */
export async function pagesFor(ctx: Context) {
  const found = await survey(ctx)
  if (!found) return undefined
  const brand = brandOf(ctx)
  const urls = [found.home.final, ...(found.contact ? [found.contact.final] : [])]
  for (const place of allLocations(found, brand)) {
    if (urls.length >= 2 + MAX_LOCATION_PAGES) break
    const { page } = await locationPage(place, found, brand)
    if (page && !urls.includes(page.final)) urls.push(page.final)
  }
  const host = hostOf(found.home.final)
  const notices = found.links.filter(link => hostOf(link.href) === host && (NOTICE.test(link.text) || NOTICE.test(pathOf(link.href))))
  for (const link of notices) {
    if (urls.length >= 2 + MAX_LOCATION_PAGES + MAX_NOTICES) break
    if (!urls.includes(link.href)) urls.push(link.href)
  }
  return urls
}

export default async function hoursCurrent(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const pages = await pagesFor(ctx)
  if (!pages) return unreachable(ctx)
  const today = new Date().toISOString().slice(0, 10)
  return askAbout(ctx, pages, `Today is ${today}.`)
}
