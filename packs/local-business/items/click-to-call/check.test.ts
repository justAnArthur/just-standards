import { afterAll, expect, test } from 'bun:test'
import { kept, neglected, site } from '../../fixture.ts'
import clickToCall, { scan, telProblem } from './check.ts'

const good = kept()
const bad = neglected()
afterAll(() => [good, bad].forEach(s => s.server.stop(true)))

test('every number a tel: link in E.164 and every address a mailto: link passes', async () => {
  expect(await clickToCall(good.ctx())).toEqual({
    state: 'pass',
    evidence: 'every phone number shown is a tel: link in E.164 form and every e-mail a mailto: link (4 pages)',
  })
})

test('names tel: values that won\'t dial, numbers and addresses outside links', async () => {
  expect(await clickToCall(bad.ctx())).toEqual({
    state: 'fail',
    evidence:
      "tel: links that won't dial: tel:+421 900 200 200 (0,60 €/min) isn't a number (+ and digits); 1 phone number not in a tel: link: 0900 200 200 on / and 1 more page; 1 e-mail address not in a mailto: link: info@acme.sk on / (2 pages)",
  })
})

test('tel: values', () => {
  expect(telProblem('tel:+421%20900%20200%20200')).toBeUndefined()
  expect(telProblem('tel:+421-900-200-200')).toBeUndefined()
  expect(telProblem('tel:0900200200')).toBe('tel:0900200200 has no country code')
  expect(telProblem('tel:+298 358800}')).toBe("tel:+298 358800} isn't a number (+ and digits)")
})

test('a WhatsApp link counts as a link; a number in a link elsewhere does not', async () => {
  const found = await scan('<p><a href="https://wa.me/421900200200">+421 900 200 200</a> <a href="/kontakt">+421 915 080 400</a></p>')
  expect(found.phones).toEqual(['+421 915 080 400'])
})

test('a home page behind a bot checkpoint (403) is an error, not a pass', async () => {
  const blocked = site({ '/': () => new Response('<title>Vercel Security Checkpoint</title>', { status: 403, headers: { 'content-type': 'text/html' } }) })
  const outcome = await clickToCall(blocked.ctx())
  blocked.server.stop(true)
  expect(outcome).toEqual({ state: 'error', evidence: `${blocked.url} answered 403` })
})
