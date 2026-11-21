import { afterAll, expect, test } from 'bun:test'
import { CONTEXT, html, kept, neglected, site, withContext } from '../../fixture.ts'
import mapLink, { mapsOn } from './check.ts'

const good = kept()
const bad = neglected()
afterAll(() => [good, bad].forEach(s => s.server.stop(true)))

test('each branch page links to a map', async () => {
  expect(await mapLink(await withContext(good.ctx(), CONTEXT))).toEqual({
    state: 'pass',
    evidence: 'every location page links to a map or embeds one: 2 maps (2 pages for 2 locations)',
  })
})

test('without location pages, the contact page needs a map per location', async () => {
  expect(await mapLink(await withContext(bad.ctx(), CONTEXT))).toEqual({
    state: 'fail',
    evidence: '/kontakt has no map links for 2 locations (Acme Letisko (Ivanská cesta 5285/91), Acme Mesto (Seberíniho 9)) (1 page for 2 locations)',
  })
})

test('Google, Apple and OpenStreetMap links and embeds count; a map image does not', async () => {
  const maps = await mapsOn(`<a href="https://maps.app.goo.gl/abc">a</a><a href="https://maps.apple.com/?q=x">b</a>
    <iframe src="https://www.openstreetmap.org/export/embed.html"></iframe><img src="https://maps.googleapis.com/staticmap.png">`)
  expect(maps).toHaveLength(3)
})

test('one location on its contact page, with a map', async () => {
  const one = site({ '/': html('', '<a href="/contact">Contact</a>'), '/contact': html('', '<a href="https://www.google.com/maps/place/62.06,-7.28">Map</a>') })
  const outcome = await mapLink(await withContext(one.ctx(), '## Branches\n- Vágar Airport: 2 Flogvøllurin, Sørvágur 380'))
  one.server.stop(true)
  expect(outcome.state).toBe('pass')
})
