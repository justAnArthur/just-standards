import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../../seo/fixture.ts'
import manifest, { manifestProblems } from './check.ts'

const png = () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } })
const json = (body: unknown) => () => Response.json(body, { headers: { 'content-type': 'application/manifest+json' } })
const full = {
  name: 'Acme',
  start_url: '/',
  theme_color: '#30296C',
  background_color: '#ffffff',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}
const good = site({ '/': html('<link rel="manifest" href="/site.webmanifest">'), '/site.webmanifest': json(full), '/icon-192.png': png, '/icon-512.png': png })
const missingIcon = site({ '/': html('<link rel="manifest" href="/m.json">'), '/m.json': json(full), '/icon-192.png': png })
const none = site({ '/': html('<title>Acme</title>') })
const broken = site({ '/': html('<link rel="manifest" href="/m.json">'), '/m.json': html('soft 404') })
afterAll(() => [good, missingIcon, none, broken].forEach(s => s.server.stop(true)))

test('what a manifest needs', () => {
  expect(manifestProblems(full)).toEqual([])
  expect(manifestProblems({ short_name: 'A', icons: [{ src: '/a.png', sizes: '192x192 512x512', purpose: 'maskable' }] })).toEqual([
    'no name',
    'no start_url',
    'no theme_color',
    'no background_color',
  ])
  expect(manifestProblems({ ...full, icons: [{ src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' }] })).toEqual([])
  expect(manifestProblems({ ...full, icons: [{ src: '/a.png', sizes: '180x180' }] })).toEqual(['no 192×192 icon', 'no 512×512 icon'])
})

test('a complete manifest whose icons load passes', async () => {
  const outcome = await manifest(good.ctx())
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toContain('"Acme", start_url /, theme #30296C, 192 and 512 px icons load')
})

test('a missing link, a non-JSON manifest and an icon that 404s fail', async () => {
  expect((await manifest(none.ctx())).evidence).toBe('the home page has no <link rel="manifest">')
  expect((await manifest(broken.ctx())).evidence).toContain('is not JSON')
  expect((await manifest(missingIcon.ctx())).evidence).toContain('the 512×512 icon http://localhost:')
})
