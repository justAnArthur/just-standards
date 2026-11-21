import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { canLaunch, closeBrowser, visit } from './browser.ts'
import { runCheck } from './checks/index.ts'
import { alias, authorize } from './expect.ts'
import type { LoadedItem } from './load.ts'
import { type Asset, type Business, Check } from './schema.ts'

// a real browser: loading a page, letting it settle and probing it takes seconds
setDefaultTimeout(60_000)
const available = await canLaunch()
if (!available) console.warn('core/browser.test.ts: skipped, no Chromium could be launched (bunx playwright-core install chromium-headless-shell, or set STANDARDS_CHROMIUM)')

// One site on localhost; 127.0.0.1 on the same port is "another site": a third party, and a stand-in for a tracker's
// collect endpoint (`/g/collect?tid=G-…` is Google Analytics on any host, server-side tagging included).
const big = `/* ${'x'.repeat(60_000)} */`
let bypassSeen = ''
let loadingNow = 0
let mostAtOnce = 0
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const { pathname, port } = new URL(request.url)
    if (pathname === '/slow') {
      mostAtOnce = Math.max(mostAtOnce, ++loadingNow)
      await Bun.sleep(300)
      loadingNow--
      return new Response('<!doctype html><title>slow</title>', { headers: { 'content-type': 'text/html' } })
    }
    const html = (body: string) => new Response(`<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`, { headers: { 'content-type': 'text/html' } })
    if (pathname === '/big.js') return new Response(big, { headers: { 'content-type': 'text/javascript' } })
    if (pathname === '/g/collect') return new Response(new Uint8Array([71, 73, 70]), { headers: { 'content-type': 'image/gif' } })
    if (pathname === '/') {
      return html(`
        <main><h1>Home</h1>
        <img src="/logo.png" width="10" height="10">
        <a href="/a" id="good" style="outline:none" onfocus="this.style.background='yellow'" onblur="this.style.background=''">Good focus</a>
        <a href="/b" id="bad" style="outline:none">Bad focus</a>
        </main>
        <script src="/big.js"></script>
        <script>
          document.cookie = '_ga=GA1.1.123; path=/'
          document.cookie = 'session=abc; path=/'
          new Image().src = 'http://127.0.0.1:${port}/g/collect?v=2&tid=G-TEST&gcs=G111'
          console.error('boom')
          setTimeout(() => { throw new Error('late') }, 10)
        </script>`)
    }
    if (pathname === '/preview') {
      bypassSeen = request.headers.get('x-vercel-protection-bypass') ?? ''
      return html('<img src="https://www.prod.example/logo.png">')
    }
    if (pathname === '/logo.png') return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } })
    return new Response('nope', { status: 404 })
  },
})
afterAll(async () => {
  server.stop(true)
  await closeBrowser()
})
const base = `http://localhost:${server.port}`

describe.skipIf(!available)('visit', () => {
  test('collects requests with sizes and parties, cookies before interaction, console errors, axe and focus stops', async () => {
    const v = await visit(`${base}/`, { viewport: 'desktop', axe: true, tabs: 3 })
    expect(v.status).toBe(200)
    const script = v.requests.find(r => r.url.endsWith('/big.js'))
    expect(script).toMatchObject({ type: 'script', thirdParty: false, mime: 'text/javascript' })
    expect(script!.bytes).toBeGreaterThan(60_000)
    expect(v.requests.find(r => r.url.includes('/g/collect'))).toMatchObject({ thirdParty: true, tracker: 'Google Analytics', interacted: false })
    expect(v.cookies).toContainEqual({ name: '_ga', domain: 'localhost', tracking: 'Google Analytics' })
    expect(v.cookies).toContainEqual({ name: 'session', domain: 'localhost' })
    expect(v.console).toContain('boom')
    expect(v.console).toContain('Uncaught Error: late')
    expect(v.axe?.map(violation => violation.id)).toContain('image-alt')
    const [first, second, third] = v.keyboard!
    expect(first).toMatchObject({ tag: 'a', text: 'Good focus', href: '/a', shown: true, changes: true })
    expect(second).toMatchObject({ tag: 'a', text: 'Bad focus', changes: false })
    // past the last link, focus leaves the page
    expect(third).toMatchObject({ none: true })
  })

  test('on a preview: production URLs are read from it, with its bypass header', async () => {
    authorize(base, { 'x-vercel-protection-bypass': 'secret' })
    const unalias = alias('https://www.prod.example', base)
    try {
      const v = await visit(`${base}/preview`, { viewport: 'mobile' })
      expect(bypassSeen).toBe('secret')
      expect(v.requests.find(r => r.url.endsWith('/logo.png'))).toMatchObject({ status: 200, thirdParty: false, mime: 'image/png' })
    } finally {
      unalias()
      authorize(base, {})
    }
  })

  test('loads at most two pages of one site at once', async () => {
    await Promise.all(Array.from({ length: 5 }, () => visit(`${base}/slow`, { viewport: 'mobile' })))
    expect(mostAtOnce).toBe(2)
  })

  test('a page that does not answer is an error, not a throw', async () => {
    const v = await visit('http://127.0.0.1:1/', { viewport: 'mobile' })
    expect(v.error).toBeTruthy()
  })
})

const business = { id: 'acme', name: 'Acme', assets: [], packs: [], waivers: [] } as unknown as Business
const run = (check: unknown, url = `${base}/`) =>
  runCheck({ business, asset: { id: 'site', kind: 'website', url } as Asset, item: { key: 'x/y', dir: '.', check: Check.parse(check) } as LoadedItem })

describe.skipIf(!available)('browser check', () => {
  test('generic expectations name what fails, per page', async () => {
    const outcome = await run({
      kind: 'browser',
      viewport: 'desktop',
      expect: [{ axe: {} }, { console: { ignore: 'late' } }, { transfer: { js_kb: 50 } }, { trackers: { allow_cookies: '^_ga$' } }],
    })
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('/: image-alt (critical) ×1')
    expect(outcome.evidence).toContain('1 console error: "boom"')
    expect(outcome.evidence).toMatch(/JS \d+ KB, over 50 KB/)
    expect(outcome.evidence).toContain('before any choice, requests to Google Analytics (127.0.0.1')
    expect(outcome.evidence).not.toContain('cookies _ga')
    expect(outcome.evidence).toContain('(/; desktop)')
  })

  test('passes what holds, with the numbers', async () => {
    const outcome = await run({ kind: 'browser', expect: [{ transfer: { total_kb: 1500 } }] })
    expect(outcome).toMatchObject({ state: 'pass', evidence: expect.stringMatching(/^\/: \d+ KB transferred, JS \d+ KB \(\/; mobile\)$/) })
  })

  test('a missing page fails', async () => {
    expect(await run({ kind: 'browser', pages: ['/gone'], expect: [{ console: {} }] })).toMatchObject({ state: 'fail', evidence: '/gone answered 404' })
  })
})
