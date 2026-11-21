import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../fixture.ts'
import internalLinks from './check.ts'

const links = (...hrefs: string[]) => hrefs.map(href => `<a href="${href}">x</a>`).join('')
const redirect = (to: string) => () => new Response(null, { status: 301, headers: { location: to } })

const ok = site(
  {
  '/': html('', links('/a', '/a#top', '/old', 'mailto:a@b.c', 'tel:+421', '#x', 'https://elsewhere.test/404', '/no-head')),
  '/a': html('', links('/')),
  '/old': redirect('/a'),
  // HEAD isn't implemented; GET answers
  '/no-head': (_, request) => (request.method === 'HEAD' ? new Response(null, { status: 405 }) : new Response('<html></html>', { headers: { 'content-type': 'text/html' } })),
  },
  ['/', '/a'],
)
const broken = site(
  {
    '/': html('', links('/a', '/missing', '/chain', '/loop', '/error')),
    '/a': html('', links('/')),
    '/chain': redirect('/chain-2'),
    '/chain-2': redirect('/a'),
    '/loop': redirect('/loop'),
    '/error': () => new Response('boom', { status: 500 }),
  },
  ['/', '/a'],
)
afterAll(() => [ok, broken].forEach(s => s.server.stop(true)))

test('same-host links that answer, through at most one redirect, pass', async () => {
  expect(await internalLinks(ok.ctx())).toEqual({ state: 'pass', evidence: 'no 4xx/5xx, no redirect chains (4 of 4 internal links on 2 pages checked)' })
})

test('names 404s, 500s, redirect chains and loops, with the page that links them', async () => {
  const outcome = await internalLinks(broken.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('/missing → 404 (on /)')
  expect(outcome.evidence).toContain('/error → 500 (on /)')
  expect(outcome.evidence).toContain('/chain → /chain-2 → /a: 2 redirects (on /)')
  expect(outcome.evidence).toContain('/loop redirects in a loop (on /)')
  expect(outcome.evidence).toContain('(6 of 6 internal links on 2 pages checked)')
})
