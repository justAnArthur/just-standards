import { afterAll, describe, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import domainExpiry, { judge, rdapExpiry, registrable, whois, whoisExpiry, whoisServer } from './check.ts'

const now = new Date('2026-11-21T00:00:00Z')

describe('the parts', () => {
  test('the registrable domain, or the platform', () => {
    expect(registrable('www.avis.sk')).toEqual({ domain: 'avis.sk' })
    expect(registrable('shop.acme.co.uk')).toEqual({ domain: 'acme.co.uk' })
    expect(registrable('justanarthur.github.io')).toEqual({ platform: 'github.io' })
    expect(registrable('my-app.vercel.app')).toEqual({ platform: 'vercel.app' })
  })
  test('expiry from RDAP and from the WHOIS formats registries use', () => {
    expect(rdapExpiry({ events: [{ eventAction: 'registration', eventDate: '2016-06-12T22:03:49Z' }, { eventAction: 'expiration', eventDate: '2027-06-12T22:03:49Z' }] })).toEqual(new Date('2027-06-12T22:03:49Z'))
    expect(rdapExpiry({ events: [] })).toBeUndefined()
    expect(whoisExpiry('Domain:      avis.sk\nCreated:     2013-06-15\nValid Until:                  2027-06-15\n')).toEqual(new Date('2027-06-15'))
    expect(whoisExpiry('Registry Expiry Date: 2027-01-03T23:59:59Z')).toEqual(new Date('2027-01-03T23:59:59Z'))
    expect(whoisExpiry('expire:  15.06.2027')).toEqual(new Date(Date.UTC(2027, 5, 15)))
    expect(whoisExpiry('% No entries found')).toBeUndefined()
  })
  test('60 days or more pass', () => {
    expect(judge('avis.sk', { expires: new Date('2027-06-15'), source: 'WHOIS whois.sk-nic.sk' }, now)).toEqual({
      state: 'pass',
      evidence: 'avis.sk is registered until 2027-06-15, 206 days from now (WHOIS whois.sk-nic.sk)',
    })
    expect(judge('a.sk', { expires: new Date('2026-12-21'), source: 'RDAP x' }, now).evidence).toContain('expires in 30 days (2026-12-21, RDAP x), under 60')
    expect(judge('a.sk', { expires: new Date('2026-11-01'), source: 'RDAP x' }, now).evidence).toContain('expired 20 days ago')
  })
})

// A WHOIS server on a local port: IANA's answer for a TLD, and a registry's for a domain.
const tcp = Bun.listen({
  hostname: '127.0.0.1',
  port: 0,
  socket: {
    data(socket, data) {
      const query = data.toString().trim()
      socket.end(query === 'sk' ? 'domain:       SK\nwhois:        whois.sk-nic.sk\n' : `Domain: ${query}\nValid Until: 2027-06-15\n`)
    },
  },
})
afterAll(() => tcp.stop(true))

test('a WHOIS query over TCP, and the registry IANA names', async () => {
  const ask = (server: string, query: string) => whois('127.0.0.1', query, tcp.port).then(text => `${server}\n${text}`)
  expect(await whoisServer('sk', ask)).toBe('whois.sk-nic.sk')
  expect(whoisExpiry(await whois('127.0.0.1', 'avis.sk', tcp.port))).toEqual(new Date('2027-06-15'))
})

test('a platform subdomain passes without a lookup; localhost is an error', async () => {
  const ctx = (url: string) => ({ asset: { id: 'site', kind: 'website', url } }) as Context
  expect((await domainExpiry(ctx('https://justanarthur.github.io/modo/ui/'), now)).evidence).toBe('justanarthur.github.io is a subdomain of github.io, which the platform renews')
  expect((await domainExpiry(ctx('http://localhost:3000'), now)).state).toBe('error')
})
