import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { closeBrowser } from '../../core/browser.ts'
import { browserAvailable, checkItem, html, serve } from '../../core/fixtures/browser.ts'

// a real browser: loading a page, letting it settle and probing it takes seconds
setDefaultTimeout(60_000)
const available = await browserAvailable('packs/performance (browser items)')

// Images as the formats they claim: only the content type and the decoded size matter to the checks.
const png = await new Response(Bun.file(`${import.meta.dir}/../../assets/brand/icon-1024.png`)).arrayBuffer().catch(() => undefined)
const image = (type: string) => () => (png ? new Response(png, { headers: { 'content-type': type } }) : new Response('', { status: 404 }))
const js = (kb: number) => () => new Response(`/*${Array.from({ length: kb * 1024 }, (_, i) => String.fromCharCode(33 + ((i * 7919) % 90))).join('')}*/`, { headers: { 'content-type': 'text/javascript' } })

const site = serve({
  '/light/': html('<main><h1>Light</h1></main>'),
  '/heavy/': html('<main><h1>Heavy</h1></main><script src="/heavy.js"></script>'),
  '/heavy.js': js(450),
  '/errors/': html('<main><h1>Oops</h1><img src="/missing.png" alt=""></main><script>undefinedFunction()</script>'),
  '/quiet/': html('<main><h1>Fine</h1></main>'),
  '/blocking/': req => {
    const other = `http://127.0.0.1:${new URL(req.url).port}`
    return new Response(html('<main><h1>Blocked</h1></main>', `<link rel="stylesheet" href="${other}/fonts.css"><script src="${other}/widget.js"></script><link rel="stylesheet" href="/own.css">`), {
      headers: { 'content-type': 'text/html' },
    })
  },
  '/deferred/': req =>
    new Response(html('<main><h1>Deferred</h1></main>', `<script defer src="http://127.0.0.1:${new URL(req.url).port}/widget.js"></script><link rel="stylesheet" href="/own.css">`), {
      headers: { 'content-type': 'text/html' },
    }),
  '/fonts.css': () => new Response('body{}', { headers: { 'content-type': 'text/css' } }),
  '/own.css': () => new Response('body{}', { headers: { 'content-type': 'text/css' } }),
  '/widget.js': () => new Response('void 0', { headers: { 'content-type': 'text/javascript' } }),
  // the icon is 1024×1024: shown at 150 CSS px (300 device px at 2×) it is oversized
  '/old-images/': html('<main><h1>Cars</h1><img src="/car.png" alt="A car" style="width:150px;height:150px;object-fit:cover"></main>'),
  '/new-images/': html('<main><h1>Cars</h1><img src="/car.webp" alt="A car" style="width:100%;height:auto"></main>'),
  '/car.png': image('image/png'),
  '/car.webp': image('image/webp'),
})
afterAll(async () => {
  site.stop()
  await closeBrowser()
})

describe.skipIf(!available)('page-weight', () => {
  test('a light page passes with its numbers', async () => {
    expect(await checkItem('performance/page-weight', site.url('/light/'))).toMatchObject({ state: 'pass', evidence: expect.stringMatching(/^\/light\/: \d+ KB transferred, JS 0 KB/) })
  })
  test('fails over 400 KB of script and names the heaviest file', async () => {
    const outcome = await checkItem('performance/page-weight', site.url('/heavy/'))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toMatch(/JS 45\d KB, over 400 KB \(heaviest: \/heavy\.js 45\d KB/)
  })
})

describe.skipIf(!available)('no-console-errors', () => {
  test('names the uncaught exception and the failed resource with its URL', async () => {
    const outcome = await checkItem('performance/no-console-errors', site.url('/errors/'))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('2 console errors')
    expect(outcome.evidence).toContain('/missing.png')
    expect(outcome.evidence).toContain('Uncaught ReferenceError')
  })
  test('a quiet page passes', async () => {
    expect((await checkItem('performance/no-console-errors', site.url('/quiet/'))).state).toBe('pass')
  })
})

describe.skipIf(!available)('third-party', () => {
  test("fails another host's stylesheet and script in <head>", async () => {
    const outcome = await checkItem('performance/third-party', site.url('/blocking/'))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain(`stylesheet http://127.0.0.1:${site.port}/fonts.css`)
    expect(outcome.evidence).toContain(`script http://127.0.0.1:${site.port}/widget.js`)
    expect(outcome.evidence).not.toContain('own.css')
  })
  test('a deferred third-party script passes', async () => {
    expect(await checkItem('performance/third-party', site.url('/deferred/'))).toMatchObject({ state: 'pass', evidence: expect.stringContaining('1 render-blocking file, all from localhost') })
  })
})

describe.skipIf(!available || !png)('modern-images', () => {
  test('fails a PNG content image delivered at several times its size', async () => {
    const outcome = await checkItem('performance/modern-images', site.url('/old-images/'))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('1 of 1 content images not AVIF/WebP: /car.png (png)')
    expect(outcome.evidence).toContain('1 oversized: /car.png')
  })
  test('passes a WebP that fills its box', async () => {
    expect(await checkItem('performance/modern-images', site.url('/new-images/'))).toMatchObject({ state: 'pass', evidence: expect.stringContaining('1 content images, all AVIF, WebP or SVG') })
  })
})
