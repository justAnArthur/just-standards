import { afterAll, describe, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import notFound, { isHome } from './check.ts'

// What the server answers for an unknown path.
let answer: 'branded' | 'locale' | 'soft' | 'empty' | 'crash' | 'json' | 'redirect-home' = 'branded'
const server = Bun.serve({
  port: 0,
  fetch(request): Response {
    const { pathname } = new URL(request.url)
    const html = (body: string, status = 404) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
    if (pathname === '/' || pathname === '/shop/') return html('<h1>Acme</h1>', 200)
    if (answer === 'branded') return html('<h1>Not here</h1><a href="/">Home</a>')
    if (answer === 'locale') return html(`<a href="http://localhost:${server.port}/shop/sk">Domov</a>`)
    if (answer === 'soft') return html('<h1>Acme</h1>', 200)
    if (answer === 'empty') return html('<html><head><script>render()</script></head><body></body></html>')
    if (answer === 'crash') return html('oops', 500)
    if (answer === 'redirect-home') return Response.redirect('/', 302)
    return Response.json({ error: 'not found' }, { status: 404 })
  },
})
afterAll(() => server.stop(true))

const check = (path = '/') => notFound({ asset: { id: 'site', kind: 'website', url: `http://localhost:${server.port}${path}` } } as Context)

describe('isHome', () => {
  const page = 'https://www.avis.sk/x'
  test('the root, with or without www, and a locale home', () => {
    expect(isHome('/', page, 'https://www.avis.sk')).toBe(true)
    expect(isHome('https://avis.sk', page, 'https://www.avis.sk/')).toBe(true)
    expect(isHome('/en/', page, 'https://www.avis.sk')).toBe(true)
    expect(isHome('/en-gb', page, 'https://www.avis.sk')).toBe(true)
  })
  test('not another page, host or scheme; under a subpath, its own root', () => {
    expect(isHome('/kontakt', page, 'https://www.avis.sk')).toBe(false)
    expect(isHome('https://avis.fo/', page, 'https://www.avis.sk')).toBe(false)
    expect(isHome('mailto:a@avis.sk', page, 'https://www.avis.sk')).toBe(false)
    expect(isHome('/', 'https://me.github.io/modo/ui/x', 'https://me.github.io/modo/ui/')).toBe(false)
    expect(isHome('/modo/ui/', 'https://me.github.io/modo/ui/x', 'https://me.github.io/modo/ui/')).toBe(true)
  })
})

describe('not-found', () => {
  test('passes a 404 HTML page that links home', async () => {
    answer = 'branded'
    expect((await check()).state).toBe('pass')
  })

  test('accepts a link to a locale home under the site path', async () => {
    answer = 'locale'
    expect((await check('/shop/')).state).toBe('pass')
  })

  test('fails a soft 404, also behind a redirect', async () => {
    answer = 'soft'
    expect((await check()).evidence).toContain('answered 200: a soft 404')
    answer = 'redirect-home'
    const outcome = await check()
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('a soft 404')
    expect(outcome.evidence).toContain('redirected to')
  })

  test('fails a 500 rather than calling it an error', async () => {
    answer = 'crash'
    const outcome = await check()
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('answered 500, expected 404')
  })

  test('fails a 404 that is not an HTML page, or links nowhere', async () => {
    answer = 'json'
    expect((await check()).evidence).toContain('not an HTML page')
    answer = 'empty'
    const outcome = await check()
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('no link to the home page (0 links): its body is empty as served')
  })
})
