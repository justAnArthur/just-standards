import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlOf } from '../../../eu-consumer/links.ts'
import { askAbout, findPages, jsonLdSection } from '../../pages.ts'

/** The home page and the contact page it links, if any. */
export async function pagesFor(url: string) {
  const found = await findPages(url)
  if (!found) return undefined
  const contact = found.contact && found.contact !== found.home ? await htmlOf(found.contact) : undefined
  const pages = [{ url: found.home, html: found.html }, ...(contact && found.contact ? [{ url: found.contact, html: contact.html }] : [])]
  return { pages, contactFound: Boolean(found.contact) }
}

export default async function entityFacts(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const found = await pagesFor(ctx.asset.url)
  if (!found) return { state: 'error', evidence: `${ctx.asset.url} did not answer 200` }
  const outcome = await askAbout(ctx, found.pages.map(page => page.url), await jsonLdSection(found.pages))
  return found.contactFound ? outcome : { ...outcome, evidence: `${outcome.evidence}; the home page links no contact page` }
}
