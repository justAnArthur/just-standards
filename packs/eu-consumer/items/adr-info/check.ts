import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { answering, askAbout, htmlOf, legalPages, pathOf } from '../../links.ts'

/** A link to the EU ODR platform, which closed on 20 July 2025 (Regulation (EU) 2024/3228 repealed Regulation 524/2013). */
export const ODR = /(?:webgate\.)?ec\.europa\.eu\/(?:consumers\/)?odr\b/i

/** Where ADR information lives: the terms, the complaints procedure and the home page's footer. */
export async function pagesFor(url: string) {
  const found = await legalPages(url)
  return found && answering(found, ['terms', 'complaints'])
}

/** The pages that still link the closed ODR platform. */
export async function odrLinks(pages: string[]) {
  const html = await Promise.all(pages.map(htmlOf))
  return pages.filter((_, i) => ODR.test(html[i]?.html ?? ''))
}

export default async function adrInfo(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const pages = await pagesFor(ctx.asset.url)
  if (!pages) return { state: 'error', evidence: `${ctx.asset.url} did not answer 200` }
  const [outcome, stale] = await Promise.all([askAbout(ctx, pages), odrLinks(pages)])
  if (stale.length === 0 || outcome.state === 'error') return outcome
  const where = stale.map(url => pathOf(url)).join(', ')
  return { state: 'fail', evidence: `${where} still link the EU ODR platform, closed since 20 July 2025; ${outcome.evidence}` }
}
