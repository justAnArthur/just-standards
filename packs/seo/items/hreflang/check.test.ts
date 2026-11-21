import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../fixture.ts'
import hreflang from './check.ts'

const alt = (code: string, href: string) => `<link rel="alternate" hrefLang="${code}" href="${href}">`

const single = site({ '/': html('<title>Home</title>'), '/a': html('<title>A</title>') })
const good = site({
  '/': o => html(alt('en', `${o}/`) + alt('sk', `${o}/sk`) + alt('x-default', `${o}/`)),
  '/sk': o => html(alt('sk', `${o}/sk`) + alt('en', `${o}/`) + alt('x-default', `${o}/`), '', 'sk'),
})
const bad = site(
  {
    '/': html('<title>Home</title>'),
    // no x-default, an underscore code, and a German page that doesn't link back
    '/b': o => html(alt('en', `${o}/b`) + alt('en_GB', `${o}/b`) + alt('de', `${o}/b-de`)),
    '/b-de': html('', '', 'de'),
    // an alternate that's gone
    '/c': o => html(alt('en', `${o}/c`) + alt('fr', `${o}/gone`) + alt('x-default', `${o}/c`)),
    // calls itself English in a Slovak page, and doesn't list itself
    '/d': o => html(alt('en', `${o}/d`) + alt('x-default', `${o}/`), '', 'sk'),
    '/e': o => html(alt('sk', `${o}/sk-e`) + alt('x-default', `${o}/`)),
  },
  ['/', '/b', '/c', '/d', '/e'],
)
afterAll(() => [single, good, bad].forEach(s => s.server.stop(true)))

test('a site without alternates is single-language and passes', async () => {
  expect(await hreflang(single.ctx())).toEqual({ state: 'pass', evidence: 'no page carries hreflang alternates: a single-language site (2 pages)' })
})

test('reciprocal alternates with x-default pass', async () => {
  const outcome = await hreflang(good.ctx())
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toContain('en, sk, x-default: valid')
})

test('names each way alternates break', async () => {
  const outcome = await hreflang(bad.ctx())
  expect(outcome.state).toBe('fail')
  const evidence = outcome.evidence
  expect(evidence).toContain('/b: hreflang "en_GB" uses _ (write en-GB)')
  expect(evidence).toContain('/b: no x-default')
  expect(evidence).toContain("/b: hreflang de → /b-de, which doesn't link back")
  expect(evidence).toContain(`/c: hreflang fr → ${bad.url}/gone answered 404`)
  expect(evidence).toContain('/d: lists itself as en but <html lang="sk">')
  expect(evidence).toContain("/e: its alternates don't include the page itself")
})
