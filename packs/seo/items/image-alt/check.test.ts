import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../fixture.ts'
import imageAlt from './check.ts'

const ok = site({
  '/': html(
    '',
    [
      '<img src="/car.jpg" alt="Škoda Octavia Combi, white">',
      '<img src="/line.svg" alt="">',
      '<img src="/deco.svg" role="presentation">',
      '<img src="/icon.svg" aria-hidden="true">',
      '<noscript><img src="https://px.test/tr" height="1" width="1"></noscript>',
      '<img src="https://px.test/tr2" height="1" width="1">',
      '<a href="/fleet"><img src="/van.jpg" alt=""> Vans</a>',
      '<a href="/" aria-label="Home"><img src="/logo.svg" alt=""></a>',
      '<a href="/x"><svg><title>Facebook</title></svg><img src="/x.png" alt=""></a>',
    ].join(''),
  ),
})
const bad = site({
  '/': html('', '<img src="/car.jpg"><img src="/van.jpg" alt="IMG_1234.JPG"><a href="/"><img src="/logo.svg" alt=""></a>'),
  '/b': html('', '<img src="/_next/image?url=%2Fuploads%2Fhero.webp&w=1920&q=75"><img src="/ok.jpg" alt="A van at the airport">'),
})
afterAll(() => [ok, bad].forEach(s => s.server.stop(true)))

test('alt text, decorative alt="", hidden images and tracking pixels pass', async () => {
  expect(await imageAlt(ok.ctx())).toEqual({
    state: 'pass',
    evidence: 'every image has alt text or is marked decorative (8 img on 1 pages, 4 marked decorative with alt="")',
  })
})

test('a missing alt, a file name as alt, and a link that is only an unnamed image fail', async () => {
  const outcome = await imageAlt(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('/: 1 of 3 img have no alt (/car.jpg)')
  expect(outcome.evidence).toContain('/: alt "IMG_1234.JPG" is a file name or placeholder')
  expect(outcome.evidence).toContain('/: 1 links hold only an image with no alt text, so they have no name (/logo.svg)')
  // Next's optimizer URL is shown as the original image
  expect(outcome.evidence).toContain('/b: 1 of 2 img have no alt (/uploads/hero.webp)')
})
