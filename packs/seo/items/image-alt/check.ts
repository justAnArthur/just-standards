import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages, some } from '../../shared.ts'

/**
 * What passes:
 * - a non-empty `alt` that isn't a file name or a placeholder ("image", "IMG_1234.jpg");
 * - `alt=""`: HTML's mark for a decorative image, which screen readers skip (`role="presentation"` is not needed with it);
 * - no `alt` on an image hidden from assistive technology (`aria-hidden="true"`, `role="presentation"` or `"none"`), or named
 *   by `aria-label`/`aria-labelledby`, or a 1×1 tracking pixel.
 * What fails: an image with no `alt` otherwise, a placeholder `alt`, and a link whose only content is images with no alt
 * text: the alt is that link's name.
 */
const PLACEHOLDER = /^(image|img|photo|picture|foto|obrázok|obrazok|logo|icon|banner|undefined|null|alt|\s*)$|\.(jpe?g|png|gif|webp|avif|svg)$/i

interface Image {
  src: string
  attrs: Record<string, string>
  /** inside a link with no other content */
  link?: Link
}

interface Link {
  text: string
  named: boolean
  images: Image[]
}

async function imagesOf(html: string) {
  const images: Image[] = []
  const links: Link[] = []
  const open: Link[] = []
  await new HTMLRewriter()
    .on('a', {
      element(element) {
        const named = Boolean(element.getAttribute('aria-label')?.trim() || element.getAttribute('aria-labelledby') || element.getAttribute('title')?.trim())
        const link: Link = { text: '', named, images: [] }
        links.push(link)
        open.push(link)
        element.onEndTag(() => {
          open.pop()
        })
      },
      text(chunk) {
        const link = open.at(-1)
        if (link) link.text += chunk.text
      },
    })
    // an icon or a labelled element inside the link names it
    .on('a svg, a [aria-label], a [title]', {
      element() {
        const link = open.at(-1)
        if (link) link.named = true
      },
    })
    .on('img', {
      element(element) {
        const attrs = Object.fromEntries(element.attributes)
        const image: Image = { src: attrs.src || attrs['data-src'] || attrs.srcset?.split(/[\s,]/)[0] || '(no src)', attrs }
        images.push(image)
        open.at(-1)?.images.push(image)
      },
    })
    .transform(new Response(html))
    .text()
  return { images, links }
}

const hidden = ({ attrs }: Image) =>
  attrs['aria-hidden'] === 'true' ||
  /^(presentation|none)$/i.test(attrs.role ?? '') ||
  Boolean(attrs['aria-label']?.trim() || attrs['aria-labelledby']) ||
  (Number(attrs.width) <= 1 && Number(attrs.height) <= 1 && attrs.width !== undefined)

const short = (src: string) => {
  const decoded = (() => {
    try {
      return decodeURIComponent(src)
    } catch {
      return src
    }
  })()
  // Next's image optimizer: show the original
  const original = decoded.match(/[?&]url=([^&]+)/)?.[1] ?? decoded
  return original.length > 60 ? `…${original.slice(-57)}` : original
}

export default async function imageAlt(ctx: Context): Promise<Outcome> {
  const pages = await htmlPages(ctx)
  if (!Array.isArray(pages)) return pages

  const problems: string[] = []
  let total = 0
  let decorative = 0
  for (const page of pages) {
    const { images, links } = await imagesOf(page.html)
    total += images.length
    const missing = images.filter(image => image.attrs.alt === undefined && !hidden(image))
    const placeholder = images.filter(image => image.attrs.alt?.trim() && PLACEHOLDER.test(image.attrs.alt.trim()))
    decorative += images.filter(image => image.attrs.alt?.trim() === '').length
    const unnamed = links.filter(link => link.images.length > 0 && !link.named && !link.text.trim() && !link.images.some(image => image.attrs.alt?.trim()))
    const path = pathOf(page.url)
    if (missing.length) problems.push(`${path}: ${missing.length} of ${images.length} img have no alt (${missing.slice(0, 2).map(image => short(image.src)).join(', ')})`)
    if (placeholder.length) problems.push(`${path}: alt "${placeholder[0]?.attrs.alt}" is a file name or placeholder${placeholder.length > 1 ? ` (and ${placeholder.length - 1} more)` : ''}`)
    if (unnamed.length) problems.push(`${path}: ${unnamed.length} links hold only an image with no alt text, so they have no name (${short(unnamed[0]?.images[0]?.src ?? '')})`)
  }

  const sample = `${total} img on ${pages.length} pages, ${decorative} marked decorative with alt=""`
  if (problems.length > 0) return { state: 'fail', evidence: `${some(problems)} (${sample})` }
  return { state: 'pass', evidence: `every image has alt text or is marked decorative (${sample})` }
}
