import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { closeBrowser } from '../../core/browser.ts'
import { browserAvailable, checkItem, html, serve } from '../../core/fixtures/browser.ts'

// a real browser: loading a page, letting it settle and probing it takes seconds
setDefaultTimeout(60_000)
const available = await browserAvailable('packs/eu-consumer (browser items)')

// 127.0.0.1 on the same port is another site; `/g/collect?tid=G-…` is a Google Analytics hit on any host.
const banner = (buttons: string) =>
  `<div id="cmp" style="position:fixed;bottom:0;left:0;right:0;background:#fff"><p>We use cookies to measure visits.</p>${buttons}</div>`
const gtagStub = (defaults: string, port: number, gcs: string) => `<script>
  window.dataLayer = window.dataLayer || []; function gtag(){ dataLayer.push(arguments) }
  ${defaults}
  gtag('js', new Date()); gtag('config', 'G-TEST')
  new Image().src = 'http://127.0.0.1:${port}/g/collect?v=2&tid=G-TEST&gcs=${gcs}'
</script>`

let port = 0
const site = serve({
  '/g/collect': () => new Response(new Uint8Array([71, 73, 70]), { headers: { 'content-type': 'image/gif' } }),
  // nothing to consent to; a footer's cookie-policy link beside a newsletter's OK is no banner
  '/plain/': html('<main><h1>Hi</h1></main><footer><a href="/cookies">Cookie policy</a><form><input aria-label="E-mail"><button>OK</button></form></footer>'),
  // tracks on load
  '/eager/': html(`<main><h1>Hi</h1></main>${banner('<button>Accept all</button><button>Reject all</button>')}<script>document.cookie = '_ga=GA1.1.1; path=/'</script>`),
  // accept on the first layer, reject behind settings
  '/no-reject/': html(`<main><h1>Hi</h1></main>${banner('<button>Prijať všetko</button><button>Nastavenia</button>')}`),
  // reject that doesn't stop the pixel
  '/leaky-reject/': req =>
    new Response(
      html(`<main><h1>Hi</h1></main>${banner(`<button onclick="cmp.remove()">Prijať všetko</button><button onclick="cmp.remove(); new Image().src='http://127.0.0.1:${new URL(req.url).port}/g/collect?v=2&tid=G-TEST&gcs=G111'">Odmietnuť všetko</button>`)}`),
      { headers: { 'content-type': 'text/html' } },
    ),
  '/good/': html(`<main><h1>Hi</h1></main>${banner('<button onclick="cmp.remove()">Alle akzeptieren</button><button onclick="cmp.remove()">Nur notwendige</button>')}`),
  // consent mode
  '/cm-good/': req =>
    new Response(
      html(gtagStub("gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })", Number(new URL(req.url).port), 'G100')),
      { headers: { 'content-type': 'text/html' } },
    ),
  '/cm-v1/': req =>
    new Response(html(gtagStub("gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'granted' })", Number(new URL(req.url).port), 'G101')), {
      headers: { 'content-type': 'text/html' },
    }),
  '/cm-none/': req => new Response(html(gtagStub('', Number(new URL(req.url).port), 'none').replace('&gcs=none', '')), { headers: { 'content-type': 'text/html' } }),
})
port = site.port
afterAll(async () => {
  site.stop()
  await closeBrowser()
})

describe.skipIf(!available)('cookie-consent', () => {
  test('a site that tracks nothing needs no banner', async () => {
    expect(await checkItem('eu-consumer/cookie-consent', site.url('/plain/'))).toMatchObject({ state: 'pass', evidence: expect.stringContaining('no cookie banner, and nothing tracks before a choice') })
  })
  test('fails a tracker cookie set before any choice', async () => {
    expect(await checkItem('eu-consumer/cookie-consent', site.url('/eager/'))).toMatchObject({ state: 'fail', evidence: expect.stringContaining('before any choice, cookies _ga (Google Analytics)') })
  })
  test('fails a banner without reject on its first layer', async () => {
    expect(await checkItem('eu-consumer/cookie-consent', site.url('/no-reject/'))).toMatchObject({
      state: 'fail',
      evidence: expect.stringContaining('offers "Prijať všetko" but no reject on its first layer, only "Nastavenia"'),
    })
  })
  test('fails a reject that still sends a hit', async () => {
    expect(await checkItem('eu-consumer/cookie-consent', site.url('/leaky-reject/'))).toMatchObject({
      state: 'fail',
      evidence: expect.stringContaining(`after "Odmietnuť všetko", requests to Google Analytics (127.0.0.1:${port})`),
    })
  })
  test('passes a banner with reject beside accept', async () => {
    expect(await checkItem('eu-consumer/cookie-consent', site.url('/good/'))).toMatchObject({
      state: 'pass',
      evidence: expect.stringContaining('the banner offers "Nur notwendige" beside "Alle akzeptieren"; after "Nur notwendige" nothing tracks'),
    })
  })
})

describe.skipIf(!available)('consent-mode', () => {
  test('passes v2 defaults denied before config, and denied hits', async () => {
    expect(await checkItem('eu-consumer/consent-mode', site.url('/cm-good/'))).toMatchObject({
      state: 'pass',
      evidence: expect.stringContaining('ad_storage=denied, analytics_storage=denied, ad_user_data=denied, ad_personalization=denied; 1 hits with gcs=G100'),
    })
  })
  test('fails v1 defaults that grant analytics', async () => {
    const outcome = await checkItem('eu-consumer/consent-mode', site.url('/cm-v1/'))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('the consent default grants analytics_storage')
    expect(outcome.evidence).toContain('no default for ad_user_data, ad_personalization (Consent Mode v2)')
    expect(outcome.evidence).toContain('gcs=G101')
  })
  test('fails Google tags without any default', async () => {
    const outcome = await checkItem('eu-consumer/consent-mode', site.url('/cm-none/'))
    expect(outcome.evidence).toContain('no consent default is set before any choice')
    expect(outcome.evidence).toContain('carries no consent state (no gcs)')
  })
  test('a page without Google tags passes', async () => {
    expect(await checkItem('eu-consumer/consent-mode', site.url('/plain/'))).toMatchObject({ state: 'pass', evidence: expect.stringContaining('no Google tags on the page') })
  })
})
