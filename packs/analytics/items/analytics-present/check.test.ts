import { afterAll, describe, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import analyticsPresent, { toolsIn } from './check.ts'

describe('toolsIn', () => {
  test('finds loaders by script URL and snippet, self-hosted Umami included', () => {
    expect(toolsIn('<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>')).toEqual([{ name: 'Google Analytics 4', gated: false }])
    expect(toolsIn('<script defer src="https://stats.acme.sk/script.js" data-website-id="3ec34ac3"></script>')).toEqual([{ name: 'Umami', gated: false }])
    expect(toolsIn('<script defer data-domain="acme.sk" src="https://plausible.io/js/script.js"></script>')).toEqual([{ name: 'Plausible', gated: false }])
    expect(toolsIn('<script>var _paq = window._paq = []; _paq.push(["trackPageView"]);</script>')).toEqual([{ name: 'Matomo', gated: false }])
  })

  test("finds a Next.js component's props in the server payload, but not a bare dns-prefetch", () => {
    const payload = '<script>self.__next_f.push([1,"{\\"websiteId\\":\\"3ec34ac3\\",\\"url\\":\\"https://umami.uteg.sk\\"}"])</script>'
    expect(toolsIn(payload).map(tool => tool.name)).toEqual(['Umami'])
    expect(toolsIn('<link rel="dns-prefetch" href="https://umami.uteg.sk"><link rel="preconnect" href="https://www.googletagmanager.com">')).toEqual([])
  })

  test('a placeholder a consent manager runs later counts, marked as after consent', () => {
    const gated = '<script type="text/plain" data-category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-X1"></script>'
    expect(toolsIn(gated)).toEqual([{ name: 'Google Analytics 4', gated: true }])
    expect(toolsIn(`${gated}<script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-5TDZW7N')</script>`)).toEqual([
      { name: 'Google Tag Manager', gated: false },
      { name: 'Google Analytics 4', gated: true },
    ])
  })
})

const server = Bun.serve({
  port: 0,
  fetch: request =>
    new Response(new URL(request.url).pathname === '/with' ? '<script src="https://cdn.usefathom.com/script.js" data-site="X"></script>' : '<p>none</p>', {
      headers: { 'content-type': 'text/html' },
    }),
})
afterAll(() => server.stop(true))
const ctx = (path: string) => ({ asset: { id: 'site', kind: 'website', url: `http://localhost:${server.port}${path}` } }) as Context

test('passes a page with a tool and fails one without', async () => {
  expect(await analyticsPresent(ctx('/with'))).toEqual({ state: 'pass', evidence: 'Fathom' })
  expect((await analyticsPresent(ctx('/without'))).state).toBe('fail')
})
