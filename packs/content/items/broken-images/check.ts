import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import { get } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'
import { htmlPages, pool, some } from '../../shared.ts'

/** Distinct image URLs fetched across the sampled pages. */
const LIMIT = 120
// image optimizers are slow and rate limited: a burst reads as an attack
const CONCURRENCY = 4

/** The first URL of a srcset: one width stands for the rest, which come from the same source. */
const firstOfSrcset = (srcset: string) => srcset.split(',')[0]?.trim().split(/\s+/)[0]

/** The images a page loads: each `img` (its `src`, else its first `srcset` candidate) and each `picture > source`. */
export async function imagesOf(html: string, base: string) {
  const urls: string[] = []
  const add = (value: string | undefined) => {
    const raw = value?.trim()
    if (!raw || /^(data|blob|about|javascript):/i.test(raw)) return
    try {
      const url = new URL(raw, base)
      url.hash = ''
      if (/^https?:$/.test(url.protocol)) urls.push(url.href)
    } catch {
      urls.push(raw)
    }
  }
  for (const img of await select(html, 'img')) add(img.attrs.src || firstOfSrcset(img.attrs.srcset ?? ''))
  for (const source of await select(html, 'picture source')) add(firstOfSrcset(source.attrs.srcset ?? '') || source.attrs.src)
  return [...new Set(urls)]
}

/** An image URL for evidence: an optimizer's (`/_next/image?url=…`) by the source it resizes, and short. */
export function shown(url: string) {
  let text = url
  try {
    const parsed = new URL(url)
    const source = parsed.pathname.endsWith('/_next/image') ? parsed.searchParams.get('url') : null
    if (source) text = `${source} (through /_next/image)`
  } catch {}
  return text.length > 120 ? `${text.slice(0, 119)}…` : text
}

/** What's wrong with an image URL's answer, or undefined; `blocked` when the host's firewall answered instead. */
async function problemOf(url: string): Promise<string | { blocked: string } | undefined> {
  if (!/^https?:\/\//.test(url)) return `"${url}" is not a URL`
  try {
    const response = await get(url)
    await response.body?.cancel()
    const blocked = challenged(response)
    if (blocked) return { blocked }
    const type = response.headers.get('content-type') ?? ''
    if (response.status !== 200) return `answered ${response.status}`
    if (!/^image\//i.test(type)) return `is ${type || 'untyped'}, not an image`
  } catch (error) {
    return `did not respond (${(error as Error).message})`
  }
}

/** Every image on the sampled pages answers 200 with an image content type. */
export default async function brokenImages(ctx: Context): Promise<Outcome> {
  const pages = await htmlPages(ctx)
  if (!Array.isArray(pages)) return pages
  const firstSeen = new Map<string, string>()
  for (const page of pages) {
    for (const url of await imagesOf(page.html, page.final)) if (!firstSeen.has(url)) firstSeen.set(url, pathOf(page.url))
  }
  const urls = [...firstSeen.keys()].slice(0, LIMIT)
  if (urls.length === 0) return { state: 'pass', evidence: `no images on ${pages.length} pages` }
  const problems = await pool(urls, CONCURRENCY, problemOf)
  const blocked = problems.findIndex(problem => typeof problem === 'object')
  if (blocked >= 0) return { state: 'error', evidence: `${urls[blocked]}: ${(problems[blocked] as { blocked: string }).blocked}` }
  // one source resized to several widths is one broken image
  const broken = [...new Set(urls.flatMap((url, i) => (problems[i] ? [`${shown(url)} ${problems[i]} (on ${firstSeen.get(url)})`] : [])))]
  const skipped = firstSeen.size - urls.length
  const sample = `${urls.length} images on ${pages.length} pages${skipped > 0 ? `; ${skipped} more not fetched, the sample limit` : ''}`
  if (broken.length === 0) return { state: 'pass', evidence: `every image answers 200 as an image (${sample})` }
  return { state: 'fail', evidence: `${broken.length} broken: ${some(broken)} (${sample})` }
}
