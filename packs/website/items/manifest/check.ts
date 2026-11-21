import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'

interface Icon {
  src?: string
  sizes?: string
  type?: string
  purpose?: string
}

interface Manifest {
  name?: string
  short_name?: string
  start_url?: string
  theme_color?: string
  background_color?: string
  icons?: Icon[]
}

/** The icon for a size: listed at exactly that size, or an SVG listed as `any`. */
const iconFor = (icons: Icon[], size: number) =>
  icons.find(icon => icon.purpose !== 'maskable' && (icon.sizes ?? '').split(/\s+/).includes(`${size}x${size}`)) ??
  icons.find(icon => (icon.sizes ?? '').split(/\s+/).includes(`${size}x${size}`)) ??
  icons.find(icon => icon.sizes === 'any' && /svg/.test(icon.type ?? icon.src ?? ''))

/** What a manifest lacks, before its icons are fetched. */
export function manifestProblems(manifest: Manifest): string[] {
  const problems: string[] = []
  if (!manifest.name?.trim()) problems.push('no name')
  if (!manifest.start_url) problems.push('no start_url')
  if (!manifest.theme_color) problems.push('no theme_color')
  if (!manifest.background_color) problems.push('no background_color')
  const icons = Array.isArray(manifest.icons) ? manifest.icons : []
  for (const size of [192, 512]) if (!iconFor(icons, size)) problems.push(`no ${size}×${size} icon`)
  return problems
}

/** The home page links a web app manifest with a name, start_url, theme and background colours, and 192 and 512 px icons that load. */
export default async function manifest({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let page: Response
  try {
    page = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  if (page.status !== 200) return { state: 'error', evidence: challenged(page) ?? `${asset.url} answered ${page.status}` }
  const home = page.url || asset.url
  const link = (await select(await page.text(), 'link[rel~="manifest"]'))[0]?.attrs.href
  if (!link) return { state: 'fail', evidence: 'the home page has no <link rel="manifest">' }

  const url = new URL(link, home).href
  let parsed: Manifest
  try {
    const response = await get(url)
    const blocked = challenged(response)
    if (blocked) return { state: 'error', evidence: blocked }
    if (response.status !== 200) return { state: 'fail', evidence: `the manifest ${url} answered ${response.status}` }
    parsed = (await response.json()) as Manifest
  } catch (error) {
    return { state: 'fail', evidence: `the manifest ${url} is not JSON (${(error as Error).message})` }
  }
  const problems = manifestProblems(parsed)
  const icons = Array.isArray(parsed.icons) ? parsed.icons : []
  for (const size of [192, 512]) {
    const icon = iconFor(icons, size)
    if (!icon?.src) continue
    const src = new URL(icon.src, url).href
    try {
      const response = await get(src)
      await response.body?.cancel()
      const type = response.headers.get('content-type') ?? ''
      if (response.status !== 200 || !type.startsWith('image/')) problems.push(`the ${size}×${size} icon ${src} answered ${response.status} ${type}`.trim())
    } catch (error) {
      problems.push(`the ${size}×${size} icon ${src} did not respond (${(error as Error).message})`)
    }
  }
  if (problems.length > 0) return { state: 'fail', evidence: `the manifest ${url}: ${[...new Set(problems)].join(', ')}` }
  return { state: 'pass', evidence: `${url}: "${parsed.name}", start_url ${parsed.start_url}, theme ${parsed.theme_color}, 192 and 512 px icons load` }
}
