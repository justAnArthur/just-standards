import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages, quote, some, textNodes } from '../../shared.ts'

interface Rule {
  what: string
  /** tested on each visible text node */
  test: (node: string) => RegExpMatchArray | null | undefined
}

/** Leftovers in visible text. Case matters for the code values: "Null" in prose is a word, `null` rendered is a bug. */
export const RULES: Rule[] = [
  { what: 'filler text', test: node => node.match(/\blorem ipsum\b|\bdolor sit amet\b/i) },
  { what: 'a to-do', test: node => node.match(/\b(TODO|FIXME|TBD|XXX)\b(?=\s*[:\-–(]|$)/) },
  { what: 'an unfilled template', test: node => node.match(/\{\{[^{}]{0,60}\}\}|\$\{[^{}]{1,60}\}|\{(?:[a-z][\w.]*|[A-Z_]{3,})\}|%(?:s|d)\b|\[\[[^\]]{1,40}\]\]/) },
  { what: 'a value rendered as text', test: node => node.match(/^(undefined|null|NaN|\[object Object\])$|\bundefined\b|\bNaN\b|\[object Object\]|(?:€|\$|£|EUR|Kč|DKK|kr\.?)\s?null\b|\bnull\s?(?:€|EUR|Kč|DKK|kr)/) },
  {
    what: 'an unfinished section',
    test: node =>
      node.length <= 80 ? node.match(/\bcoming soon\b|\bunder construction\b|\bvo výstavbe\b|\bpripravujeme\b|\bčoskoro (tu|k dispozícii)\b|\bkemur (skjótt|bráðum)\b|\bkommer snart\b|\bin bearbeitung\b|\bdemnächst\b/i) : null,
  },
]

/** URL attributes a broken expression leaves its mark in: `href="/cars/undefined"`. */
const BROKEN_URL = /(^|[/=?&])(undefined|null|NaN)([/?&#]|$)/

/** Every leftover on one page, as "what "quote"". */
export async function leftovers(html: string): Promise<string[]> {
  const found: string[] = []
  for (const node of await textNodes(html)) {
    for (const rule of RULES) {
      const match = rule.test(node)
      if (!match) continue
      const at = match.index ?? 0
      const around = node.length <= 60 ? node : node.slice(Math.max(0, at - 20), at + 40)
      found.push(`${rule.what} ${quote(around)}`)
    }
  }
  for (const element of await select(html, 'body a[href], body img[src]')) {
    const url = element.attrs.href ?? element.attrs.src ?? ''
    if (BROKEN_URL.test(url) && !/^(mailto|tel):/i.test(url)) found.push(`a URL built from a missing value ${quote(url)}`)
  }
  return [...new Set(found)]
}

/** No sampled page shows filler, to-dos, unfilled templates, code values as text, or "coming soon" sections. */
export default async function noPlaceholder(ctx: Context): Promise<Outcome> {
  const pages = await htmlPages(ctx)
  if (!Array.isArray(pages)) return pages
  const failures: string[] = []
  for (const page of pages) for (const leftover of await leftovers(page.html)) failures.push(`${pathOf(page.url)}: ${leftover}`)
  if (failures.length === 0) return { state: 'pass', evidence: `no placeholders on ${pages.length} pages (the home page and a sample of the sitemap)` }
  return { state: 'fail', evidence: `${some(failures)} (${pages.length} pages checked)` }
}
