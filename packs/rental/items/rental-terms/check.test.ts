import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../../local-business/fixture.ts'
import { pagesFor } from './check.ts'
import { pagesFor as pricePages } from '../prices-shown/check.ts'

// The AI's answer is not tested here (it needs `claude`); what it reads is.
const s = site({
  '/': html(
    '',
    `<a href="/vozovy-park">Vozový park</a><a href="/sluzby/podmienky-prenajmu-vozidla">Podmienky prenájmu vozidla</a><a href="/faq">FAQ</a>
     <a href="/sluzby/vseobecne-obchodne-podmienky">Všeobecné obchodné podmienky</a><a href="/sluzby/poplatky">Poplatky</a>
     <a href="/sluzby/poistenie">Poistenie</a><a href="/cennik">Cenník</a><a href="https://other.example/terms">Partner terms</a>`,
    'sk',
  ),
  '/vozovy-park': html('', '<a href="/vozovy-park/kia-ceed">Kia</a>'),
  '/vozovy-park/kia-ceed': html('', 'Kia'),
  '/sluzby/podmienky-prenajmu-vozidla': html('', 'terms'),
  '/faq': html('', 'faq'),
  '/sluzby/vseobecne-obchodne-podmienky': html('', 'vop'),
  '/sluzby/poplatky': html('', 'fees'),
  '/cennik': () => new Response('gone', { status: 410 }),
})
afterAll(() => s.server.stop(true))

test('rental-terms reads the rental conditions, the FAQ, the general terms and the fees, on the site itself, at most four', async () => {
  expect(await pagesFor(s.ctx())).toEqual([
    `${s.url}/sluzby/podmienky-prenajmu-vozidla`,
    `${s.url}/faq`,
    `${s.url}/sluzby/vseobecne-obchodne-podmienky`,
    `${s.url}/sluzby/poplatky`,
  ])
})

test('prices-shown reads the home page, the fleet, a vehicle and the fees, leaving out pages that do not answer', async () => {
  expect(await pricePages(s.ctx())).toEqual([`${s.url}/`, `${s.url}/vozovy-park`, `${s.url}/vozovy-park/kia-ceed`, `${s.url}/sluzby/poplatky`])
})
