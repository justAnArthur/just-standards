import type { Context } from '../../../../core/checks/context.ts'
import { hostOf, pathOf, spread } from '../../../../core/crawl.ts'
import { get } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages, pool, some } from '../../shared.ts'

const CHECKED = 100
const CONCURRENCY = 6
/** One redirect (a trailing slash, an old path) is fine; a chain is not. */
const MAX_HOPS = 1
const LOOP = 6

interface Probe {
  url: string
  status: number
  hops: string[]
}

/** HEAD, and GET when HEAD answers an error: some servers don't implement HEAD, or answer it differently. */
async function request(url: string) {
  try {
    const head = await get(url, { method: 'HEAD', redirect: 'manual' })
    if (head.status < 400) return head
  } catch {}
  try {
    const response = await get(url, { redirect: 'manual' })
    await response.body?.cancel()
    return response
  } catch {
    return undefined
  }
}

/** Follows the redirects by hand, to count them. */
async function probe(url: string): Promise<Probe> {
  const hops: string[] = []
  let current = url
  for (;;) {
    const response = await request(current)
    if (!response) return { url, status: 0, hops }
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location || hops.length >= LOOP) return { url, status: response.status, hops }
    current = new URL(location, current).href
    hops.push(current)
  }
}

/** Same-host links of a page, absolute and without their fragment. */
async function linksOf(html: string, base: string, host: string) {
  const anchors = await select(html, 'a[href]')
  return anchors.flatMap(anchor => {
    const href = anchor.attrs.href?.trim() ?? ''
    if (!href || href.startsWith('#') || /^(mailto|tel|sms|javascript|data):/i.test(href)) return []
    try {
      const url = new URL(href, base)
      url.hash = ''
      if (!/^https?:$/.test(url.protocol) || hostOf(url.href) !== host) return []
      // Cloudflare's email obfuscation: a script turns it back into a mailto
      if (url.pathname.startsWith('/cdn-cgi/l/email-protection')) return []
      return [url.href]
    } catch {
      return []
    }
  })
}

export default async function internalLinks(ctx: Context): Promise<Outcome> {
  const pages = await htmlPages(ctx)
  if (!Array.isArray(pages)) return pages
  const host = hostOf(ctx.asset.url as string)

  const from = new Map<string, string>()
  for (const page of pages) {
    for (const link of await linksOf(page.html, page.final, host)) if (!from.has(link)) from.set(link, pathOf(page.url))
  }
  if (from.size === 0) return { state: 'pass', evidence: `no internal links on ${pages.length} pages` }

  const checked = spread([...from.keys()], CHECKED)
  const probes = await pool(checked, CONCURRENCY, probe)
  const limited = probes.filter(p => p.status === 429)
  // a path on the asset's own origin, else the whole URL: http:// and the other host are part of the story
  const origin = new URL(ctx.asset.url as string).origin
  const shown = (url: string) => (new URL(url).origin === origin ? pathOf(url) : url)
  const problems = probes.flatMap(({ url, status, hops }) => {
    const source = `(on ${from.get(url)})`
    if (status === 0) return [`${shown(url)} didn't answer ${source}`]
    if (status >= 400 && status !== 429) return [`${shown(url)} → ${status}${hops.length ? ` after ${hops.length} redirects` : ''} ${source}`]
    if (hops.length >= LOOP) return [`${shown(url)} redirects in a loop ${source}`]
    if (hops.length > MAX_HOPS) return [`${shown(url)} → ${hops.map(shown).join(' → ')}: ${hops.length} redirects ${source}`]
    return []
  })

  const sample = `${checked.length} of ${from.size} internal links on ${pages.length} pages checked${limited.length ? `, ${limited.length} rate-limited (429) and not judged` : ''}`
  if (problems.length > 0) return { state: 'fail', evidence: `${some(problems)} (${sample})` }
  return { state: 'pass', evidence: `no 4xx/5xx, no redirect chains (${sample})` }
}
