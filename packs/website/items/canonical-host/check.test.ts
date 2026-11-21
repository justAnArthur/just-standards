import { afterAll, describe, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import canonicalHost, { judgeHosts, otherHost } from './check.ts'

// Two names for one server: `localhost` serves the site, `127.0.0.1` is the alias, behaving as `alias` says.
let alias: 'redirect' | 'temporary' | 'chain' | 'duplicate' = 'redirect'
const server = Bun.serve({
  port: 0,
  fetch(request): Response {
    const { hostname, pathname } = new URL(request.url)
    const canonical = `http://localhost:${server.port}`
    if (hostname === 'localhost') return new Response('<h1>Acme</h1>', { headers: { 'content-type': 'text/html' } })
    if (alias === 'duplicate') return new Response('<h1>Acme</h1>', { headers: { 'content-type': 'text/html' } })
    if (alias === 'temporary') return Response.redirect(`${canonical}${pathname}`, 302)
    if (alias === 'chain' && pathname === '/') return Response.redirect(`http://127.0.0.1:${server.port}/home`, 301)
    return Response.redirect(`${canonical}/`, 308)
  },
})
afterAll(() => server.stop(true))

const site = `http://localhost:${server.port}/`
const other = `http://127.0.0.1:${server.port}/`

describe('otherHost', () => {
  test('adds or removes www on a registrable domain, and has none for a subdomain', () => {
    expect(otherHost('www.avis.sk')).toBe('avis.sk')
    expect(otherHost('rentcarnow.sk')).toBe('www.rentcarnow.sk')
    expect(otherHost('example.co.uk')).toBe('www.example.co.uk')
    expect(otherHost('justanarthur.github.io')).toBeUndefined()
    expect(otherHost('app.acadsys.com')).toBeUndefined()
  })
})

describe('judgeHosts', () => {
  test('passes when the alias redirects permanently in one hop (308 counts as permanent)', async () => {
    alias = 'redirect'
    const outcome = await judgeHosts(site, [site, other])
    expect(outcome.state).toBe('pass')
    expect(outcome.evidence).toBe(`${site} answers 200; ${other} redirects to it permanently`)
  })

  test('finds the canonical host from where the start URL lands', async () => {
    alias = 'redirect'
    expect((await judgeHosts(other, [site, other])).state).toBe('pass')
  })

  test('fails a temporary redirect', async () => {
    alias = 'temporary'
    const outcome = await judgeHosts(site, [other])
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('redirects temporarily (302')
  })

  test('fails a chain where one hop is allowed', async () => {
    alias = 'chain'
    const outcome = await judgeHosts(site, [other])
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('takes 2 redirects')
  })

  test('fails when both hosts answer 200', async () => {
    alias = 'duplicate'
    const outcome = await judgeHosts(site, [other])
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('the same site on two hosts')
  })

  test('fails an alias that does not answer, and names a host without DNS once', async () => {
    const dead = 'http://127.0.0.1:1/'
    const refused = await judgeHosts(site, [dead])
    expect(refused.state).toBe('fail')
    expect(refused.evidence).toStartWith(`${dead} does not answer (`)
    expect(refused.evidence).toEndWith(`): it should redirect to http://localhost:${server.port}`)
    const unresolved = await judgeHosts(site, ['https://nothing.invalid/', 'http://nothing.invalid/'])
    expect(unresolved.evidence).toBe(`nothing.invalid does not resolve: add a DNS record for it and redirect it to http://localhost:${server.port}`)
  })

  test('is an error when the site itself does not answer', async () => {
    expect((await judgeHosts('http://127.0.0.1:1/', [])).state).toBe('error')
  })
})

describe('canonical-host', () => {
  test('needs a URL', async () => {
    const outcome = await canonicalHost({ asset: { id: 'site', kind: 'website' } } as Context)
    expect(outcome.state).toBe('error')
  })
})
