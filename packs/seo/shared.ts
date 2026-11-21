import type { Context } from '../../core/checks/context.ts'
import { crawl, type Page } from '../../core/crawl.ts'
import type { Outcome } from '../../core/schema.ts'

/** The crawl's page count: the same as a `crawl` item's default, so every seo item reads one shared crawl. */
export const PAGES = 20

/** The crawled pages that answered with HTML, or the outcome to return when the site can't be read. */
export async function htmlPages({ asset }: Context): Promise<Page[] | Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const pages = await crawl(asset.url, PAGES)
  const home = pages[0]
  if (!home || home.status === 0) return { state: 'error', evidence: `${asset.url} did not respond${home?.error ? ` (${home.error})` : ''}` }
  // 401, 403 and 429 are a firewall turning the checker away: no page was read, so nothing can pass.
  if (home.status >= 500 || [401, 403, 429].includes(home.status)) return { state: 'error', evidence: `${home.url} answered ${home.status}` }
  return pages.filter(page => page.status < 400 && page.html)
}

/** `fn` over every item, at most `limit` at a time, results in order. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i] as T)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** A home page: the site's root, or a language's root under it (`/en`, `/de-at/`). */
export function isHome(url: string, base: string) {
  const root = new URL(base).pathname.replace(/\/?$/, '/')
  const path = new URL(url).pathname.replace(/\/?$/, '/')
  if (!path.startsWith(root)) return path === '/'
  return /^([a-z]{2}([-_][a-z]{2})?\/)?$/i.test(path.slice(root.length))
}

/** "first; second; third; and 4 more", for evidence */
export function some(list: string[], shown = 5, separator = '; ') {
  const more = list.length > shown ? `${separator}and ${list.length - shown} more` : ''
  return `${list.slice(0, shown).join(separator)}${more}`
}
