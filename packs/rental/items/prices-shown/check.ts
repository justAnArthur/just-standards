import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { PRICING } from '../../../ai-visibility/pages.ts'
import { askAbout, pick, statusOf } from '../../../eu-consumer/links.ts'
import { unreachable } from '../../../local-business/shared.ts'
import { fleetPages, homeOf } from '../../shared.ts'

const FEES = /poplatk|\bfees\b|charges|extras|gebühren/

/** The home page, the fleet page, one vehicle page, and the pricing and fees pages it links: where prices are shown. */
export async function pagesFor(ctx: Context) {
  const home = await homeOf(ctx)
  if (!home) return undefined
  const host = new URL(home.page.final).hostname.replace(/^www\./, '')
  const fleet = await fleetPages(home)
  const urls = [home.page.final, fleet.index?.final, fleet.vehicles[0], pick(home.own, [PRICING], host), pick(home.own, [FEES], host)]
  const distinct = [...new Set(urls.filter((url): url is string => Boolean(url)))]
  const statuses = await Promise.all(distinct.map((url, i) => (i === 0 ? 200 : statusOf(url))))
  return distinct.filter((_, i) => statuses[i] === 200)
}

export default async function pricesShown(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const pages = await pagesFor(ctx)
  if (!pages) return unreachable(ctx)
  return askAbout(ctx, pages)
}
