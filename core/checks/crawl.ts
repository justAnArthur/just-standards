import { crawl, pathOf } from '../crawl.ts'
import { select } from '../html.ts'
import type { Check, Outcome } from '../schema.ts'
import type { Context } from './context.ts'
import { expectOne } from './http.ts'

type CrawlCheck = Extract<Check, { kind: 'crawl' }>

const SHOWN = 5

/** What a `unique` expectation compares: the selected element's attribute or text, on each page. */
async function valuesOf(expect: Extract<CrawlCheck['expect'][number], { select: string }>, html: string) {
  const elements = await select(html, expect.select)
  return elements.map(element => (expect.attr ? element.attrs[expect.attr] : element.text).trim()).filter(Boolean)
}

export async function crawlCheck(check: CrawlCheck, { asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const pages = await crawl(asset.url, check.pages)
  const home = pages[0]
  if (!home || home.status === 0) return { state: 'error', evidence: `${asset.url} did not respond${home?.error ? ` (${home.error})` : ''}` }
  if (home.status >= 500) return { state: 'error', evidence: `${home.url} answered ${home.status}` }

  const failures: string[] = []
  const html = pages.filter(page => page.html)
  for (const page of pages) {
    if (page.status === 0 || page.status >= 400) {
      failures.push(`${pathOf(page.url)} answered ${page.status || `nothing (${page.error})`}`)
      continue
    }
    if (!page.html) continue
    for (const expect of check.expect) {
      const failure = await expectOne(expect, page, page.html, page.final)
      if (failure) failures.push(`${pathOf(page.url)}: ${failure.replace(` on ${page.final}`, '')}`)
    }
  }

  for (const expect of check.expect) {
    if (!('select' in expect) || !expect.unique) continue
    const seen = new Map<string, string>()
    for (const page of html) {
      for (const value of await valuesOf(expect, page.html)) {
        const first = seen.get(value)
        if (first && first !== page.url) failures.push(`${expect.select} "${value.slice(0, 60)}" on both ${pathOf(first)} and ${pathOf(page.url)}`)
        else seen.set(value, page.url)
      }
    }
  }

  if (failures.length === 0) return { state: 'pass', evidence: `${html.length} pages (the home page and a sample of the sitemap)` }
  const more = failures.length > SHOWN ? `; and ${failures.length - SHOWN} more` : ''
  return { state: 'fail', evidence: `${failures.slice(0, SHOWN).join('; ')}${more} (${html.length} pages checked)` }
}
