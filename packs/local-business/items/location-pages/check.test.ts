import { afterAll, expect, test } from 'bun:test'
import { CONTEXT, html, kept, neglected, site, withContext } from '../../fixture.ts'
import locationPages from './check.ts'

const good = kept()
const bad = neglected()
afterAll(() => [good, bad].forEach(s => s.server.stop(true)))

test('each branch has its own indexable page with its address and hours', async () => {
  expect(await locationPages(await withContext(good.ctx(), CONTEXT))).toEqual({
    state: 'pass',
    evidence: 'each of the 2 locations: 2 in JSON-LD, 2 in the business context has an indexable page with its address and opening hours (2 pages)',
  })
})

test('a JSON-LD url that 404s and a context location without a page fail', async () => {
  const outcome = await locationPages(await withContext(bad.ctx(), CONTEXT))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('Acme Letisko (Ivanská cesta 5285/91) has no page of its own (its url /d8e38a3c answers 404)')
  expect(outcome.evidence).toContain('Acme Mesto (Seberíniho 9) has no page of its own')
})

test('a page found by its slug, without the address or hours, or noindex, fails', async () => {
  const thin = site({
    '/': html('', '<a href="/kontakt">Kontakt</a><a href="/o-nas/mesto">Mesto</a>'),
    '/kontakt': html('', 'Kontakt'),
    '/o-nas/mesto': html('<meta name="robots" content="noindex">', '<h1>Acme Mesto</h1><p>Prenájom áut v meste</p>'),
  })
  const outcome = await locationPages(await withContext(thin.ctx(), '## Locations\n- Acme Mesto: Seberíniho 9, 821 03 Bratislava\n- Acme Letisko: Ivanská cesta 5285/91, 821 04 Bratislava'))
  thin.server.stop(true)
  expect(outcome.evidence).toStartWith(
    'Acme Mesto (Seberíniho 9): /o-nas/mesto is noindex, doesn\'t show the address "Seberíniho 9", shows no opening hours; Acme Letisko (Ivanská cesta 5285/91) has no page of its own',
  )
})

test('one location: the contact page is its page', async () => {
  const one = site({ '/': html('', '<a href="/contact">Contact</a>'), '/contact': html('', '<p>2 Flogvøllurin, Sørvágur</p><p>Monday 08:00 21:00</p>') })
  const outcome = await locationPages(await withContext(one.ctx(), '## Branches\n- Vágar Airport: 2 Flogvøllurin, Sørvágur 380'))
  one.server.stop(true)
  expect(outcome.state).toBe('pass')
})

test('with no locations anywhere, says so', async () => {
  const none = site({ '/': html('', 'Hello') })
  const outcome = await locationPages(none.ctx())
  none.server.stop(true)
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toStartWith('no locations known')
})
