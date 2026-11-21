import { ai } from '../../../../core/checks/ai.ts'
import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import { get, sameUrl } from '../../../../core/expect.ts'
import { decode, select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'

/** Offer pages read besides the home page: the model reads every page whole, so few. */
const OFFERS = 3

/** Words a link to an offer, a campaign or a seasonal page goes by, in the sites' languages; matched on its text and path. */
const OFFER =
  /akci|aktualit|zľav|zlav|promo|offer|ponuk|kampa|deal|\bsale\b|special|discount|kupón|kupon|voucher|black.?friday|cyber.?monday|vianoc|christmas|xmas|velk\S*noc|easter|letn|summer|zimn|winter|jesen|autumn|tilbo|avsl|rabat|angebot/i
/** Not offers: articles dated by nature, and the legal pages. */
const NOT_OFFER = /blog|novinky-z|magaz|clan|člán|podmien|terms|privacy|cookie|gdpr/i

const decoded = (path: string) => {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** The home page's links to offer pages on its own host, in document order, at most `OFFERS`. */
export async function offerPages(html: string, home: string) {
  const host = new URL(home).host
  const found: string[] = []
  for (const link of await select(html, 'a[href]')) {
    let url: URL
    try {
      url = new URL(link.attrs.href as string, home)
    } catch {
      continue
    }
    url.hash = ''
    const path = decoded(url.pathname)
    const text = decode(link.text).replace(/\s+/g, ' ')
    if (url.host !== host || sameUrl(url.href, home) || NOT_OFFER.test(path)) continue
    if (!OFFER.test(path) && !OFFER.test(text)) continue
    if (!found.some(seen => sameUrl(seen, url.href))) found.push(url.href)
    if (found.length === OFFERS) break
  }
  return found
}

/** An AI reads the home page and the offer pages it links, told today's date: nothing expired is presented as current. */
export default async function promoFreshness(ctx: Context, now = new Date()): Promise<Outcome> {
  const { asset } = ctx
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let response: Response
  try {
    response = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  if (response.status !== 200) return { state: 'error', evidence: challenged(response) ?? `${asset.url} answered ${response.status}` }
  const home = response.url || asset.url
  const pages = [home, ...(await offerPages(await response.text(), home))]

  const today = now.toISOString().slice(0, 10)
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  const prompt = (await Bun.file(`${ctx.item.dir}/prompt.md`).text()).trim().replaceAll('{today}', `${weekday} ${today}`)
  const outcome = await ai({ kind: 'ai', model: 'haiku', prompt, pages }, ctx)
  return { ...outcome, evidence: `${outcome.evidence} (read ${pages.map(pathOf).join(', ')})` }
}
