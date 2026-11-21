import { resolve } from './checks/http.ts'
import { get } from './expect.ts'

const CHILD_SITEMAPS = 5
const CONCURRENCY = 6

export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')

async function text(url: string) {
  try {
    const response = await get(url)
    return response.ok ? await response.text() : undefined
  } catch {
    return undefined
  }
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => (match[1] as string).replaceAll('&amp;', '&'))

/** The sitemap robots.txt names, or `/sitemap.xml`. */
export async function sitemapOf(base: string) {
  const robots = (await text(resolve('/robots.txt', base))) ?? ''
  return robots.match(/^sitemap:\s*(\S+)/im)?.[1] ?? resolve('/sitemap.xml', base)
}

/** The page URLs of a sitemap, following an index into its first few children; undefined when there is none. */
export async function sitemapPages(sitemap: string) {
  const xml = await text(sitemap)
  if (!xml) return undefined
  if (!xml.includes('<sitemapindex')) return locs(xml)
  const children = await Promise.all(locs(xml).slice(0, CHILD_SITEMAPS).map(text))
  return children.flatMap(child => (child ? locs(child) : []))
}

/** `count` URLs spread over the whole list, so the sample isn't only the first section of the site. */
export const spread = <T>(items: T[], count: number) =>
  items.length <= count ? items : Array.from({ length: count }, (_, i) => items[Math.floor((i * items.length) / count)] as T)

export interface Page {
  /** The URL asked for. */
  url: string
  /** Where it ended up after redirects. */
  final: string
  status: number
  headers: Headers
  /** Empty for a page that isn't HTML. */
  html: string
  error?: string
}

async function fetchPage(url: string): Promise<Page> {
  try {
    const response = await get(url)
    const html = /html/.test(response.headers.get('content-type') ?? '') ? await response.text() : ''
    if (!html) await response.body?.cancel()
    return { url, final: response.url || url, status: response.status, headers: response.headers, html }
  } catch (error) {
    return { url, final: url, status: 0, headers: new Headers(), html: '', error: (error as Error).message }
  }
}

async function crawlFresh(base: string, count: number) {
  const urls = (await sitemapPages(await sitemapOf(base))) ?? []
  const own = urls.filter(url => hostOf(url) === hostOf(base))
  const home = resolve('/', base)
  const sample = [home, ...spread(own.filter(url => url !== home && url !== base), count - 1)]
  const pages: Page[] = []
  const queue = [...sample]
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) pages.push(await fetchPage(url))
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return sample.map(url => pages.find(page => page.url === url) as Page)
}

const cache = new Map<string, Promise<Page[]>>()

/**
 * The home page and up to `count - 1` pages sampled from the sitemap, on the base URL's host. One process crawls each site
 * once: every crawl item of a check run reads the same pages.
 */
export function crawl(base: string, count = 20) {
  const key = `${base} ${count}`
  let pages = cache.get(key)
  if (!pages) {
    pages = crawlFresh(base, count)
    cache.set(key, pages)
  }
  return pages
}

/** A page's path for evidence: shorter than its URL. */
export const pathOf = (url: string) => {
  const { pathname, search } = new URL(url)
  return `${pathname}${search}`
}
