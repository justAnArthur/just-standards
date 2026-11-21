import { afterAll, expect, test } from 'bun:test'
import { contextOf } from '../../fixture.ts'
import check from './check.ts'

const filler = `<p>${'text '.repeat(400)}</p>`
const pages: Record<string, string> = {
  '/good': `<html><head><link rel="stylesheet" href="/_next/static/css/a1b2c3d4.css"><script src="/_next/static/chunks/main-0f1e2d3c.js"></script></head><body>${filler}<img src="https://cdn.other.test/x-12345678.png"></body></html>`,
  '/bad': `<html><head><script src="/assets/index-BkXaQzfq.js"></script><link href="/assets/tailwind.css" rel="stylesheet"></head><body>${filler}</body></html>`,
}
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/_next/static/')) return new Response('x', { headers: { 'cache-control': 'public, max-age=31536000, immutable' } })
    if (pathname === '/assets/index-BkXaQzfq.js') return new Response('x', { headers: { 'cache-control': 'public, max-age=3600' } })
    const html = pages[pathname]
    if (!html) return new Response('no', { status: 404 })
    if (pathname === '/bad') return new Response(html, { headers: { 'content-type': 'text/html' } })
    return new Response(Bun.gzipSync(html), { headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } })
  },
})
afterAll(() => server.stop(true))
const url = (path: string) => `http://localhost:${server.port}${path}`

test('compressed HTML and immutable hashed assets pass; other hosts are not sampled', async () => {
  expect(await check(contextOf({ url: url('/good') }))).toEqual({ state: 'pass', evidence: `${url('/good')}: HTML gzip; 2 hashed assets immutable or cached a year` })
})

test('uncompressed HTML and a hashed asset cached for an hour fail; an unhashed name is not sampled', async () => {
  const outcome = await check(contextOf({ url: url('/bad') }))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('the HTML is sent uncompressed')
  expect(outcome.evidence).toContain('1 of 1 hashed assets aren\'t cached for a year: /assets/index-BkXaQzfq.js: Cache-Control "public, max-age=3600"')
})
