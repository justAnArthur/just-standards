import { afterAll, expect, test } from 'bun:test'
import { html, ld, site } from '../../../local-business/fixture.ts'
import faqSchema from './check.ts'

const faq = (questions: [string, string][]) =>
  ld({ '@type': 'FAQPage', mainEntity: questions.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) })
const body = '<h1>FAQ</h1><details><summary>Aká je výška depozitu ?</summary><p>Podľa kategórie.</p></details><details><summary>Môžem vycestovať do zahraničia?</summary><p>Áno.</p></details>'

const good = site({
  '/': html('', '<a href="/faq">FAQ</a>'),
  '/faq': html(faq([['Aká je výška depozitu&nbsp;?', '<p>Podľa kategórie.</p>'], ['Môžem vycestovať do zahraničia?', 'Áno.']]), body, 'sk'),
})
const drift = site({
  '/': html('', '<a href="/caste-otazky">Časté otázky</a>'),
  '/caste-otazky': html(faq([['Aká je výška depozitu ?', 'Podľa kategórie.'], ['Platí sa diaľničná známka?', '']]), body, 'sk'),
})
const missing = site({ '/': html('', '<a href="/faq">FAQ</a>'), '/faq': html('', body) })
afterAll(() => [good, drift, missing].forEach(s => s.server.stop(true)))

test('FAQPage whose questions are on the page and answered passes, entities and spacing aside', async () => {
  expect(await faqSchema(good.ctx())).toEqual({ state: 'pass', evidence: "/faq carries FAQPage JSON-LD with 2 questions, each in the page's text and answered" })
})

test('a question the page does not show, or one without an answer, fails', async () => {
  expect(await faqSchema(drift.ctx())).toEqual({
    state: 'fail',
    evidence: `/caste-otazky: 1 of 2 questions aren't in the page's text: "Platí sa diaľničná známka?"; 1 have no acceptedAnswer text`,
  })
})

test('an FAQ page without FAQPage JSON-LD fails', async () => {
  expect(await faqSchema(missing.ctx())).toEqual({ state: 'fail', evidence: '/faq has no FAQPage JSON-LD' })
})
