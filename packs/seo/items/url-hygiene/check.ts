import type { Context } from '../../../../core/checks/context.ts'
import { pathOf, sitemapOf, sitemapPages } from '../../../../core/crawl.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages } from '../../shared.ts'

const SHOWN = 3

const decoded = (path: string) => {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

const examples = (urls: string[]) => `${urls.slice(0, SHOWN).map(pathOf).join(', ')}${urls.length > SHOWN ? ` and ${urls.length - SHOWN} more` : ''}`

/** One page however it's spelled: no `www.`, no case, no query, no trailing slash. */
const key = (url: URL) => `${url.hostname.replace(/^www\./, '')}${decoded(url.pathname).toLowerCase().replace(/\/$/, '')}`

export default async function urlHygiene(ctx: Context): Promise<Outcome> {
  const { asset } = ctx
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  // A site that doesn't answer has no sitemap to judge: the shared crawl tells.
  const reachable = await htmlPages(ctx)
  if (!Array.isArray(reachable)) return reachable
  const sitemap = await sitemapOf(asset.url)
  const listed = await sitemapPages(sitemap)
  if (!listed) return { state: 'fail', evidence: `no sitemap at ${sitemap}` }
  if (listed.length === 0) return { state: 'fail', evidence: `${sitemap} lists no URLs` }

  const urls = listed.flatMap(href => {
    try {
      return [new URL(href)]
    } catch {
      return []
    }
  })
  const root = new URL(asset.url).pathname.replace(/\/?$/, '/')
  const problems: string[] = []

  const invalid = listed.length - urls.length
  if (invalid > 0) problems.push(`${invalid} entries aren't URLs`)

  const origins = new Map<string, number>()
  for (const url of urls) origins.set(url.origin, (origins.get(url.origin) ?? 0) + 1)
  if (origins.size > 1) problems.push(`URLs on ${origins.size} origins: ${[...origins].map(([origin, n]) => `${origin} (${n})`).join(', ')}`)

  // Uppercase in the path, not in a percent escape: %C3%A1 is how á is spelled.
  const upper = urls.filter(url => /\p{Lu}/u.test(decoded(url.pathname)))
  if (upper.length) problems.push(`${upper.length} with uppercase letters: ${examples(upper.map(u => u.href))}`)

  const query = urls.filter(url => url.search || url.hash)
  if (query.length) problems.push(`${query.length} with a query string or fragment: ${examples(query.map(u => u.href))}`)

  // Only pages count: the root always ends in /, and a file (`/terms.pdf`) never does.
  const pages = urls.filter(url => url.pathname.replace(/\/?$/, '/') !== root && url.pathname !== '/' && !/\.[a-z0-9]{2,5}$/i.test(url.pathname))
  const slashed = pages.filter(url => url.pathname.endsWith('/'))
  const bare = pages.filter(url => !url.pathname.endsWith('/'))
  if (slashed.length && bare.length) {
    const [fewer, more] = slashed.length < bare.length ? [slashed, bare] : [bare, slashed]
    const style = fewer === slashed ? 'end in /' : "don't end in /"
    problems.push(`two trailing-slash styles: ${fewer.length} ${style} against ${more.length} (${examples(fewer.map(u => u.href))})`)
  }

  const spellings = new Map<string, Set<string>>()
  for (const url of urls) spellings.set(key(url), (spellings.get(key(url)) ?? new Set()).add(url.href))
  const twice = new Map<string, number>()
  for (const href of listed) twice.set(href, (twice.get(href) ?? 0) + 1)
  const repeated = [...twice].filter(([, n]) => n > 1).map(([href]) => href)
  if (repeated.length) problems.push(`${repeated.length} listed more than once: ${examples(repeated)}`)
  const variants = [...spellings.values()].filter(set => set.size > 1).map(set => [...set].map(pathOf).join(' and '))
  if (variants.length) problems.push(`pages listed under several spellings: ${variants.slice(0, SHOWN).join('; ')}`)

  if (problems.length > 0) return { state: 'fail', evidence: `${sitemap}: ${problems.join('; ')} (${urls.length} URLs)` }
  const style = slashed.length ? 'all ending in /' : 'none ending in /'
  return { state: 'pass', evidence: `${sitemap}: ${urls.length} URLs, lowercase, no query strings, ${pages.length ? style : 'one style'}, no duplicates` }
}
