import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import tls, { judgePeer, mixedContent, peer } from './check.ts'

const HOME = `<html><head>
  <link rel="stylesheet" href="http://cdn.example.com/site.css">
  <link rel="canonical" href="http://example.com/">
  <script src="https://cdn.example.com/app.js"></script>
</head><body>
  <a href="http://example.com/old">a link is not a subresource</a>
  <img src="/logo.png" srcset="http://cdn.example.com/a.jpg 1x, https://cdn.example.com/b.jpg 2x">
  <iframe src="http://maps.example.com/embed"></iframe>
</body></html>`

const hasOpenssl = Bun.which('openssl') !== null
let dir = ''
const servers: ReturnType<typeof Bun.serve>[] = []
const certs: Record<'long' | 'short', string> = { long: '', short: '' }
const ports: Record<'long' | 'short', number> = { long: 0, short: 0 }

beforeAll(async () => {
  if (!hasOpenssl) return
  dir = await mkdtemp(join(tmpdir(), 'standards-tls-'))
  for (const [name, days] of [['long', 365], ['short', 10]] as const) {
    const [key, cert] = [join(dir, `${name}.key`), join(dir, `${name}.crt`)]
    Bun.spawnSync(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', String(days), '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'])
    certs[name] = await Bun.file(cert).text()
    const server = Bun.serve({
      port: 0,
      tls: { cert: Bun.file(cert), key: Bun.file(key) },
      fetch: () => new Response(HOME, { headers: { 'content-type': 'text/html' } }),
    })
    servers.push(server)
    ports[name] = server.port as number
  }
})
afterAll(async () => {
  for (const server of servers) server.stop(true)
  if (dir) await rm(dir, { recursive: true, force: true })
})

describe('mixedContent', () => {
  test('finds http:// scripts, styles, images (srcset too) and frames, not links people follow', async () => {
    expect((await mixedContent(HOME)).sort()).toEqual(['http://cdn.example.com/a.jpg', 'http://cdn.example.com/site.css', 'http://maps.example.com/embed'])
  })
})

describe('judgePeer', () => {
  const now = new Date('2026-11-21T00:00:00Z')
  const valid = { authorized: true, validTo: new Date('2027-01-21T00:00:00Z'), protocol: 'TLSv1.3' }
  test('holds the certificate to trust, 21 more days and TLS 1.2', () => {
    expect(judgePeer('a.sk', valid, now)).toBeUndefined()
    expect(judgePeer('a.sk', { ...valid, validTo: new Date('2026-12-01T00:00:00Z') }, now)).toBe(
      'the certificate of a.sk expires in 10 days (2026-12-01), under 21',
    )
    expect(judgePeer('a.sk', { ...valid, authorized: false, error: 'CERT_HAS_EXPIRED' }, now)).toContain('not trusted (CERT_HAS_EXPIRED)')
    expect(judgePeer('a.sk', { ...valid, protocol: 'TLSv1.1' }, now)).toContain('older than TLS 1.2')
  })
})

describe.skipIf(!hasOpenssl)('peer and the check, against a local HTTPS server', () => {
  test('reads the expiry and protocol; trusted only with its own CA', async () => {
    const trusted = await peer('localhost', ports.long, certs.long)
    expect(trusted.authorized).toBe(true)
    expect(judgePeer('localhost', trusted)).toBeUndefined()
    expect(judgePeer('localhost', await peer('localhost', ports.short, certs.short))).toContain('expires in 9 days')
    expect((await peer('localhost', ports.long)).authorized).toBe(false)
  })

  test('fails an untrusted certificate, though the page itself then cannot be fetched', async () => {
    const outcome = await tls({ asset: { id: 'site', kind: 'website', url: `https://localhost:${ports.long}/` } } as Context)
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toStartWith('the certificate of localhost is not trusted')
  })
})

test('a site on http:// fails', async () => {
  const outcome = await tls({ asset: { id: 'site', kind: 'website', url: 'http://localhost:1/' } } as Context)
  expect(outcome).toEqual({ state: 'fail', evidence: 'http://localhost:1/ is not served over HTTPS' })
})
