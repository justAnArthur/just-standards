// For tests of browser items: a real Chromium, the bundled packs, and a site served from `Bun.serve`.
import { canLaunch } from '../browser.ts'
import { runCheck } from '../checks/index.ts'
import { BUNDLED_PACKS, loadPacks } from '../load.ts'
import type { Asset, Business } from '../schema.ts'

const launchable = canLaunch()

/** Whether a Chromium can be launched; a skipped suite says so once. */
export async function browserAvailable(suite: string) {
  const ok = await launchable
  if (!ok) console.warn(`${suite}: skipped, no Chromium could be launched (bunx playwright-core install chromium-headless-shell, or set STANDARDS_CHROMIUM)`)
  return ok
}

const business = { id: 'acme', name: 'Acme', assets: [], packs: [], waivers: [] } as unknown as Business
const packs = loadPacks([BUNDLED_PACKS])

/** Runs a bundled item (`pack/item`) on `url`. */
export async function checkItem(key: string, url: string) {
  const item = [...(await packs).values()].flatMap(pack => pack.entries).find(entry => entry.key === key)
  if (!item) throw new Error(`no item ${key}`)
  return runCheck({ business, asset: { id: 'site', kind: 'website', url } as Asset, item })
}

/** A site of HTML pages by path; `/robots.txt` and `/sitemap.xml` list them. A page is HTML, or a Response. */
export function serve(pages: Record<string, string | ((request: Request) => Response)>) {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const { origin, pathname } = new URL(request.url)
      if (pathname === '/robots.txt') return new Response(`Sitemap: ${origin}/sitemap.xml`)
      if (pathname === '/sitemap.xml') {
        const listed = Object.keys(pages).filter(path => !path.includes('.'))
        return new Response(`<urlset>${listed.map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`)
      }
      const page = pages[pathname]
      if (typeof page === 'function') return page(request)
      if (page === undefined) return new Response('nope', { status: 404 })
      return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    },
  })
  return { url: (path = '/') => `http://localhost:${server.port}${path}`, port: server.port as number, stop: () => server.stop(true) }
}

/** A page with a language, a title and a landmark, so axe has nothing to say about the frame. */
export const html = (body: string, head = '') =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title><meta name="viewport" content="width=device-width">${head}</head><body>${body}</body></html>`
