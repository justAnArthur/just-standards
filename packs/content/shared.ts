// What the content items share: the crawl, a page's visible text, and short evidence lists.
import type { Context } from '../../core/checks/context.ts'
import { crawl, pathOf, type Page } from '../../core/crawl.ts'
import { decode } from '../../core/html.ts'
import type { Outcome } from '../../core/schema.ts'
import { challenged } from '../firewall.ts'

/** The crawl's page count: the same as the seo items', so the site is crawled once. */
export const PAGES = 20

/** The crawled pages that answered with HTML, or the outcome to return when the site can't be read. */
export async function htmlPages({ asset }: Context): Promise<Page[] | Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const pages = await crawl(asset.url, PAGES)
  const home = pages[0]
  if (!home || home.status === 0) return { state: 'error', evidence: `${asset.url} did not respond${home?.error ? ` (${home.error})` : ''}` }
  // a challenge mid-crawl leaves pages unread: a pass over the rest would claim more than was seen
  const blocked = pages.find(page => challenged(page))
  if (blocked) return { state: 'error', evidence: `${pathOf(blocked.url)}: ${challenged(blocked)}` }
  if (home.status >= 400) return { state: 'error', evidence: `${home.url} answered ${home.status}` }
  return pages.filter(page => page.status < 400 && page.html)
}

/** What a reader never sees as text. Code samples are left out too: `{name}` there is code, not a leftover. */
const HIDDEN = 'script, style, template, noscript, svg, code, pre, textarea, head'

/**
 * The page's text nodes as served, decoded and with whitespace collapsed, empty ones dropped. React's `<!-- -->` markers
 * split an expression's output into its own node, so `{price}` rendering "NaN" is a node of its own.
 */
export async function textNodes(html: string, root = 'body'): Promise<string[]> {
  const nodes: string[] = []
  let current = ''
  let hidden = 0
  await new HTMLRewriter()
    .on(HIDDEN, {
      element(element) {
        if (element.selfClosing || !element.canHaveContent) return
        hidden++
        element.onEndTag(() => void hidden--)
      },
    })
    .on(root, {
      text(chunk) {
        if (hidden === 0) current += chunk.text
        if (chunk.lastInTextNode) {
          const text = decode(current).replace(/\s+/g, ' ').trim()
          if (text) nodes.push(text)
          current = ''
        }
      },
    })
    .transform(new Response(html))
    .text()
  return nodes
}

/** "first; second; third; and 4 more", for evidence */
export function some(list: string[], shown = 5, separator = '; ') {
  const more = list.length > shown ? `${separator}and ${list.length - shown} more` : ''
  return `${list.slice(0, shown).join(separator)}${more}`
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

export const quote = (text: string, max = 60) => `"${text.length > max ? `${text.slice(0, max - 1)}…` : text}"`
