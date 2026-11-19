import type { Context } from '../../../../core/checks/context.ts'
import { resolve } from '../../../../core/checks/http.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

const SAMPLE = 20
const CHILD_SITEMAPS = 5

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')

async function text(url: string) {
  const response = await get(url)
  return response.ok ? response.text() : undefined
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => (match[1] as string).replaceAll('&amp;', '&'))

/** The page URLs of a sitemap, following an index into its first few children. */
async function pages(sitemap: string) {
  const xml = await text(sitemap)
  if (!xml) return undefined
  if (!xml.includes('<sitemapindex')) return locs(xml)
  const children = await Promise.all(locs(xml).slice(0, CHILD_SITEMAPS).map(text))
  return children.flatMap(child => (child ? locs(child) : []))
}

/** Spread the sample over the whole list, so it isn't only the first section of the site. */
const sample = (urls: string[]) => (urls.length <= SAMPLE ? urls : Array.from({ length: SAMPLE }, (_, i) => urls[Math.floor((i * urls.length) / SAMPLE)] as string))

export default async function sitemapHealth({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const robots = (await text(resolve('/robots.txt', asset.url))) ?? ''
  const sitemap = robots.match(/^sitemap:\s*(\S+)/im)?.[1] ?? resolve('/sitemap.xml', asset.url)
  const urls = await pages(sitemap)
  if (!urls) return { state: 'fail', evidence: `no sitemap at ${sitemap}` }
  if (urls.length === 0) return { state: 'fail', evidence: `${sitemap} lists no URLs` }

  const foreign = urls.filter(url => host(url) !== host(asset.url as string))
  const checked = sample(urls.filter(url => !foreign.includes(url)))
  const statuses = await Promise.all(
    checked.map(async url => {
      try {
        const response = await get(url, { redirect: 'manual' })
        await response.body?.cancel()
        return { url, status: response.status }
      } catch {
        return { url, status: 0 }
      }
    }),
  )
  const broken = statuses.filter(entry => entry.status !== 200)

  const problems = [
    foreign.length > 0 && `${foreign.length} of ${urls.length} URLs on another host (e.g. ${foreign[0]})`,
    broken.length > 0 && `${broken.length} of ${checked.length} sampled URLs don't answer 200: ${broken.slice(0, 3).map(b => `${b.url} → ${b.status || 'no answer'}`).join(', ')}`,
  ].filter(Boolean)
  if (problems.length > 0) return { state: 'fail', evidence: `${sitemap}: ${problems.join('; ')}` }
  return { state: 'pass', evidence: `${sitemap}: ${urls.length} URLs, ${checked.length} sampled, all 200` }
}
