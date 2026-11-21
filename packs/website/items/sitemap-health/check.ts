import type { Context } from '../../../../core/checks/context.ts'
import { hostOf, sitemapOf, sitemapPages, spread } from '../../../../core/crawl.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

const SAMPLE = 20

export default async function sitemapHealth({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const sitemap = await sitemapOf(asset.url)
  const urls = await sitemapPages(sitemap)
  if (!urls) {
    // the shared helpers read a site that doesn't answer as one without a sitemap
    const answers = await get(asset.url).then(
      async response => {
        await response.body?.cancel()
        return true
      },
      () => false,
    )
    if (!answers) return { state: 'error', evidence: `${asset.url} did not answer` }
    return { state: 'fail', evidence: `no sitemap at ${sitemap}` }
  }
  if (urls.length === 0) return { state: 'fail', evidence: `${sitemap} lists no URLs` }

  const foreign = urls.filter(url => hostOf(url) !== hostOf(asset.url as string))
  const checked = spread(urls.filter(url => !foreign.includes(url)), SAMPLE)
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
