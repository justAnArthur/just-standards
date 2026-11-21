import { afterAll, expect, test } from 'bun:test'
import { bilingual, monolingual } from '../../fixture.ts'
import unknownLocale from './check.ts'

const good = bilingual(true)
const bad = bilingual(false)
const one = monolingual()
afterAll(() => [good, bad, one].forEach(s => s.server.stop(true)))

test('404 for a made-up locale passes; a page rendered for it fails', async () => {
  expect(await unknownLocale(good.ctx())).toEqual({ state: 'pass', evidence: '/xx/ 404, /zz-ZZ/ 404: an unknown locale is a 404' })
  const outcome = await unknownLocale(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toBe("/xx/ answered 200: a page in a language the site doesn't have; /zz-ZZ/ answered 200: a page in a language the site doesn't have")
})

test('a single-language site passes without asking', async () => {
  expect((await unknownLocale(one.ctx())).evidence).toStartWith('one language (sk')
})
