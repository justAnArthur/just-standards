import { type NextRequest, NextResponse } from 'next/server'
import { contentSecurityPolicy } from '@/lib/csp'
import { pageOf } from '@/lib/i18n'
import { notFoundHtml } from '@/lib/not-found-page'

/**
 * Every page request passes here, for two things:
 * - the language: Slovak pages have no prefix (`/vozovy-park` is served by `app/[lang]` as `sk`), `/sk/...` redirects to
 *   the unprefixed URL, and `/en/...` passes through;
 * - a path that names no page answers 404 here, with a complete HTML page (lib/not-found-page.ts);
 * - a fresh CSP nonce, which Next.js puts on its own scripts. That is why pages render per request (see AGENTS.md).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname === '/sk' || pathname.startsWith('/sk/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(3) || '/'
    return NextResponse.redirect(url, 308)
  }

  const english = pathname === '/en' || pathname.startsWith('/en/')
  const lang = english ? 'en' : 'sk'
  const slug = (english ? pathname.slice(3) : pathname).replace(/^\/+/, '')
  const nonce = btoa(crypto.randomUUID())
  const policy = contentSecurityPolicy(nonce)
  if (pageOf(lang, slug) === undefined) {
    return new NextResponse(notFoundHtml(lang), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': policy },
    })
  }

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', policy)

  const response = english
    ? NextResponse.next({ request: { headers } })
    : NextResponse.rewrite(new URL(`/sk${pathname === '/' ? '' : pathname}${search}`, request.url), { request: { headers } })
  response.headers.set('content-security-policy', policy)
  return response
}

export const config = {
  // Prefetches pass here too: an unprefixed Slovak path only resolves through the rewrite.
  matcher: [
    {
      // not the files, route handlers and build output, which are served as they are
      source:
        '/((?!_next/|api/|og/|fleet/|icons/|stats/|\\.well-known/|favicon\\.ico|robots\\.txt|sitemap\\.xml|llms\\.txt|manifest\\.webmanifest).*)',
    },
  ],
}
