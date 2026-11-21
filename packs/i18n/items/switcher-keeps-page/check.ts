import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import { sameUrl } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { alternatesOf, crawled, isOutcome, langOf, oneLanguage, primary, siteOf, switchTarget, type Site } from '../../locales.ts'

/** Inner pages whose switcher is read. */
const SAMPLE = 8
const SHOWN = 5

const isHome = (url: string, site: Site, base: string) => sameUrl(url, base) || site.locales.some(locale => sameUrl(locale.home, url))

/** Where one inner page's switcher goes wrong: a link to the other language's home where the page has (or may have) a counterpart. */
export async function problemsOf(page: { url: string; final: string; html: string }, site: Site, base: string) {
  const own = primary(await langOf(page.html))
  const alternates = await alternatesOf(page.html, page.final)
  const problems: string[] = []
  let links = 0
  for (const link of await select(page.html, 'a[href]')) {
    const target = switchTarget(link, page.final, base, site.locales.map(locale => locale.language))
    if (!target || primary(target.code) === own) continue
    links++
    const alternate = alternates.find(a => primary(a.code) === primary(target.code))
    // alternates that leave this language out say the page has no counterpart in it: home is the right place then
    if (alternates.length > 0 && !alternate) continue
    if (!isHome(target.href, site, base)) continue
    if (!alternate) problems.push(`${pathOf(page.url)}: the ${target.code} link goes to that language's home, ${pathOf(target.href)}`)
    else if (!isHome(alternate.href, site, base)) {
      problems.push(`${pathOf(page.url)}: the ${target.code} link goes to ${pathOf(target.href)}, not to ${pathOf(alternate.href)}, its hreflang ${alternate.code}`)
    }
  }
  return { links, problems }
}

/** On inner pages, the language switcher links to the same page in the other language, not to that language's home. */
export default async function switcherKeepsPage(ctx: Context): Promise<Outcome> {
  const site = await siteOf(ctx)
  if (isOutcome(site)) return site
  const single = oneLanguage(site)
  if (single) return single
  const base = ctx.asset.url as string
  const pages = await crawled(base)
  if (isOutcome(pages)) return pages
  const inner = pages.filter(page => !isHome(page.final, site, base)).slice(0, SAMPLE)
  const results = await Promise.all(inner.map(page => problemsOf(page, site, base)))
  const withSwitcher = results.filter(result => result.links > 0).length
  const problems = results.flatMap(result => result.problems)
  if (inner.length === 0) return { state: 'pass', evidence: 'no inner pages in the sitemap to read the switcher on' }
  if (withSwitcher === 0) return { state: 'pass', evidence: `no language switcher links in the HTML of ${inner.length} inner pages as served (a switcher built only in JavaScript isn't read)` }
  const more = problems.length > SHOWN ? `; and ${problems.length - SHOWN} more` : ''
  if (problems.length > 0) return { state: 'fail', evidence: `${problems.slice(0, SHOWN).join('; ')}${more} (${withSwitcher} of ${inner.length} inner pages have switcher links)` }
  return { state: 'pass', evidence: `the switcher keeps the page on ${withSwitcher} of ${inner.length} inner pages (the rest have no switcher links as served)` }
}
