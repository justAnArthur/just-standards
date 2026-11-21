import { afterAll, expect, test } from 'bun:test'
import { CONTEXT, html, kept, site, withContext } from '../../fixture.ts'
import { pagesFor } from './check.ts'

// The AI's answer is not tested here (it needs `claude`); what it reads is.
const good = kept()
const notices = site({
  '/': html('', '<a href="/kontakt">Kontakt</a><a href="/aktuality/vianocne-otvaracie-hodiny">Vianočné otváracie hodiny</a><a href="/blog/ako-na-to">Blog</a>'),
  '/kontakt': html('', 'Kontakt'),
  '/aktuality/vianocne-otvaracie-hodiny': html('', 'Cez Vianoce 24.–26. 12. 2025 zatvorené'),
})
afterAll(() => [good, notices].forEach(s => s.server.stop(true)))

test('reads the home page, the contact page and the branch pages', async () => {
  expect(await pagesFor(await withContext(good.ctx(), CONTEXT))).toEqual([
    `${good.url}/`,
    `${good.url}/kontakt`,
    `${good.url}/pobocky/letisko`,
    `${good.url}/pobocky/mesto`,
  ])
})

test('and the notices about hours the home page links', async () => {
  expect(await pagesFor(notices.ctx())).toEqual([`${notices.url}/`, `${notices.url}/kontakt`, `${notices.url}/aktuality/vianocne-otvaracie-hodiny`])
})
