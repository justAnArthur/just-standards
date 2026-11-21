// What the rental items share: the home page and its links, read once, and the fleet pages found from them and the sitemap.
import type { Context } from '../../core/checks/context.ts'
import { sitemapOf, sitemapPages, spread } from '../../core/crawl.ts'
import { local } from '../../core/expect.ts'
import { hostOf, linksOf, pathOf, type Link } from '../eu-consumer/links.ts'
import { page, type Page } from '../local-business/shared.ts'

export interface Home {
  page: Page
  links: Link[]
  /** the links on the site's own host */
  own: Link[]
}

/** The home page (after redirects) and its links; undefined when it doesn't answer 200 with HTML. */
export async function homeOf(ctx: Context): Promise<Home | undefined> {
  if (!ctx.asset.url) return undefined
  const home = await page(ctx.asset.url)
  if (home.status !== 200 || !home.html) return undefined
  const links = await linksOf(home.html, home.final)
  const host = hostOf(home.final)
  return { page: home, links, own: links.filter(link => hostOf(local(link.href)) === host) }
}

/** The fleet's index page, by its link text or path. */
export const FLEET =
  /vozov\S* park|\bfleet\b|flotil|na[sš]e aut|na[sš]e vozidl|ponuka (á|a)ut|our (cars|vehicles|fleet)|\bvehicles\b|\bcars\b|fahrzeuge|unsere autos|bilar|bílar|\bbiler\b|vozový park|autá|dodávky/i
export const FLEET_PATH = /\/(fleet|vozovy-park|flotila|flotta|flotte|vehicles?|cars|auta|autos|fahrzeuge|vozidla|bilar|biler|modely|models)\/?$/i
/** A vehicle's own page: one segment under a fleet path. */
export const VEHICLE_PATH = /\/(fleet|vozovy-park|flotila|flotta|flotte|vehicles?|cars|auta|autos|fahrzeuge|vozidla|bilar|biler|modely|models)\/[^/]+\/?$/i
/** Paths under a fleet path that list rather than show one vehicle. */
const NOT_A_VEHICLE = /\/(page|strana|kategoria|category|filter|tag)[-/]?\d*\/?$|[?&]/i

export const MAX_VEHICLES = 6

/** The fleet's index page and up to `MAX_VEHICLES` vehicle pages, spread over what the home page, the index and the sitemap link. */
export async function fleetPages(home: Home) {
  const host = hostOf(home.page.final)
  const index = home.own.find(link => FLEET_PATH.test(pathOf(link.href)))?.href ?? home.own.find(link => FLEET.test(link.text))?.href
  const indexPage = index ? await page(index) : undefined
  const indexLinks = indexPage?.html ? await linksOf(indexPage.html, indexPage.final) : []
  // on a preview, the sitemap names production URLs: they are read from the preview
  const sitemap = ((await sitemapPages(await sitemapOf(home.page.final)).catch(() => undefined)) ?? []).map(local)
  const urls = [...home.own.map(link => link.href), ...indexLinks.map(link => link.href), ...sitemap]
  const vehicles = [
    ...new Set(
      urls.filter(url => {
        try {
          return hostOf(url) === host && VEHICLE_PATH.test(pathOf(url)) && !NOT_A_VEHICLE.test(url) && !FLEET_PATH.test(pathOf(url))
        } catch {
          return false
        }
      }),
    ),
  ]
  // the same car under two spellings of its path (`/fleet/kia-ceed-SW` and `/fleet/kia-ceed-sw`) is one
  const distinct = vehicles.filter((url, i) => vehicles.findIndex(other => other.toLowerCase() === url.toLowerCase()) === i)
  return { index: indexPage?.status === 200 ? indexPage : undefined, indexUrl: index, vehicles: spread(distinct.sort(), MAX_VEHICLES), total: distinct.length }
}
