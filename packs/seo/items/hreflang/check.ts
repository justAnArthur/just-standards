import type { Context } from '../../../../core/checks/context.ts'
import { pathOf, type Page } from '../../../../core/crawl.ts'
import { get, sameUrl } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages, pool, some } from '../../shared.ts'

/** How many alternate URLs are fetched to check they answer 200 and link back. */
const FETCHED = 40
const CONCURRENCY = 6

/** An ISO 639 language, optionally a script and an ISO 3166 region (or UN M.49 area): `sk`, `en-GB`, `zh-Hant-TW`, `es-419`. */
const CODE = /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?$/i

interface Alternate {
  code: string
  href: string
}

interface Fetched {
  status: number
  lang?: string
  alternates: Alternate[]
}

async function alternatesOf(html: string, base: string): Promise<Alternate[]> {
  const links = await select(html, 'link[rel="alternate"][hreflang]')
  return links.flatMap(link => {
    const href = link.attrs.href?.trim()
    if (!href) return []
    try {
      return [{ code: (link.attrs.hreflang ?? '').trim(), href: new URL(href, base).href }]
    } catch {
      return []
    }
  })
}

const langOf = async (html: string) => (await select(html, 'html'))[0]?.attrs.lang?.trim()
const primary = (code: string | undefined) => code?.split(/[-_]/)[0]?.toLowerCase()

function codeProblem(code: string) {
  if (code.toLowerCase() === 'x-default') return undefined
  if (code.includes('_')) return `"${code}" uses _ (write ${code.replace('_', '-')})`
  if (!CODE.test(code)) return `"${code}" is not a language code`
  if (/-uk$/i.test(code)) return `"${code}": the United Kingdom is GB`
}

/** The alternate exactly as linked: a redirect is not a 200, and its page is read for the way back. */
async function fetchAlternate(url: string): Promise<Fetched> {
  try {
    const response = await get(url, { redirect: 'manual' })
    if (response.status !== 200 || !/html/.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel()
      return { status: response.status, alternates: [] }
    }
    const html = await response.text()
    return { status: 200, lang: await langOf(html), alternates: await alternatesOf(html, url) }
  } catch {
    return { status: 0, alternates: [] }
  }
}

export default async function hreflang(ctx: Context): Promise<Outcome> {
  const pages = await htmlPages(ctx)
  if (!Array.isArray(pages)) return pages

  const linked = new Map<Page, Alternate[]>()
  for (const page of pages) {
    const alternates = await alternatesOf(page.html, page.final)
    if (alternates.length > 0) linked.set(page, alternates)
  }
  if (linked.size === 0) return { state: 'pass', evidence: `no page carries hreflang alternates: a single-language site (${pages.length} pages)` }

  const problems: string[] = []
  const targets = new Set<string>()
  for (const [page, alternates] of linked) {
    const path = pathOf(page.url)
    for (const problem of new Set(alternates.map(a => codeProblem(a.code)).filter(Boolean))) problems.push(`${path}: hreflang ${problem}`)
    if (!alternates.some(a => a.code.toLowerCase() === 'x-default')) problems.push(`${path}: no x-default`)
    const byCode = new Map<string, string>()
    for (const { code, href } of alternates) {
      const first = byCode.get(code.toLowerCase())
      if (first && !sameUrl(first, href)) problems.push(`${path}: hreflang ${code} names both ${first} and ${href}`)
      byCode.set(code.toLowerCase(), href)
    }
    const self = alternates.find(a => a.code.toLowerCase() !== 'x-default' && sameUrl(a.href, page.final))
    if (!self) problems.push(`${path}: its alternates don't include the page itself`)
    const lang = await langOf(page.html)
    if (self && lang && primary(lang) !== primary(self.code)) problems.push(`${path}: lists itself as ${self.code} but <html lang="${lang}">`)
    for (const { href } of alternates) if (!sameUrl(href, page.final)) targets.add(href)
  }

  const fetchedUrls = [...targets].slice(0, FETCHED)
  const fetched = new Map(fetchedUrls.map((url, i) => [url, i]))
  const answers = await pool(fetchedUrls, CONCURRENCY, fetchAlternate)
  for (const [page, alternates] of linked) {
    const path = pathOf(page.url)
    for (const { code, href } of alternates) {
      const index = fetched.get(href)
      if (index === undefined) continue
      const answer = answers[index] as Fetched
      if (answer.status !== 200) {
        problems.push(`${path}: hreflang ${code} → ${href} answered ${answer.status || 'nothing'}`)
        continue
      }
      if (code.toLowerCase() === 'x-default') continue
      if (!answer.alternates.some(back => sameUrl(back.href, page.final) || sameUrl(back.href, page.url))) {
        problems.push(`${path}: hreflang ${code} → ${pathOf(href)}, which doesn't link back`)
      }
      if (answer.lang && primary(answer.lang) !== primary(code)) problems.push(`${path}: hreflang ${code} → ${pathOf(href)}, a page in <html lang="${answer.lang}">`)
    }
  }

  const skipped = targets.size - fetchedUrls.length
  const sample = `${linked.size} of ${pages.length} pages carry alternates; ${fetchedUrls.length} alternate URLs fetched${skipped > 0 ? ` (${skipped} more not, the sample limit)` : ''}`
  // by page, in crawl order
  const order = [...linked.keys()].map(page => pathOf(page.url))
  const byPage = [...new Set(problems)].sort((a, b) => order.indexOf(a.split(':')[0] as string) - order.indexOf(b.split(':')[0] as string))
  if (problems.length > 0) return { state: 'fail', evidence: `${some(byPage, 8)} (${sample})` }
  const codes = [...new Set([...linked.values()].flat().map(a => a.code))].join(', ')
  return { state: 'pass', evidence: `${codes}: valid, with x-default, reciprocal, every alternate answers 200 (${sample})` }
}
