import { afterAll, expect, test } from 'bun:test'
import { bilingual, monolingual } from '../../fixture.ts'
import switcherKeepsPage from './check.ts'

const good = bilingual(true)
const bad = bilingual(false)
const one = monolingual()
afterAll(() => [good, bad, one].forEach(s => s.server.stop(true)))

test('a switcher that links the same page passes; going home is fine where the page has no counterpart', async () => {
  const outcome = await switcherKeepsPage(good.ctx())
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toContain('the switcher keeps the page on 3 of 3 inner pages')
})

test("a switcher that goes to the other language's home fails, naming the page's alternate", async () => {
  const outcome = await switcherKeepsPage(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('/flotila: the en link goes to /en, not to /en/fleet, its hreflang en')
  expect(outcome.evidence).toContain('/en/fleet: the sk link goes to /, not to /flotila, its hreflang sk')
  expect(outcome.evidence).not.toContain('/blog/novinka')
})

test('a single-language site passes', async () => {
  expect((await switcherKeepsPage(one.ctx())).state).toBe('pass')
})
