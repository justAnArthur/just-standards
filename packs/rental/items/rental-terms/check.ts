import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { FAQ } from '../../../ai-visibility/pages.ts'
import { askAbout, pick, statusOf } from '../../../eu-consumer/links.ts'
import { unreachable } from '../../../local-business/shared.ts'
import { homeOf } from '../../shared.ts'

/** Where rental terms live, in the order they are read: the rental conditions, the FAQ, the general terms, the fees, the cover. */
export const WHERE: RegExp[] = [
  /podmien\S* prenájm|podmienky prenajmu|prehľad podmienok|rental (terms|conditions)|terms and conditions|conditions of (hire|rental)|rental conditions|mietbedingung|leigutreyt|lejebetingelser|hyrevillkor/,
  FAQ,
  /obchodn\S* podmien|obchodne-podmienky|\bvop\b|\bagb\b|\bterms\b|treyt|vilkår|betingelser/,
  /poplatk|\bfees\b|charges|cenník|extras|gebühren/,
  /poisten|insurance|\bcover\b|cover-options|krytie|spoluúčas|excess|versicherung|trygging/,
]
const MAX_PAGES = 4

/** The terms, FAQ, fees and cover pages the home page links on its own site, those that answer 200, at most four. */
export async function pagesFor(ctx: Context) {
  const home = await homeOf(ctx)
  if (!home) return undefined
  const host = new URL(home.page.final).hostname.replace(/^www\./, '')
  const urls: string[] = []
  for (const pattern of WHERE) {
    const url = pick(home.own, [pattern], host)
    if (url && !urls.includes(url)) urls.push(url)
  }
  const statuses = await Promise.all(urls.map(statusOf))
  return urls.filter((_, i) => statuses[i] === 200).slice(0, MAX_PAGES)
}

export default async function rentalTerms(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const pages = await pagesFor(ctx)
  if (!pages) return unreachable(ctx)
  if (pages.length === 0) return { state: 'fail', evidence: 'the home page links no rental terms, FAQ, fees or insurance page that answers 200' }
  return askAbout(ctx, pages)
}
