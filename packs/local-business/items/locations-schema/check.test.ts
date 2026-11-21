import { afterAll, expect, test } from 'bun:test'
import { CONTEXT, html, kept, ld, neglected, site, withContext } from '../../fixture.ts'
import locationsSchema, { missingOf } from './check.ts'

const good = kept()
const bad = neglected()
const graph = site({
  // a LocalBusiness in an @graph, typed as a list, with openingHours as text and geo as numeric strings
  '/': o =>
    html(
      ld({
        '@graph': [
          {
            '@type': ['AutoRental', 'LocalBusiness'],
            name: 'Acme',
            url: `${o}/`,
            telephone: '+421 900 200 200',
            address: { streetAddress: 'Dlhá 248', postalCode: '905 01', addressLocality: 'Senica', addressCountry: { '@type': 'Country', name: 'SK' } },
            geo: { latitude: '48.68', longitude: '17.36' },
            openingHours: 'Mo-Fr 08:00-18:00',
          },
        ],
      }),
    ),
})
afterAll(() => [good, bad, graph].forEach(s => s.server.stop(true)))

test('every branch an AutoRental with a full address, phone, geo, hours and a url that answers, across home, contact and branch pages', async () => {
  const outcome = await locationsSchema(await withContext(good.ctx(), CONTEXT))
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toStartWith('2 LocalBusiness nodes (AutoRental), each with a name, a full PostalAddress')
})

test('a LocalBusiness typed as a list in an @graph, with openingHours text, passes', async () => {
  expect((await locationsSchema(graph.ctx())).state).toBe('pass')
})

test('names what each node lacks, and the context locations without a node', async () => {
  const outcome = await locationsSchema(await withContext(bad.ctx(), CONTEXT))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('Acme on / lacks address, telephone, geo, openingHoursSpecification')
  expect(outcome.evidence).toContain('2 of the 2 locations in the business context have no LocalBusiness: Acme Letisko (Ivanská cesta 5285/91), Acme Mesto (Seberíniho 9)')
})

test('Places in a contactPoint are named as the near miss', async () => {
  const places = site({ '/': o => html(ld({ '@type': 'Organization', contactPoint: { '@type': 'Place', name: 'Acme Letisko', address: 'Ivanská cesta 5285/91, 821 04 Bratislava' } })) })
  const outcome = await locationsSchema(places.ctx())
  places.server.stop(true)
  expect(outcome).toEqual({
    state: 'fail',
    evidence: 'no LocalBusiness JSON-LD (AutoRental or another subtype); 1 schema.org Place node with an address (Acme Letisko (Ivanská cesta 5285/91)) on /: make each a LocalBusiness subtype such as AutoRental (read /)',
  })
})

test('a text address is not a PostalAddress', () => {
  expect(missingOf({ '@type': 'AutoRental', name: 'A', address: 'Dlhá 248, Senica', telephone: '1', geo: { latitude: 1, longitude: 2 }, openingHours: 'Mo', url: 'x' })).toEqual([
    'a PostalAddress (address is plain text)',
  ])
})
