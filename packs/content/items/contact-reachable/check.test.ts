import { afterAll, describe, expect, test } from 'bun:test'
import { html, site } from '../../../seo/fixture.ts'
import contactReachable, { dialable, problemsOf, unlinkedPhones } from './check.ts'

describe('the rules', () => {
  test('dialable tel: links', () => {
    expect(dialable('tel:+421900200200')).toBe(true)
    expect(dialable('tel:+421 2 2086 2620')).toBe(true)
    expect(dialable('tel:%2B298%20358800')).toBe(true)
    expect(dialable('tel:+421 900 200 200 (linka je spoplatnená sumou 0,60€/min.)')).toBe(false)
    expect(dialable('tel:')).toBe(false)
  })
  test('phone numbers written out, outside tel: links', async () => {
    const body = '<p>Volajte +421 900 200 200 alebo 00421 2 2086 2620.</p><a href="tel:+298358800">+298 358800</a><p>IČO 12345678, IBAN SK52 1100 0000 0029 4202 1111, 2026-11-21</p>'
    expect(await unlinkedPhones(html('', body))).toEqual(['+421 900 200 200', '00421 2 2086 2620'])
  })
  test('the footer needs a contact link; a page without a footer is read whole', async () => {
    expect(await problemsOf(html('', '<a href="/kontakt">Kontakt</a><footer><a href="/vop">VOP</a></footer>'))).toEqual(['the footer has no tel:, mailto: or contact link'])
    expect(await problemsOf(html('', '<div class="site-footer"><a href="mailto:info@acme.sk">info@acme.sk</a></div>'))).toEqual([])
    expect(await problemsOf(html('', '<main><a href="/en/contact">Contact us</a></main>'))).toEqual([])
    expect(await problemsOf(html('', '<main>Hi</main>'))).toEqual(['no footer, and no tel:, mailto: or contact link on the page'])
  })
})

const good = site({ '/': html('', '<footer><a href="tel:+421900200200">+421 900 200 200</a><a href="mailto:info@acme.sk">E-mail</a></footer>') })
const bad = site({
  '/': html('', '<footer><a href="tel:+421 900 200 200 (0,60€/min.)">Call</a></footer>'),
  '/vop': html('', '<p>Reklamácie: +421 2 2086 2620</p><footer><a href="/kontakt">Kontakt</a></footer>'),
})
afterAll(() => [good, bad].forEach(s => s.server.stop(true)))

test('passes linked contacts, fails an undialable link and a written-out number, by page', async () => {
  expect((await contactReachable(good.ctx())).state).toBe('pass')
  const outcome = await contactReachable(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain(`/: tel: link "tel:+421 900 200 200 (0,60€/min.)" isn't a number a phone can dial`)
  expect(outcome.evidence).toContain('/vop: "+421 2 2086 2620" is written out but not a tel: link')
})
