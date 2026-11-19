import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cellsOf, checkCell } from './cells.ts'
import { loadWorkspace, type Workspace } from './load.ts'

let healthy = true

const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { origin, pathname } = new URL(request.url)
    const xml = (body: string) => new Response(body, { headers: { 'content-type': 'application/xml' } })
    if (pathname === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`)
    if (pathname === '/sitemap-index.xml') return xml(`<sitemapindex><sitemap><loc>${origin}/pages.xml</loc></sitemap></sitemapindex>`)
    if (pathname === '/pages.xml') {
      const urls = healthy ? ['/', '/about'] : ['/', '/about', '/gone', '/moved', 'https://staging.example.com/x']
      return xml(`<urlset>${urls.map(url => `<url><loc>${new URL(url, origin).href}</loc></url>`).join('')}</urlset>`)
    }
    if (pathname === '/' || pathname === '/about') return new Response('<h1>Acme</h1>')
    if (pathname === '/moved') return Response.redirect(`${origin}/about`, 301)
    return new Response('nope', { status: 404 })
  },
})

let dir = ''
let ws: Workspace

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'standards-'))
  const business = (id: string, packs: string) => `id: ${id}
name: ${id}
assets:
  - { id: site, kind: website, url: "http://localhost:${server.port}" }
packs: [${packs}]
`
  await Bun.write(join(dir, 'businesses/latest.yml'), business('latest', 'website'))
  await Bun.write(join(dir, 'businesses/pinned.yml'), business('pinned', 'website@1'))
  ws = await loadWorkspace(dir)
})

afterAll(async () => {
  server.stop()
  await rm(dir, { recursive: true })
})

const business = (id: string) => ws.businesses.find(b => b.id === id)!
const cell = (key: string) => cellsOf(business('latest'), ws).find(c => c.item.key === key)!

describe('pack versions', () => {
  test('a pinned business keeps the items of its version; an unpinned one follows the latest', () => {
    expect(cellsOf(business('pinned'), ws)).toHaveLength(8)
    expect(cellsOf(business('latest'), ws).map(c => c.item.key)).toContain('website/sitemap-health')
  })
})

describe('script check: website/sitemap-health', () => {
  test('passes when every sampled URL answers 200 on the same host', async () => {
    healthy = true
    const result = await checkCell(business('latest'), cell('website/sitemap-health'))
    expect(result.state).toBe('pass')
    expect(result.evidence).toContain('2 URLs')
  })

  test('fails on other hosts, 404s and redirects, following the sitemap index', async () => {
    healthy = false
    const result = await checkCell(business('latest'), cell('website/sitemap-health'))
    expect(result.state).toBe('fail')
    expect(result.evidence).toContain('1 of 5 URLs on another host')
    expect(result.evidence).toContain('2 of 4 sampled URLs')
    expect(result.evidence).toContain('→ 404')
    expect(result.evidence).toContain('→ 301')
  })
})

// Calls the real `claude` CLI with Haiku, so it costs a cent and needs a signed-in Claude Code.
describe.skipIf(!process.env.STANDARDS_AI_TESTS)('ai check: website/hero', () => {
  test('returns a verdict with evidence', async () => {
    const real = { ...business('latest'), assets: [{ id: 'site', kind: 'website' as const, url: 'https://example.com' }] }
    const result = await checkCell(real, { asset: real.assets[0]!, item: cell('website/hero').item })
    expect(['pass', 'fail']).toContain(result.state)
    expect(result.evidence.length).toBeGreaterThan(20)
  }, 120_000)
})
