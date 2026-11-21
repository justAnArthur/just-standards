import { afterAll, expect, test } from 'bun:test'
import { html, ld, site } from '../../../local-business/fixture.ts'
import fleetData, { lacksOf } from './check.ts'

const car = (name: string, offers: unknown) => ld({ '@type': 'Product', name, offers })
const full = (name: string) =>
  html(car(name, { '@type': 'Offer', price: 46, priceCurrency: 'EUR' }), `<h1>${name}</h1><dl><dt>Počet miest</dt><dd>5 miestne</dd><dt>Prevodovka</dt><dd>Automat</dd><dt>Batožina</dt><dd>3 batožiny</dd></dl><p>Cena od <b>46,00 €</b> / deň</p>`, 'sk')

const good = site(
  {
    '/': html('', '<a href="/vozovy-park">Vozový park</a>'),
    '/vozovy-park': html('', '<a href="/vozovy-park/skoda-superb">Superb</a><a href="/vozovy-park/kia-ceed">Ceed</a><a href="/vozovy-park/page-2">2</a>'),
    '/vozovy-park/skoda-superb': full('Škoda Superb'),
    '/vozovy-park/kia-ceed': full('Kia Ceed'),
  },
  ['/', '/vozovy-park', '/vozovy-park/skoda-superb', '/vozovy-park/KIA-CEED'],
)
const listing = site({
  '/': html('', '<a href="/en/fleet">Fleet</a>'),
  '/en/fleet': html('', '<h1>Our fleet</h1><p>Toyota Yaris · Manual · from €39/day</p>'),
})
afterAll(() => [good, listing].forEach(s => s.server.stop(true)))

test('vehicle pages with the facts and a priced Offer pass; paging and other spellings of a path are left out', async () => {
  expect(await fleetData(good.ctx())).toEqual({
    state: 'pass',
    evidence: 'seats, transmission, luggage or class and a "from" price in the text, and Car/Product JSON-LD with a priced Offer (2 of 2 vehicle pages)',
  })
})

test('without vehicle pages, the fleet page itself is read', async () => {
  expect(await fleetData(listing.ctx())).toEqual({
    state: 'fail',
    evidence: '1 of 1: /en/fleet lacks seats, luggage or category, Car/Product JSON-LD (the fleet page /en/fleet, as no vehicle has a page of its own)',
  })
})

test('an Offer needs a price and a currency, also through an AggregateOffer or a priceSpecification', async () => {
  const text = '<p>5 seats, automatic, 2 bags, from 40 €</p>'
  expect(await lacksOf(html(car('A', { '@type': 'AggregateOffer', lowPrice: 40, priceCurrency: 'EUR' }), text))).toEqual([])
  expect(await lacksOf(html(car('A', { '@type': 'Offer', priceSpecification: { price: 40, priceCurrency: 'EUR' } }), text))).toEqual([])
  expect(await lacksOf(html(car('A', { '@type': 'Offer', price: 40 }), text))).toEqual(['an Offer with price and priceCurrency in its JSON-LD'])
})
