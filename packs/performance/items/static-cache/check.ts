import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

const YEAR_S = 31_536_000
const SAMPLE = 6
const MIN_COMPRESSIBLE = 1024

/** Build output folders whose files are named by their content's hash (Next, Astro, Nuxt, SvelteKit). */
const HASHED_DIR = /\/(_next\/static|_astro|_nuxt|_app\/immutable)\//
/** A content hash in the file name, `index-BkX3a9Qz.js`: 8+ characters with a digit or both cases, so `-tailwind.css` isn't one. */
const HASHED_NAME = /[.\-_]([A-Za-z0-9_-]{8,})\.(js|mjs|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|gif)$/
const isHash = (part: string) => /\d/.test(part) || (/[a-z]/.test(part) && /[A-Z]/.test(part))

const site = (host: string) => host.replace(/^www\./, '')

function hashedAssets(html: string, page: string) {
  const host = site(new URL(page).hostname)
  const urls = new Set<string>()
  for (const [, value] of html.matchAll(/\s(?:src|href)=["']([^"'\s]+)["']/g)) {
    let url: URL
    try {
      url = new URL((value as string).replaceAll('&amp;', '&'), page)
    } catch {
      continue
    }
    if (!url.protocol.startsWith('http') || !(site(url.hostname) === host || url.hostname.endsWith(`.${host}`))) continue
    const name = url.pathname.match(HASHED_NAME)
    if (HASHED_DIR.test(url.pathname) || (name && isHash(name[1] as string))) urls.add(url.href)
  }
  return [...urls]
}

/** Scripts, stylesheets and the rest, a couple of each, so one kind of file isn't the whole sample. */
function sample(urls: string[]) {
  const kinds = [/\.m?js$/, /\.css$/, /^(?!.*\.(m?js|css)$)/]
  const picked = new Set<string>()
  for (const kind of kinds) for (const url of urls.filter(url => kind.test(new URL(url).pathname)).slice(0, SAMPLE / kinds.length)) picked.add(url)
  return [...picked]
}

/** Why a response's Cache-Control doesn't keep it a year, or undefined when it does. */
function cacheProblem(cacheControl: string | null) {
  if (!cacheControl) return 'no Cache-Control'
  if (/\bimmutable\b/i.test(cacheControl)) return undefined
  const maxAge = Number(cacheControl.match(/(?:^|[,\s])max-age=(\d+)/i)?.[1] ?? 0)
  return maxAge >= YEAR_S && !/\bno-(cache|store)\b/i.test(cacheControl) ? undefined : `Cache-Control "${cacheControl}"`
}

export default async function staticCache({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let page: Response
  try {
    page = await get(asset.url, { headers: { 'accept-encoding': 'br, gzip' } })
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond: ${(error as Error).message}` }
  }
  const html = await page.text()
  if (!page.ok) return { state: 'fail', evidence: `${page.url} answered ${page.status}` }

  const problems: string[] = []
  const encoding = page.headers.get('content-encoding')
  if (html.length >= MIN_COMPRESSIBLE && !/\b(br|gzip|zstd|deflate)\b/i.test(encoding ?? '')) problems.push(`the HTML is sent uncompressed (${Math.round(html.length / 1024)} KB, no br or gzip)`)

  const urls = sample(hashedAssets(html, page.url))
  const checked = await Promise.all(
    urls.map(async url => {
      try {
        const response = await get(url)
        await response.body?.cancel()
        if (!response.ok) return `${new URL(url).pathname} answered ${response.status}`
        const problem = cacheProblem(response.headers.get('cache-control'))
        return problem && `${new URL(url).pathname}: ${problem}`
      } catch (error) {
        return `${new URL(url).pathname} did not respond (${(error as Error).message})`
      }
    }),
  )
  const uncached = checked.filter((problem): problem is string => Boolean(problem))
  if (uncached.length > 0) problems.push(`${uncached.length} of ${urls.length} hashed assets aren't cached for a year: ${uncached.slice(0, 3).join('; ')}`)

  if (problems.length > 0) return { state: 'fail', evidence: `${page.url}: ${problems.join('; ')}` }
  const assets = urls.length > 0 ? `${urls.length} hashed assets immutable or cached a year` : 'no hashed assets referenced'
  return { state: 'pass', evidence: `${page.url}: HTML ${encoding ?? 'small, uncompressed'}; ${assets}` }
}
