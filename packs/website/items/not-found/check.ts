import type { Context } from '../../../../core/checks/context.ts'
import { resolve } from '../../../../core/checks/http.ts'
import { hostOf } from '../../../../core/crawl.ts'
import { get } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'

const trimSlash = (path: string) => path.replace(/\/+$/, '')

/** A link to the site's home: its base path, or a locale's home under it (`/sk`, `/en-gb/`), on the same host with or without `www.`. */
export function isHome(href: string, page: string, base: string) {
  let url: URL
  try {
    url = new URL(href, page)
  } catch {
    return false
  }
  if (!/^https?:$/.test(url.protocol) || hostOf(url.href) !== hostOf(base)) return false
  const root = trimSlash(new URL(base).pathname)
  const path = trimSlash(url.pathname)
  return path === root || new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[a-z]{2}(-[a-z]{2,4})?$`, 'i').test(path)
}

export default async function notFound({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const url = resolve(`/__standards-404-check-${crypto.randomUUID().slice(0, 8)}`, asset.url)
  let response: Response
  try {
    response = await get(url)
  } catch (error) {
    return { state: 'error', evidence: `${url} did not answer (${(error as Error).message})` }
  }
  const html = await response.text()
  const where = response.url && response.url !== url ? ` (redirected to ${response.url})` : ''

  if (response.status === 200) return { state: 'fail', evidence: `${url} answered 200${where}: a soft 404, so crawlers index a page that isn't there` }
  if (response.status !== 404 && response.status !== 410) return { state: 'fail', evidence: `${url} answered ${response.status}${where}, expected 404` }
  if (!/html/.test(response.headers.get('content-type') ?? '')) {
    return { state: 'fail', evidence: `${url} answered 404 with ${response.headers.get('content-type') || 'no content type'}, not an HTML page` }
  }
  const links = await select(html, 'a[href]')
  const page = response.url || url
  if (!links.some(link => isHome(link.attrs.href as string, page, asset.url as string))) {
    const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '').replace(/<(script|style|template)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '')
    const empty = body.trim() === '' ? ': its body is empty as served, so the page only exists once JavaScript runs' : ''
    return { state: 'fail', evidence: `${url} answers 404, but its HTML has no link to the home page (${links.length} links)${empty}` }
  }
  return { state: 'pass', evidence: `${url} answers 404 with an HTML page that links home` }
}
