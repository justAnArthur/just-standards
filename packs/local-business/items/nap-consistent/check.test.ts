import { afterAll, expect, test } from 'bun:test'
import { html, kept, ld, neglected, site } from '../../fixture.ts'
import napConsistent from './check.ts'

const good = kept()
const bad = neglected()
afterAll(() => [good, bad].forEach(s => s.server.stop(true)))

test('the JSON-LD name, phones and addresses are in the footer, contact and branch pages', async () => {
  const outcome = await napConsistent(good.ctx())
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toContain('3 names, 2 phones, 2 addresses from JSON-LD')
})

test('a JSON-LD phone and address the text never shows fail', async () => {
  const outcome = await napConsistent(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain("the phone +421 915 080 400 (Acme Letisko) isn't in the text")
  expect(outcome.evidence).toContain("1 of 1 JSON-LD addresses aren't in the text: Acme Letisko: Ivanská cesta 5285/91")
  expect(outcome.evidence).not.toContain('+421 900 200 200 (')
})

test('the same number in another spelling is the same number', async () => {
  const spelled = site({
    '/': html(ld({ '@type': 'Organization', name: 'Acme', telephone: '+421 2 2086 2620' }), '<footer>ACME · Tel.: 02/2086 2620</footer>'),
  })
  const outcome = await napConsistent(spelled.ctx())
  spelled.server.stop(true)
  expect(outcome.state).toBe('pass')
})

test('JSON-LD with only a name has nothing to compare', async () => {
  const named = site({ '/': html(ld({ '@type': 'AutoRental', name: 'Acme' }), '<footer>Acme</footer>') })
  const outcome = await napConsistent(named.ctx())
  named.server.stop(true)
  expect(outcome).toEqual({ state: 'fail', evidence: 'the JSON-LD gives only a name ("Acme"), no address or phone on / to compare with the text; see local-business/locations-schema' })
})
