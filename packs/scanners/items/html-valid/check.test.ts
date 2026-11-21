import { afterAll, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import { spaced } from '../../shared.ts'
import htmlValid, { localChecker } from './check.ts'

// A fake Nu checker: an error for every `<center>` (with its line), a warning for every `<section>` without a heading.
const posted: { type: string | null; agent: string | null; at: number }[] = []
const nu = Bun.serve({
  port: 0,
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.searchParams.get('out') !== 'json') return new Response('bad request', { status: 400 })
    posted.push({ type: request.headers.get('content-type'), agent: request.headers.get('user-agent'), at: Date.now() })
    const body = await request.text()
    if (body.includes('HUGE')) return new Response('Bad Gateway', { status: 502 })
    const lines = body.split('\n')
    const messages = lines.flatMap((line, i) => [
      ...(line.includes('<center>') ? [{ type: 'error', lastLine: i + 1, message: 'The “center” element is obsolete.' }] : []),
      ...[...line.matchAll(/<b id="(\w+)">/g)].map(match => ({ type: 'error', lastLine: i + 1, message: `Duplicate ID “${match[1]}”.`, extract: `x${match[0]}y`, hiliteStart: 1, hiliteLength: match[0].length })),
      ...(line.includes('<section>') ? [{ type: 'info', subType: 'warning', lastLine: i + 1, message: 'Section lacks heading.' }] : []),
    ])
    return Response.json({ messages })
  },
})

const page = (body: string) => `<!doctype html>\n<html lang="en">\n<head><title>t</title></head>\n<body>\n${body}\n</body>\n</html>`
const site = (pages: Record<string, string>, status: Record<string, number> = {}) =>
  Bun.serve({
    port: 0,
    fetch(request) {
      const { pathname, origin } = new URL(request.url)
      if (pathname === '/robots.txt') return new Response('')
      if (pathname === '/sitemap.xml') return new Response(`<urlset>${Object.keys(pages).map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`)
      const html = pages[pathname]
      if (status[pathname]) return new Response('slow down', { status: status[pathname], headers: { 'content-type': 'text/html' } })
      return html ? new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }) : new Response('nope', { status: 404 })
    },
  })
const servers = [nu]
afterAll(() => {
  for (const server of servers) server.stop(true)
  delete process.env.STANDARDS_NU_URL
  delete process.env.STANDARDS_NU_GAP_MS
})
process.env.STANDARDS_NU_URL = `${nu.url.origin}/nu/`
process.env.STANDARDS_NU_GAP_MS = '0'
process.env.STANDARDS_NU_RETRY_MS = '0'
const check = (url: string) => htmlValid({ asset: { id: 'site', kind: 'website', url } } as Context)

test('errors on the home page and the sampled pages fail, named by path and line; warnings do not count', async () => {
  const server = site({ '/': page('<center>hi</center>'), '/a': page('<section><p>ok</p></section>'), '/b': page('<p>ok</p>\n<center>x</center>') })
  servers.push(server)
  posted.length = 0
  const outcome = await check(server.url.origin)
  expect(outcome).toEqual({
    state: 'fail',
    evidence: `2 HTML errors by ${nu.url.host} (/ 1, /a 0, /b 1): /:5: The “center” element is obsolete.; /b:6: The “center” element is obsolete.`,
  })
  expect(posted).toHaveLength(3)
  expect(posted[0]!.type).toBe('text/html; charset=utf-8')
  expect(posted[0]!.agent).toStartWith('just-standards/')
})

test('valid pages pass; a sampled page that does not answer is named, not validated', async () => {
  const server = site({ '/': page('<p>ok</p>'), '/a': page('<p>ok</p>'), '/gone': page('') }, { '/gone': 500 })
  servers.push(server)
  expect(await check(server.url.origin)).toEqual({ state: 'pass', evidence: `no HTML errors by ${nu.url.host} on /, /a; not read: /gone (500)` })
})

test('a home page behind a rate limit, or a checker that is down, is an error', async () => {
  const limited = site({ '/': page('<p>ok</p>') }, { '/': 429 })
  const fine = site({ '/': page('<p>ok</p>') })
  servers.push(limited, fine)
  expect(await check(limited.url.origin)).toEqual({ state: 'error', evidence: 'the host answered 429 (rate limited) instead of the page' })
  process.env.STANDARDS_NU_URL = 'http://127.0.0.1:1/nu/'
  const down = await check(fine.url.origin)
  process.env.STANDARDS_NU_URL = `${nu.url.origin}/nu/`
  expect(down.state).toBe('error')
  expect(down.evidence).toEndWith('nothing was validated')
})

test('the same error is shown once with its count and the markup it points at; a page the checker fails on is named', async () => {
  const server = site({ '/': page('<b id="x"><b id="x"><b id="x">'), '/huge': page('HUGE') })
  servers.push(server)
  posted.length = 0
  expect(await check(server.url.origin)).toEqual({
    state: 'fail',
    evidence: `3 HTML errors by ${nu.url.host} (/ 3): /:5: Duplicate ID “x”. at <b id="x"> ×3; not validated: /huge (the Nu checker answered 502, 0 KB of HTML)`,
  })
  expect(posted).toHaveLength(3) // the page that got a 502 was asked once more
  const huge = site({ '/': page('HUGE') })
  servers.push(huge)
  expect(await check(huge.url.origin)).toEqual({ state: 'error', evidence: 'not validated: / (the Nu checker answered 502, 0 KB of HTML); nothing was validated' })
})

test('requests to the public checker are a gap apart', async () => {
  const started = Date.now()
  const times: number[] = []
  await Promise.all([1, 2, 3].map(() => spaced('test-gap', 40).then(() => times.push(Date.now() - started))))
  expect(times[2]! - times[0]!).toBeGreaterThanOrEqual(75)
})

test('a local checker is preferred: vnu on the PATH, else STANDARDS_VNU_JAR with java', () => {
  if (Bun.which('vnu')) return
  delete process.env.STANDARDS_VNU_JAR
  expect(localChecker()).toBeUndefined()
  process.env.STANDARDS_VNU_JAR = '/opt/vnu.jar'
  expect(localChecker()).toEqual(Bun.which('java') ? ['java', '-jar', '/opt/vnu.jar'] : undefined)
  delete process.env.STANDARDS_VNU_JAR
})
