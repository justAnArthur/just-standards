import { afterAll, beforeAll, expect, test } from 'bun:test'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readable } from './checks/ai.ts'
import { loadWorkspace } from './load.ts'
import { checkPreview, previewUrl, secretOf } from './preview.ts'
import type { RunRecord } from './schema.ts'

const SECRET = 'not-a-real-bypass'
let dir = ''
let server: ReturnType<typeof Bun.serve>
// A preview of https://acme.example: its sitemap and canonicals name production, and it says noindex of its own.
const PROD = 'https://acme.example'
const aliased = Bun.serve({
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url)
    const page = (path: string) =>
      new Response(`<html lang="en"><head><title>Acme ${path}</title><link rel="canonical" href="${PROD}${path}"></head><body><h1>Acme</h1></body></html>`, {
        headers: { 'content-type': 'text/html', 'x-robots-tag': 'noindex' },
      })
    if (pathname === '/robots.txt') return new Response(`Sitemap: ${PROD}/sitemap.xml`)
    if (pathname === '/sitemap.xml') return new Response(`<urlset><url><loc>${PROD}/</loc></url><url><loc>${PROD}/a</loc></url></urlset>`)
    if (pathname === '/' || pathname === '/a') return page(pathname)
    return new Response('nope', { status: 404 })
  },
})
const gh = process.env.STANDARDS_GH_BIN

// A Vercel preview: without the bypass header it sends you to sign in.
beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    fetch: request =>
      request.headers.get('x-vercel-protection-bypass') === SECRET
        ? new Response('<html></html>', { headers: { 'strict-transport-security': 'max-age=63072000', 'x-content-type-options': 'nosniff' } })
        : new Response(null, { status: 302, headers: { location: 'https://vercel.com/sso-api?url=x' } }),
  })
  dir = await mkdtemp(join(tmpdir(), 'standards-preview-'))
  const fake = join(dir, 'gh')
  await Bun.write(
    fake,
    `#!/bin/sh
case "$2" in
  "repos/acme/site/deployments?sha=abc1234") echo '[{"id":2},{"id":1}]' ;;
  "repos/acme/site/deployments/2/statuses") echo '[{"state":"failure"}]' ;;
  "repos/acme/site/deployments/1/statuses") echo '[{"state":"success","environment_url":"${server.url.origin}"},{"state":"in_progress"}]' ;;
  "repos/acme/alias/deployments?sha=abc1234") echo '[{"id":9}]' ;;
  "repos/acme/alias/deployments/9/statuses") echo '[{"state":"success","environment_url":"${aliased.url.origin}"}]' ;;
  *) echo '[]' ;;
esac
`,
  )
  await chmod(fake, 0o755)
  process.env.STANDARDS_GH_BIN = fake
  const site = { id: 'site', kind: 'website', url: 'https://acme.example', repo: 'acme/site' }
  await Bun.write(join(dir, 'businesses/acme.yml'), JSON.stringify({ id: 'acme', name: 'Acme', assets: [{ ...site, vercel_bypass: 'acme-bypass' }], packs: ['website'] }))
  await Bun.write(join(dir, 'businesses/open.yml'), JSON.stringify({ id: 'open', name: 'Open', assets: [site], packs: ['website'] }))
  await Bun.write(join(dir, 'secrets.yml'), `acme-bypass: ${SECRET}\n`)
  await Bun.write(
    join(dir, 'businesses/alias.yml'),
    JSON.stringify({ id: 'alias', name: 'Alias', assets: [{ id: 'site', kind: 'website', url: PROD, repo: 'acme/alias' }], packs: ['seo', 'website'] }),
  )
})

afterAll(async () => {
  server.stop(true)
  aliased.stop(true)
  process.env.STANDARDS_GH_BIN = gh
  await rm(dir, { recursive: true, force: true })
})

const record = (business: string) => ({ business, asset: 'site', items: ['website/security-headers'] }) as RunRecord

test('the preview is the newest successful deployment of the commit', async () => {
  expect(await previewUrl('acme/site', 'abc1234')).toBe(server.url.origin)
  expect(await previewUrl('acme/site', 'fff0000')).toBeUndefined()
})

test("checks the run's items on the preview, through its protection bypass", async () => {
  const ws = await loadWorkspace(dir)
  const preview = await checkPreview(ws, record('acme'), 'abc1234')
  expect(preview).toMatchObject({ sha: 'abc1234', url: server.url.origin })
  expect(preview.note).toBeUndefined()
  expect(preview.results).toHaveLength(1)
  expect(preview.results[0]).toMatchObject({ item: 'website/security-headers', state: 'pass', evidence: `${server.url.origin}/` })
})

test('says why nothing was checked: a protected preview without a bypass, or no deployment yet', async () => {
  const ws = await loadWorkspace(dir)
  const locked = await checkPreview(ws, record('open'), 'abc1234')
  expect(locked.results).toEqual([])
  expect(locked.note).toContain('is protected: set vercel_bypass on site')
  expect((await checkPreview(ws, record('acme'), 'fff0000')).note).toBe('no preview deployment of fff0000 yet')
})

test("a preview stands in for production: its production URLs are read from it, and its own noindex doesn't count", async () => {
  const ws = await loadWorkspace(dir)
  const items = ['seo/canonical-self', 'seo/indexable', 'website/tls']
  const preview = await checkPreview(ws, { business: 'alias', asset: 'site', items, worktree: '/nowhere' } as RunRecord, 'abc1234')
  expect(preview).toMatchObject({ url: aliased.url.origin, skipped: ['website/tls'] })
  expect(preview.results.map(r => [r.item, r.state, r.evidence])).toEqual([
    ['seo/canonical-self', 'pass', '2 pages (the home page and a sample of the sitemap)'],
    ['seo/indexable', 'pass', '2 pages (the home page and a sample of the sitemap)'],
  ])
})

test('a missing secret names the file', async () => {
  expect(secretOf(dir, 'nope')).rejects.toThrow(`no secret nope in ${join(dir, 'secrets.yml')}`)
})

test('an AI check reads the page without scripts, styles, SVG, comments or class names', async () => {
  const html = `<html><head><style>h1{color:red}</style><script>alert(1)</script></head>
    <body class="a b"><!-- note --><h1 class="text-4xl" data-x="1">Invoices,   approved.</h1><svg><path d="M0"/></svg>
    <a href="/contact" style="color:red">Start free</a></body></html>`
  expect(await readable(html)).toBe('<html><head></head>\n<body><h1>Invoices, approved.</h1>\n<a href="/contact">Start free</a></body></html>')
})
