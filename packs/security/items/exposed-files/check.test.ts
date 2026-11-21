import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../../seo/fixture.ts'
import exposedFiles from './check.ts'

const page = html('<title>Acme</title>', '<h1>Acme</h1>')
const text = (body: string | Uint8Array, type = 'text/plain') => () => new Response(body, { headers: { 'content-type': type } })

// A soft 404: every path answers the home page with 200.
const soft = site({ '/': page }, [])
const softAll = Bun.serve({ port: 0, fetch: () => new Response(page, { headers: { 'content-type': 'text/html' } }) })
const leaky = site({
  '/': page,
  '/.git/HEAD': text('ref: refs/heads/main\n'),
  '/.env': text('DATABASE_URL=postgres://u:p@db/x\nSTRAPI_TOKEN=abc\n'),
  '/.DS_Store': text(new Uint8Array([0, 0, 0, 1, 66, 117, 100, 49, 0, 0]), 'application/octet-stream'),
  // an HTML page at a JSON path is a soft 404, not the settings file
  '/.vscode/settings.json': text('<!doctype html><html><body>404</body></html>', 'text/html'),
})
const forbidden = Bun.serve({ port: 0, fetch: () => new Response('Forbidden', { status: 403 }) })
afterAll(() => {
  for (const server of [soft.server, softAll, leaky.server, forbidden]) server.stop(true)
})

const ctx = (url: string) => ({ ...soft.ctx(), asset: { id: 'site', kind: 'website' as const, url } })

test('404s, 403s and soft 404 pages pass', async () => {
  expect((await exposedFiles(soft.ctx())).state).toBe('pass')
  const outcome = await exposedFiles(ctx(`http://localhost:${softAll.port}`))
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toContain("answered 200 with a page that isn't the file")
  expect((await exposedFiles(ctx(`http://localhost:${forbidden.port}`))).evidence).toContain('answered 403')
})

test('the real files fail, by their content', async () => {
  const outcome = await exposedFiles(leaky.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('/.git/HEAD, /.env, /.DS_Store')
  expect(outcome.evidence).not.toContain('.vscode')
  expect(outcome.evidence).toContain('environment secrets')
})

test('a site that does not answer is an error', async () => {
  expect((await exposedFiles(ctx('http://localhost:1'))).state).toBe('error')
})
