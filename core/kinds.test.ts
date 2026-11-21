import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCheck } from './checks/index.ts'
import type { LoadedItem } from './load.ts'
import { Check, type Asset, type Business } from './schema.ts'

// A site: three pages in the sitemap, one with a duplicate title, one without a canonical; a DNS and a PSI endpoint.
const page = (title: string, canonical?: string, h1s = 1) =>
  `<html lang="sk"><head><title>${title}</title>${canonical ? `<link rel="canonical" href="${canonical}">` : ''}</head><body>${'<h1>x</h1>'.repeat(h1s)}</body></html>`
let psiAnswer: unknown = {}
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { origin, pathname, searchParams } = new URL(request.url)
    const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    if (pathname === '/robots.txt') return new Response(`Sitemap: ${origin}/sitemap.xml`)
    if (pathname === '/sitemap.xml') return new Response(`<urlset>${['/', '/a', '/b', '/c'].map(p => `<url><loc>${origin}${p}</loc></url>`).join('')}</urlset>`)
    if (pathname === '/') return html(page('Home of Acme rentals', `${origin}/`))
    if (pathname === '/a') return html(page('Vans for every move', `${origin}/a`))
    if (pathname === '/b') return html(page('Vans for every move', `${origin}/`, 2))
    if (pathname === '/c') return new Response('gone', { status: 404 })
    if (pathname === '/dns') {
      const name = searchParams.get('name')
      const answers: Record<string, { type: number; data: string }[]> = {
        'acme.test': [{ type: 16, data: '"google-site-verification=x"' }, { type: 16, data: '"v=spf1 include:_spf.google.com" " ~all"' }],
        '_dmarc.acme.test': [{ type: 16, data: '"v=DMARC1; p=none"' }],
      }
      return Response.json({ Status: 0, Answer: answers[name ?? ''] ?? [] })
    }
    if (pathname === '/psi') return Response.json(psiAnswer)
    return new Response('nope', { status: 404 })
  },
})

const asset = (extra: Partial<Asset> = {}): Asset => ({ id: 'site', kind: 'website', url: `http://localhost:${server.port}`, ...extra })
const business = { id: 'acme', name: 'Acme', assets: [], packs: [], waivers: [] } as Business
const run = (check: unknown, a = asset(), wsDir?: string) =>
  runCheck({ business, asset: a, item: { check: Check.parse(check) } as LoadedItem, wsDir })

let repoDir = ''
beforeAll(async () => {
  process.env.STANDARDS_DOH_URL = `http://localhost:${server.port}/dns`
  process.env.STANDARDS_PSI_URL = `http://localhost:${server.port}/psi`
  repoDir = await mkdtemp(join(tmpdir(), 'standards-kinds-'))
  await Bun.write(join(repoDir, 'brand/logo.svg'), '<svg/>')
  await Bun.write(join(repoDir, 'app/page.tsx'), "export const dynamic = 'force-dynamic'\nexport default function Page() {}\n")
  await Bun.write(join(repoDir, 'app/layout.tsx'), 'export default function Layout() {}\n')
  for (const args of [['init', '-q'], ['add', '.']]) Bun.spawnSync(['git', ...args], { cwd: repoDir })
})
afterAll(async () => {
  server.stop(true)
  await rm(repoDir, { recursive: true, force: true })
})

describe('crawl', () => {
  test('holds every sampled page to the expectations, finds duplicates, and names the pages', async () => {
    const outcome = await run({
      kind: 'crawl',
      pages: 10,
      expect: [
        { select: 'title', unique: true },
        { select: 'link[rel=canonical]', attr: 'href', self: true },
        { select: 'h1', max_count: 1 },
      ],
    })
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('/c answered 404')
    expect(outcome.evidence).toContain('/b: link[rel=canonical] @href is http://localhost')
    expect(outcome.evidence).toContain('/b: 2 h1')
    expect(outcome.evidence).toContain('title "Vans for every move" on both /a and /b')
    expect(outcome.evidence).toContain('(3 pages checked)')
  })

  test('an optional value may be missing; a present one is held to the assertion', async () => {
    const ok = await run({ kind: 'crawl', pages: 3, expect: [{ select: 'meta[name=robots]', attr: 'content', optional: true, not_matches: 'noindex' }] })
    // three pages: the home page and two of the sitemap's, spread over it (/a, /b)
    expect(ok).toEqual({ state: 'pass', evidence: '3 pages (the home page and a sample of the sitemap)' })
  })
})

