import { afterAll, expect, test } from 'bun:test'
import { site } from '../../fixture.ts'
import urlHygiene from './check.ts'

const clean = site({}, ['/', '/fleet', '/fleet/van', '/po%C5%BEi%C4%8Dov%C5%88a', '/terms.pdf'])
const messy = site({}, ['/', '/Fleet', '/fleet/', '/contact', '/about/', '/about/team/', '/search?q=van', '/contact', 'http://www.localhost/x'])
const none = Bun.serve({ port: 0, fetch: request => (new URL(request.url).pathname === '/' ? new Response('<html></html>', { headers: { 'content-type': 'text/html' } }) : new Response('nope', { status: 404 })) })
afterAll(() => {
  for (const s of [clean, messy]) s.server.stop(true)
  none.stop(true)
})

test('lowercase URLs in one trailing-slash style pass; escapes and files are fine', async () => {
  expect(await urlHygiene(clean.ctx())).toEqual({
    state: 'pass',
    evidence: `${clean.url}/sitemap.xml: 5 URLs, lowercase, no query strings, none ending in /, no duplicates`,
  })
})

test('names uppercase, query strings, mixed slashes, duplicates and a second origin', async () => {
  const outcome = await urlHygiene(messy.ctx())
  expect(outcome.state).toBe('fail')
  for (const part of [
    `URLs on 2 origins: ${messy.url} (8), http://www.localhost (1)`,
    '1 with uppercase letters: /Fleet',
    '1 with a query string or fragment: /search?q=van',
    'two trailing-slash styles: 3 end in / against 5 (/fleet/, /about/, /about/team/)',
    '1 listed more than once: /contact',
    'pages listed under several spellings: /Fleet and /fleet/',
  ]) expect(outcome.evidence).toContain(part)
})

test('a site that does not answer is an error, not a missing sitemap', async () => {
  const outcome = await urlHygiene({ ...clean.ctx(), asset: { id: 'site', kind: 'website', url: 'http://localhost:1' } })
  expect(outcome.state).toBe('error')
})

test('no sitemap fails', async () => {
  const url = `http://localhost:${none.port}`
  const outcome = await urlHygiene({ ...clean.ctx(), asset: { id: 'site', kind: 'website', url } })
  expect(outcome).toEqual({ state: 'fail', evidence: `no sitemap at ${url}/sitemap.xml` })
})
