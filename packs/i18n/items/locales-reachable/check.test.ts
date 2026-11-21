import { afterAll, describe, expect, test } from 'bun:test'
import { bilingual, monolingual } from '../../fixture.ts'
import { localesOf } from '../../locales.ts'
import localesReachable from './check.ts'

const good = bilingual(true)
const bad = bilingual(false)
const one = monolingual()
afterAll(() => [good, bad, one].forEach(s => s.server.stop(true)))

describe('localesOf', () => {
  test('from <html lang>, hreflang and the switcher, one per language', async () => {
    const html = `<html lang="sk-SK"><head><link rel="alternate" hreflang="en-GB" href="/en"><link rel="alternate" hreflang="x-default" href="/"></head>
      <body><a href="/de">Deutsch</a><a href="/it-sluzby">IT</a><a href="/cs" lang="cs">CZ</a><a href="https://other.example/fr">Français</a></body></html>`
    const locales = await localesOf('https://acme.sk/', html)
    expect(locales.map(l => [l.code, l.home, l.via.join('+')])).toEqual([
      ['sk-SK', 'https://acme.sk/', '<html lang>'],
      ['en-GB', 'https://acme.sk/en', 'hreflang'],
      ['de', 'https://acme.sk/de', 'switcher'],
      ['cs', 'https://acme.sk/cs', 'switcher'],
    ])
  })
})

test('every declared locale answers 200 in its language', async () => {
  expect(await localesReachable(good.ctx())).toEqual({ state: 'pass', evidence: 'sk /, en /en: each answers 200 in its language' })
})

test('a locale home that fails is named with where it was declared', async () => {
  const outcome = await localesReachable(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('en (http://localhost:')
  expect(outcome.evidence).toContain('from hreflang, switcher) answered 500')
})

test('a single-language site passes', async () => {
  expect(await localesReachable(one.ctx())).toEqual({ state: 'pass', evidence: 'one language (sk, from <html lang>): nothing to check' })
})
