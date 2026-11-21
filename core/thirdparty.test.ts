import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cellsOf } from './cells.ts'
import { loadWorkspace } from './load.ts'
import { fixPrompt } from './prompt.ts'
import { checkSources } from './sources.ts'

let text = 'Use the Metadata API.'
const server = Bun.serve({ port: 0, fetch: req => (new URL(req.url).pathname === '/gone' ? new Response('no', { status: 404 }) : new Response(`<html><body><main>${text}</main><script>build=${Math.random()}</script></body></html>`, { headers: { 'content-type': 'text/html' } })) })
let dir = ''

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'standards-tp-'))
  const w = (path: string, body: string) => Bun.write(join(dir, path), body)
  await w('packs/fw/pack.yml', 'id: fw\nversion: 1\ntitle: Fw\nitems: [new-only, any]\n')
  const item = (id: string, extra: string) =>
    `id: ${id}\nversion: 1\ntitle: ${id}\nwhy: x\napplies_to: [repo]\ncategory: code\n${extra}check: { kind: repo, expect: [{ file: package.json }] }\n`
  await w('packs/fw/items/new-only/item.yml', item('new-only', `applies_when: { dependency: next, version: ">=15" }\nsources:\n  - { title: Production checklist, url: "${server.url.origin}/checklist" }\n  - { title: Old guide, url: "${server.url.origin}/gone" }\n`))
  await w('packs/fw/items/any/item.yml', item('any', 'applies_when: { dependency: next }\n'))
  await w('new/package.json', JSON.stringify({ dependencies: { next: '^16.3.0' } }))
  await w('old/package.json', JSON.stringify({ dependencies: { next: '13.4.12' } }))
  await w('none/package.json', JSON.stringify({ dependencies: { astro: '5.0.0' } }))
  const asset = (id: string) => `  - { id: ${id}, kind: repo, path: ${join(dir, id)} }`
  await w('businesses/acme.yml', `id: acme\nname: Acme\nassets:\n${['new', 'old', 'none', 'nowhere'].map(id => (id === 'nowhere' ? '  - { id: nowhere, kind: repo, repo: acme/x }' : asset(id))).join('\n')}\npacks: [fw]\n`)
})
afterAll(async () => {
  server.stop(true)
  await rm(dir, { recursive: true, force: true })
})

test('applies_when keeps an item to the assets whose checkout uses that dependency in that range', async () => {
  const ws = await loadWorkspace(dir)
  const cells = cellsOf(ws.businesses[0]!, ws).map(cell => `${cell.asset.id}:${cell.item.id}`)
  expect(cells.sort()).toEqual(['new:any', 'new:new-only', 'old:any'])
})

test('a fix prompt names the sources an item follows', async () => {
  const ws = await loadWorkspace(dir)
  const prompt = await fixPrompt(ws, ws.businesses[0]!, 'new', ['fw/new-only'], 'b')
  expect(prompt).toContain(`Follows: [Production checklist](${server.url.origin}/checklist), [Old guide](${server.url.origin}/gone). Where the source and the recipe differ, the source wins`)
})

test('sources: new, then the same despite noise in scripts, then changed when the text changes; a 404 is gone', async () => {
  const ws = await loadWorkspace(dir)
  // only this test's pack: the bundled packs cite real pages
  ws.packs = new Map([...ws.packs].filter(([id]) => id === 'fw'))
  const lockFile = join(dir, 'sources.lock.json')
  const states = async (update = true) => Object.fromEntries((await checkSources(ws, { update, lockFile })).map(c => [new URL(c.url).pathname, c.state]))
  expect(await states()).toEqual({ '/checklist': 'new', '/gone': 'gone' })
  expect(await states()).toEqual({ '/checklist': 'same', '/gone': 'gone' })
  text = 'Use the Metadata API, and cacheComponents.'
  expect(await states(false)).toEqual({ '/checklist': 'changed', '/gone': 'gone' })
  expect((await Bun.file(lockFile).json())[`${server.url.origin}/checklist`].items).toEqual(['fw/new-only'])
})
