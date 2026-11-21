import type { Context } from '../../../../core/checks/context.ts'
import { crawl, pathOf } from '../../../../core/crawl.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { langOf, legalLinks, linksOf, PRIVACY, PRIVACY_HREF, statusOf } from '../../links.ts'

const SHOWN = 4

/** Every sampled page links to a privacy policy named in its own language, and the policy answers 200. */
export default async function privacyPolicy({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  // the same sample as the crawl items, so one crawl serves them all
  const pages = await crawl(asset.url)
  const home = pages[0]
  if (!home || home.status === 0) return { state: 'error', evidence: `${asset.url} did not respond${home?.error ? ` (${home.error})` : ''}` }
  if (home.status >= 400) return { state: 'error', evidence: `${home.url} answered ${home.status}` }

  const failures: string[] = []
  const policies = new Map<string, string[]>()
  const read = pages.filter(page => page.status === 200 && page.html)
  for (const page of read) {
    const lang = langOf(page.html)
    const { named, also } = legalLinks(await linksOf(page.html, page.final), PRIVACY, PRIVACY_HREF, lang)
    if (named.length > 0) {
      for (const link of named) policies.set(link.href, [...(policies.get(link.href) ?? []), page.url])
      continue
    }
    const elsewhere = also[0] ? `; it links "${also[0].text}", not in ${lang}` : ''
    failures.push(`${pathOf(page.url)} links no privacy policy${lang ? ` in its language (${lang})` : ''}${elsewhere}`)
  }

  // one policy that answers is enough for a page that links several (a policy and a social-media notice)
  const statuses = new Map(await Promise.all([...policies.keys()].map(async url => [url, await statusOf(url)] as const)))
  for (const page of read) {
    const linked = [...policies].filter(([, from]) => from.includes(page.url)).map(([url]) => url)
    if (linked.length === 0 || linked.some(url => statuses.get(url) === 200)) continue
    failures.push(`${pathOf(page.url)}: its privacy policy ${linked.map(url => `${pathOf(url)} answered ${statuses.get(url) || 'nothing'}`).join(', ')}`)
  }

  if (failures.length === 0) {
    const shown = [...policies.keys()].slice(0, 2).map(pathOf).join(', ')
    return { state: 'pass', evidence: `${read.length} pages link a privacy policy that answers 200 (${shown})` }
  }
  const more = failures.length > SHOWN ? `; and ${failures.length - SHOWN} more` : ''
  return { state: 'fail', evidence: `${failures.slice(0, SHOWN).join('; ')}${more} (${read.length} pages checked)` }
}
