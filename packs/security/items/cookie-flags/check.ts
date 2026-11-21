import type { Context } from '../../../../core/checks/context.ts'
import { crawl, pathOf } from '../../../../core/crawl.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'

/** The crawl the seo and content items read too, so the pages are fetched once. */
const PAGES = 20
const SHOWN = 5

export interface Cookie {
  name: string
  secure: boolean
  httpOnly: boolean
  /** lowercased: lax, strict, none; undefined when not set */
  sameSite?: string
  /** a Set-Cookie that deletes the cookie: Max-Age=0 or an Expires in the past */
  deleting: boolean
}

export function parseCookie(header: string, now = Date.now()): Cookie {
  const [pair = '', ...attributes] = header.split(';').map(part => part.trim())
  const name = pair.split('=')[0]?.trim() ?? ''
  const attrs = new Map(
    attributes.map(attribute => {
      const at = attribute.indexOf('=')
      return at < 0 ? [attribute.toLowerCase(), ''] : [attribute.slice(0, at).trim().toLowerCase(), attribute.slice(at + 1).trim()]
    }),
  )
  const expires = attrs.get('expires')
  const maxAge = attrs.get('max-age')
  return {
    name,
    secure: attrs.has('secure'),
    httpOnly: attrs.has('httponly'),
    sameSite: attrs.get('samesite')?.toLowerCase(),
    deleting: (maxAge !== undefined && Number(maxAge) <= 0) || (expires !== undefined && Date.parse(expires) < now),
  }
}

/** A cookie that carries a login or a session: script must never read it. CSRF tokens are often read by script on purpose. */
export const sessionLike = (name: string) =>
  !/csrf|xsrf/i.test(name) && /sess|^sid$|^_?s_?id$|auth|token|jwt|login|remember|^connect\.sid$|^phpsessid$|^jsessionid$/i.test(name)

/** What a cookie lacks, or an empty list. */
export function cookieProblems(cookie: Cookie): string[] {
  const missing: string[] = []
  if (!cookie.secure) missing.push('Secure')
  if (!cookie.sameSite) missing.push('SameSite')
  else if (cookie.sameSite === 'none' && !cookie.secure) missing.push('Secure (SameSite=None requires it)')
  if (sessionLike(cookie.name) && !cookie.httpOnly) missing.push('HttpOnly')
  return missing
}

/** Every cookie set on the home page and the sampled pages has Secure and SameSite; session-like ones also HttpOnly. */
export default async function cookieFlags({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const pages = await crawl(asset.url, PAGES)
  const first = pages[0]
  if (!first || first.status === 0) return { state: 'error', evidence: `${asset.url} did not respond${first?.error ? ` (${first.error})` : ''}` }
  const blocked = pages.find(page => challenged(page))
  if (blocked) return { state: 'error', evidence: `${pathOf(blocked.url)}: ${challenged(blocked)}` }
  if (first.status >= 400) return { state: 'error', evidence: `${first.url} answered ${first.status}` }

  const seen = new Map<string, { cookie: Cookie; page: string }>()
  for (const page of pages) {
    for (const header of page.headers.getSetCookie()) {
      const cookie = parseCookie(header)
      if (!cookie.name || cookie.deleting || seen.has(cookie.name)) continue
      seen.set(cookie.name, { cookie, page: pathOf(page.url) })
    }
  }
  const answered = pages.filter(page => page.status > 0).length
  if (seen.size === 0) return { state: 'pass', evidence: `no cookies set on ${answered} pages (the home page and a sample of the sitemap)` }

  const failures = [...seen.values()].flatMap(({ cookie, page }) => {
    const missing = cookieProblems(cookie)
    return missing.length > 0 ? [`${cookie.name} (set on ${page}) lacks ${missing.join(', ')}`] : []
  })
  const names = [...seen.keys()].join(', ')
  if (failures.length === 0) return { state: 'pass', evidence: `${seen.size} cookies (${names}) carry Secure and SameSite, session cookies HttpOnly (${answered} pages)` }
  const more = failures.length > SHOWN ? `; and ${failures.length - SHOWN} more` : ''
  return { state: 'fail', evidence: `${failures.slice(0, SHOWN).join('; ')}${more} (${answered} pages)` }
}
