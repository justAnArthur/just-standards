import type { Page } from 'playwright-core'
import type { Visit } from '../../../../core/browser.ts'
import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import type { Outcome } from '../../../../core/schema.ts'

declare const document: any, innerHeight: number, scrollTo: (x: number, y: number) => void

/** Smaller than this (CSS px²) is an icon or a logo, not a content image. */
const CONTENT_AREA = 100 * 100
/** Delivered at more than this many times the device pixels it is shown at, in both dimensions. */
const OVERSIZED = 2
const LEGACY = /^image\/(jpeg|jpg|png|gif|bmp)$/
const SCROLL_STEPS = 12
const SHOWN = 4

interface Shown {
  src: string
  naturalWidth: number
  naturalHeight: number
  width: number
  height: number
}

/** Scrolls through the page so lazy images load, then lists the loaded `<img>`s with their delivered and rendered sizes. */
export async function probe(page: Page): Promise<Shown[]> {
  for (let step = 1; step <= SCROLL_STEPS; step++) {
    const more = await page.evaluate(n => {
      scrollTo(0, innerHeight * n)
      return innerHeight * (n + 1) < document.documentElement.scrollHeight
    }, step)
    await page.waitForTimeout(200)
    if (!more) break
  }
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.evaluate(() => scrollTo(0, 0))
  return page.evaluate(() =>
    [...document.images]
      .filter((img: any) => img.complete && img.naturalWidth > 0 && /^https?:/.test(img.currentSrc || img.src))
      .map((img: any) => {
        const rect = img.getBoundingClientRect()
        return { src: img.currentSrc || img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, width: rect.width, height: rect.height }
      }),
  )
}

const short = (url: string) => {
  const path = pathOf(url)
  return path.length > 60 ? `…${path.slice(-57)}` : path
}

/** Every content image is served as AVIF or WebP (or SVG), and none is delivered at more than twice the pixels it fills. */
export default async function modernImages(visits: Visit[], _ctx: Context): Promise<Outcome> {
  const legacy: string[] = []
  const oversized: string[] = []
  let content = 0
  for (const visit of visits) {
    const mimes = new Map(visit.requests.map(request => [request.url, request.mime]))
    const seen = new Set<string>()
    for (const image of (visit.probe ?? []) as Shown[]) {
      if (image.width * image.height < CONTENT_AREA || seen.has(image.src)) continue
      seen.add(image.src)
      content++
      const mime = mimes.get(image.src) ?? ''
      if (LEGACY.test(mime)) legacy.push(`${short(image.src)} (${mime.slice(6)})`)
      const needW = image.width * visit.dpr
      const needH = image.height * visit.dpr
      if (image.naturalWidth > OVERSIZED * needW && image.naturalHeight > OVERSIZED * needH) {
        oversized.push(`${short(image.src)} ${image.naturalWidth}×${image.naturalHeight} shown at ${Math.round(needW)}×${Math.round(needH)} device px`)
      }
    }
  }
  const failures = [
    ...(legacy.length ? [`${legacy.length} of ${content} content images not AVIF/WebP: ${legacy.slice(0, SHOWN).join(', ')}${legacy.length > SHOWN ? '…' : ''}`] : []),
    ...(oversized.length ? [`${oversized.length} oversized: ${oversized.slice(0, SHOWN).join(', ')}${oversized.length > SHOWN ? '…' : ''}`] : []),
  ]
  if (failures.length) return { state: 'fail', evidence: failures.join('; ') }
  return { state: 'pass', evidence: `${content} content images, all AVIF, WebP or SVG and sized to fit` }
}
