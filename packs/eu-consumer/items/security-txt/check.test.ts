import { afterAll, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import securityTxt from './check.ts'

const servers = ['valid', 'expired', 'soft404', 'nocontact', 'missing'].map(name =>
  Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname !== '/.well-known/security.txt') return new Response('nope', { status: 404 })
      if (name === 'valid') return new Response('Contact: mailto:security@acme.test\r\nexpires: 2027-06-01T00:00:00.000Z\r\n')
      if (name === 'expired') return new Response('Contact: https://acme.test/security\nExpires: 2026-01-01T00:00:00Z\n')
      if (name === 'soft404') return new Response('<!doctype html><title>Acme</title>', { headers: { 'content-type': 'text/html' } })
      if (name === 'nocontact') return new Response('# security\nExpires: 2027-01-01T00:00:00Z\n')
      return new Response('nope', { status: 404 })
    },
  }),
)
afterAll(() => {
  for (const server of servers) server.stop(true)
})
const now = new Date('2026-11-21T00:00:00Z')
// served under a subpath: the file is still looked up at the origin
const check = (i: number) => securityTxt({ asset: { id: 'site', kind: 'website', url: `http://localhost:${servers[i]?.port}/docs/` } } as Context, now)
const url = (i: number) => `http://localhost:${servers[i]?.port}/.well-known/security.txt`

test('a contact and a future expiry pass', async () => {
  expect(await check(0)).toEqual({ state: 'pass', evidence: `${url(0)}: Contact mailto:security@acme.test, Expires 2027-06-01T00:00:00.000Z` })
})

test('an expired file, an HTML soft 404, a missing contact and a 404 fail', async () => {
  expect((await check(1)).evidence).toBe(`${url(1)}: it expired on 2026-01-01T00:00:00Z`)
  expect((await check(2)).evidence).toBe(`${url(2)} answers HTML (text/html), not a security.txt`)
  expect((await check(3)).evidence).toBe(`${url(3)}: no Contact: field`)
  expect(await check(4)).toEqual({ state: 'fail', evidence: `${url(4)} answered 404` })
})
