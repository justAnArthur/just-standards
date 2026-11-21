import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../../seo/fixture.ts'
import brokenImages, { imagesOf, shown } from './check.ts'

const png = () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } })
const good = site(
  {
    '/': html('', '<img src="/a.png" alt=""><img srcset="/b.png 1x, /b2.png 2x" alt=""><picture><source srcset="/c.png 640w"><img src="/a.png" alt=""></picture><img src="data:image/gif;base64,R0l" alt="">'),
    '/a.png': png,
    '/b.png': png,
    '/c.png': png,
  },
  ['/'],
)
const bad = site(
  {
    '/': html('', '<img src="/gone.jpg" alt=""><img src="/page.jpg" alt=""><video><source src="/v.mp4"></video>'),
    '/about': html('', '<img src="/a.png" alt="">'),
    '/a.png': png,
    '/page.jpg': html('soft 404'),
  },
  ['/', '/about'],
)
afterAll(() => [good, bad].forEach(s => s.server.stop(true)))

test('reads img src, the first srcset candidate and picture sources; skips data: and video sources', async () => {
  expect(await imagesOf('<img src="/a.png"><img srcset="/b.png 1x, /b2.png 2x"><picture><source srcset="/c.png 640w"></picture><video><source src="/v.mp4"></video><img src="data:x">', 'https://a.example/x/')).toEqual([
    'https://a.example/a.png',
    'https://a.example/b.png',
    'https://a.example/c.png',
  ])
})

test('images that answer 200 as images pass', async () => {
  expect(await brokenImages(good.ctx())).toEqual({ state: 'pass', evidence: 'every image answers 200 as an image (3 images on 1 pages)' })
})

test('a 404 and an HTML answer fail, naming the page', async () => {
  const outcome = await brokenImages(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('2 broken')
  expect(outcome.evidence).toContain('/gone.jpg answered 404 (on /)')
  expect(outcome.evidence).toContain('/page.jpg is text/html; charset=utf-8, not an image (on /)')
})

test('evidence names the source an optimizer resizes', () => {
  expect(shown('https://a.sk/_next/image?url=https%3A%2F%2Fcms.a.sk%2Fuploads%2Fvan.jpg&w=1920&q=75')).toBe('https://cms.a.sk/uploads/van.jpg (through /_next/image)')
  expect(shown('https://a.sk/van.jpg')).toBe('https://a.sk/van.jpg')
})
