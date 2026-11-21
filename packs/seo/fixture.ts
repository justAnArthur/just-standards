import type { Context } from '../../core/checks/context.ts'
import type { LoadedItem } from '../../core/load.ts'
import type { Business } from '../../core/schema.ts'

type Route = string | ((origin: string, request: Request) => string | Response)

/**
 * A local site for a check's tests: each route answers HTML (or its own Response), robots.txt names /sitemap.xml, and the
 * sitemap lists `sitemap` (by default every route). Anything else is a 404.
 */
export function site(routes: Record<string, Route>, sitemap?: string[]) {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const { origin, pathname, search } = new URL(request.url)
      if (pathname === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`)
      if (pathname === '/sitemap.xml') {
        const locs = (sitemap ?? Object.keys(routes)).map(path => `<url><loc>${path.startsWith('http') ? path : origin + path}</loc></url>`)
        return new Response(`<?xml version="1.0"?><urlset>${locs.join('')}</urlset>`, { headers: { 'content-type': 'application/xml' } })
      }
      const route = routes[pathname + search] ?? routes[pathname]
      if (route === undefined) return new Response('not found', { status: 404 })
      const answer = typeof route === 'function' ? route(origin, request) : route
      if (answer instanceof Response) return answer
      return new Response(request.method === 'HEAD' ? null : answer, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    },
  })
  const url = `http://localhost:${server.port}`
  const ctx = (path = '/'): Context => ({
    business: { id: 'acme', name: 'Acme', assets: [], packs: [], waivers: [] } as Business,
    asset: { id: 'site', kind: 'website', url: `${url}${path === '/' ? '' : path}` },
    item: {} as LoadedItem,
  })
  return { server, url, ctx }
}

export const html = (head: string, body = '', lang = 'en') => `<!doctype html><html lang="${lang}"><head>${head}</head><body>${body}</body></html>`
