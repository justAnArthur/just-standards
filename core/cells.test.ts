import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cellsOf, checkBusiness, statusOf } from './cells.ts'
import { loadWorkspace, type Workspace } from './load.ts'
import { fixPrompt } from './prompt.ts'
import type { Result } from './schema.ts'

const page = (origin: string) => `<!doctype html><html lang="en"><head>
<title>Widgets for every workshop · Acme</title>
<meta name="description" content="Acme makes widgets that fit every workshop, shipped in a day across Europe.">
<link rel="canonical" href="https://acme.example/">
<meta property="og:video" content="${origin}/og/loop.mp4"><meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="1280"><meta property="og:video:height" content="720">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
</head><body></body></html>`

const server = Bun.serve({
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/') return new Response(page(new URL(request.url).origin), { headers: { 'content-type': 'text/html' } })
    if (path === '/og/loop.mp4') return new Response(new Uint8Array(10), { headers: { 'content-type': 'video/mp4' } })
    return new Response('nope', { status: 404 })
  },
})

let dir = ''
let ws: Workspace

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'standards-'))
  await Bun.write(
    join(dir, 'businesses/acme.yml'),
    `id: acme
name: Acme
assets:
  - { id: site, kind: website, url: "http://localhost:${server.port}" }
  - { id: repo, kind: repo, repo: acme/widgets }
packs: [website@1]
waivers:
  - { item: website/security-headers, reason: GitHub Pages }
`,
  )
  ws = await loadWorkspace(dir)
})

afterAll(async () => {
  server.stop()
  await rm(dir, { recursive: true })
})

describe('cells', () => {
  test('an adopted pack applies its items to assets of a matching kind only', () => {
    const cells = cellsOf(ws.businesses[0]!, ws)
    expect(cells).toHaveLength(8)
    expect(cells.every(cell => cell.asset.id === 'site')).toBe(true)
  })

  test('checks run, results are saved, and status reads them back', async () => {
    const business = ws.businesses[0]!
    const wanted = ['website/meta-basics', 'website/og-video', 'website/structured-data', 'website/llms-txt', 'website/security-headers']
    const cells = cellsOf(business, ws).filter(cell => wanted.includes(cell.item.key))
    const seen: Result[] = []
    await checkBusiness(ws, business, cells, result => seen.push(result))

    const by = Object.fromEntries(seen.map(result => [result.item, result]))
    expect(Object.keys(by)).toHaveLength(4)
    expect(by['website/meta-basics']?.state).toBe('pass')
    expect(by['website/og-video']?.state).toBe('pass')
    expect(by['website/structured-data']?.state).toBe('pass')
    expect(by['website/llms-txt']?.state).toBe('fail')
    expect(by['website/llms-txt']?.evidence).toContain('answered 404')

    const status = Object.fromEntries((await statusOf(ws, business)).map(cell => [cell.item, cell.state]))
    expect(status['website/og-video']).toBe('pass')
    expect(status['website/security-headers']).toBe('waived')
    expect(status['website/icons']).toBe('unchecked')
  })

  test('the fix prompt carries the evidence, the recipe and the house rules', async () => {
    const prompt = await fixPrompt(ws, ws.businesses[0]!, 'site', ['website/llms-txt'], 'standards/llms-txt')
    expect(prompt).toContain('answered 404')
    expect(prompt).toContain('llmstxt.org')
    expect(prompt).toContain('`standards/llms-txt`')
    expect(prompt).toContain('No `Co-Authored-By`')
  })
})
