import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { answering, askAbout, legalPages } from '../../links.ts'

/** The pages where an operator states who it is: the home page's footer, the contact page, an imprint or about page, and the terms. */
export async function pagesFor(url: string) {
  const found = await legalPages(url)
  return found && answering(found, ['contact', 'imprint', 'terms'])
}

export default async function companyIdentity(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const pages = await pagesFor(ctx.asset.url)
  if (!pages) return { state: 'error', evidence: `${ctx.asset.url} did not answer 200` }
  return askAbout(ctx, pages)
}
