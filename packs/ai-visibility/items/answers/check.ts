import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { statusOf } from '../../../eu-consumer/links.ts'
import { askAbout, findPages } from '../../pages.ts'

/** Where a site answers its customers' questions: the home page, the FAQ, the (rental) terms and the pricing page. */
export async function pagesFor(url: string) {
  const found = await findPages(url)
  if (!found) return undefined
  const urls = [...new Set([found.home, found.faq, found.terms, found.pricing].filter((page): page is string => Boolean(page)))]
  const statuses = await Promise.all(urls.map(statusOf))
  return urls.filter((_, i) => statuses[i] === 200)
}

export default async function answers(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const pages = await pagesFor(ctx.asset.url)
  if (!pages) return { state: 'error', evidence: `${ctx.asset.url} did not answer 200` }
  return askAbout(ctx, pages)
}