describe('dns', () => {
  test('one record of a name that holds is enough; TXT parts are joined', async () => {
    const outcome = await run({
      kind: 'dns',
      records: [
        { type: 'TXT', expect: { matches: '^v=spf1 .*~all$' } },
        { name: '_dmarc', type: 'TXT', expect: { matches: 'p=(quarantine|reject)' } },
        { name: 'nothing', type: 'TXT' },
      ],
    }, asset({ url: 'https://www.acme.test' }))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('TXT _dmarc.acme.test does not match /p=(quarantine|reject)/ ("v=DMARC1; p=none")')
    expect(outcome.evidence).toContain('no TXT nothing.acme.test record')
    expect(outcome.evidence).not.toContain('spf1')
  })
})

describe('psi', () => {
  test("field data wins; the lab run stands in when there is none", async () => {
    const check = { kind: 'psi', field: { lcp_ms: 2500, inp_ms: 200, cls: 0.1 }, lab: { performance: 0.9 } }
    psiAnswer = {
      loadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 3100 }, INTERACTION_TO_NEXT_PAINT: { percentile: 120 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 4 } } },
      lighthouseResult: { categories: { performance: { score: 0.93 } } },
    }
    const field = await run(check)
    expect(field.state).toBe('fail')
    expect(field.evidence).toContain('LCP 3.1 s, over 2.5 s; INP 120 ms; CLS 0.04; (field, mobile); Lighthouse performance 93')

    psiAnswer = {
      lighthouseResult: { categories: { performance: { score: 0.95 } }, audits: { 'largest-contentful-paint': { numericValue: 1800 }, 'cumulative-layout-shift': { numericValue: 0.02 } } },
    }
    const lab = await run(check)
    expect(lab).toEqual({ state: 'pass', evidence: `http://localhost:${server.port}/: LCP 1.8 s; CLS 0.02; (lab: no field data, mobile); Lighthouse performance 95` })
  })
})

describe('repo', () => {
  test('glob counts tracked files; grep finds a pattern, or with none forbids it', async () => {
    const a = asset({ kind: 'repo', path: repoDir })
    expect(await run({ kind: 'repo', expect: [{ glob: 'brand/**/*.svg' }] }, a)).toMatchObject({ state: 'pass' })
    expect((await run({ kind: 'repo', expect: [{ glob: '{AGENTS,CLAUDE}.md' }] }, a)).evidence).toBe('0 tracked files match {AGENTS,CLAUDE}.md, expected at least 1')
    const segment = await run({ kind: 'repo', expect: [{ grep: '^export const (dynamic|revalidate)\\b', in: 'app/**/*.{ts,tsx}', none: true }] }, a)
    expect(segment).toEqual({ state: 'fail', evidence: '/^export const (dynamic|revalidate)\\b/ in app/page.tsx:1' })
    expect(await run({ kind: 'repo', expect: [{ grep: 'Layout', in: 'app/**' }] }, a)).toMatchObject({ state: 'pass' })
  })
})

describe('http', () => {
  test('sends the request headers, and counts elements', async () => {
    const outcome = await run({ kind: 'http', requests: [{ path: '/b', headers: { 'user-agent': 'GPTBot/1.0' }, expect: [{ status: 200 }, { select: 'h1', max_count: 1 }] }] })
    expect(outcome).toEqual({ state: 'fail', evidence: `2 h1 on http://localhost:${server.port}/b, expected at most 1` })
  })
})
