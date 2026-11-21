import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { frameAncestors, home, isOutcome, parseCsp } from '../../headers.ts'

/** Other sites can't put the page in a frame: CSP `frame-ancestors` (header only; a <meta> policy can't set it) or X-Frame-Options. */
export default async function frameProtection(ctx: Context): Promise<Outcome> {
  const page = await home(ctx)
  if (isOutcome(page)) return page
  const ancestors = frameAncestors(parseCsp(page.headers.get('content-security-policy')))
  const xfo = page.headers.get('x-frame-options')?.trim()

  if (ancestors) {
    const open = ancestors.find(sources => sources.some(source => source === '*' || source === 'https:' || source === 'http:'))
    if (!open) return { state: 'pass', evidence: `Content-Security-Policy frame-ancestors ${ancestors[0]?.join(' ')}` }
    // a wildcard frame-ancestors overrides X-Frame-Options in every current browser
    return { state: 'fail', evidence: `Content-Security-Policy frame-ancestors ${open.join(' ')} lets any site frame the page` }
  }
  if (xfo && /^(deny|sameorigin)$/i.test(xfo)) return { state: 'pass', evidence: `X-Frame-Options: ${xfo}` }
  if (xfo) return { state: 'fail', evidence: `X-Frame-Options: ${xfo} is not one browsers obey (DENY or SAMEORIGIN; ALLOW-FROM is ignored), and there is no frame-ancestors` }
  return { state: 'fail', evidence: `${page.url} sends neither Content-Security-Policy frame-ancestors nor X-Frame-Options, so any site can frame it (clickjacking)` }
}
