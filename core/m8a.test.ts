import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { statusOf } from './cells.ts'
import { fix } from './fix.ts'
import { recheckLabeled } from './labels.ts'
import { ConfigError, loadWorkspace } from './load.ts'
import { fixPrompt, specOf } from './prompt.ts'
import type { Result } from './schema.ts'

const server = Bun.serve({ port: 0, fetch: () => new Response('<html lang="en"></html>') })
const HOUR = 60 * 60_000
const NOW = Date.parse('2026-11-21T12:00:00Z')
let dir = ''
const gh = process.env.STANDARDS_GH_BIN

const item = (id: string, extra: string) => `id: ${id}
version: 1
title: The ${id}
why: because
${extra}`

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'standards-m8a-'))
  const write = (path: string, text: string) => Bun.write(join(dir, path), text)
  await write('packs/kit/pack.yml', 'id: kit\nversion: 1\ntitle: Kit\nitems: [brand, video, odd]\n')
  await write('packs/kit/items/brand/item.yml', item('brand', 'applies_to: [repo]\ncategory: brand\nseverity: must\ncheck: { kind: repo, expect: [{ file: brand/logo.svg }] }\n'))
  await write(
    'packs/kit/items/video/item.yml',
    item('video', `applies_to: [website]\ncategory: sharing\nrequires: [kit/brand]\ntools: [sh]\ncheck: { kind: http, requests: [{ path: /, expect: [{ status: 200 }] }] }\n`),
  )
  await write('packs/kit/items/video/recipe.md', 'Make the video from the brand folder.\n')
  await write(
    'packs/kit/items/odd/item.yml',
    item('odd', 'applies_to: [website]\ncategory: seo\nseverity: nice\ntools: [definitely-not-installed-xyz]\ncheck: { kind: http, requests: [{ path: /, expect: [{ status: 200 }] }] }\n'),
  )
  const url = `http://localhost:${server.port}`
  await write(
    'businesses/acme.yml',
    `id: acme
name: Acme
assets:
  - { id: site, kind: website, url: "${url}", repo: acme/widgets, path: ${dir}, stack: tiny }
  - { id: shop, kind: website, url: "${url}", repo: Acme/Widgets }
  - { id: code, kind: repo, repo: acme/widgets }
  - { id: other, kind: website, url: "${url}", repo: acme/other }
packs: [kit]
worker: w
`,
  )
  await write('workers.yml', '- { id: w, runtime: claude-code, model: haiku }\n')
  await write('businesses/acme.context.md', 'Acme sells widgets in Slovak and English.\n')
  await write('stacks/tiny.md', 'Tiny stack: no build step.\n')

  const fake = join(dir, 'gh')
  await write(
    'gh',
    `#!/bin/sh
case "$1 $2" in
  "pr list") [ "$4" = acme/widgets ] && cat "${dir}/merged.json" || echo "[]"; exit 0 ;;
  "api repos/acme/widgets/deployments?sha=aaa") echo '[{"id":1,"environment":"Production","production_environment":true}]' ;;
  "api repos/acme/widgets/deployments/1/statuses") echo '[{"state":"success"}]' ;;
  "api repos/acme/widgets/deployments?sha=bbb") echo '[{"id":2,"environment":"Production","production_environment":true}]' ;;
  "api repos/acme/widgets/deployments/2/statuses") echo '[{"state":"in_progress"}]' ;;
  *) echo '[]' ;;
esac
`,
  )
  await chmod(fake, 0o755)
  process.env.STANDARDS_GH_BIN = fake
})

afterAll(async () => {
  server.stop(true)
  process.env.STANDARDS_GH_BIN = gh
  await rm(dir, { recursive: true, force: true })
})

const result = (asset: string, key: string, state: Result['state']): Result => ({
  business: 'acme',
  asset,
  item: key,
  item_version: 1,
  state,
  evidence: state,
  checked_at: new Date().toISOString(),
  ms: 1,
})

async function results(...list: Result[]) {
  await Bun.write(join(dir, '.state/results/acme.json'), JSON.stringify(Object.fromEntries(list.map(r => [`${r.asset}:${r.item}`, r]))))
}

describe('requires', () => {
  test('a failing cell is blocked while what it requires fails on an asset of the same repo, and only then', async () => {
    const ws = await loadWorkspace(dir)
    await results(result('site', 'kit/video', 'fail'), result('other', 'kit/video', 'fail'), result('code', 'kit/brand', 'fail'))
    const cells = await statusOf(ws, ws.businesses[0]!)
    const of = (asset: string, key: string) => cells.find(c => c.asset === asset && c.item === key)
    expect(of('site', 'kit/video')).toMatchObject({ state: 'fail', blocked_by: ['kit/brand'] })
    // the repo's case doesn't matter
    expect(of('shop', 'kit/video')?.blocked_by).toEqual(['kit/brand'])
    // acme/other has no brand cell: nothing to wait on
    expect(of('other', 'kit/video')?.blocked_by).toBeUndefined()

    await results(result('site', 'kit/video', 'fail'), result('code', 'kit/brand', 'pass'))
    expect((await statusOf(ws, ws.businesses[0]!)).find(c => c.asset === 'site' && c.item === 'kit/video')?.blocked_by).toBeUndefined()
  })

  test('a fix run refuses a blocked cell, and items whose tools are missing', async () => {
    const ws = await loadWorkspace(dir)
    const business = ws.businesses[0]!
    await results(result('code', 'kit/brand', 'fail'))
    const options = { worker: 'w', emit: () => {} }
    expect(fix(ws, business, 'site', ['kit/video'], options)).rejects.toThrow('kit/video on site is blocked by kit/brand: fix that first')
    expect(fix(ws, business, 'site', ['kit/odd'], options)).rejects.toThrow("kit/odd needs definitely-not-installed-xyz, which isn't installed")
  })

  test('a requires that names no loaded item is a config error', async () => {
    const other = await mkdtemp(join(tmpdir(), 'standards-req-'))
    await Bun.write(join(other, 'packs/x/pack.yml'), 'id: x\nversion: 1\ntitle: X\nitems: [a]\n')
    await Bun.write(join(other, 'packs/x/items/a/item.yml'), item('a', 'applies_to: [website]\ncategory: seo\nrequires: [nope/none]\ncheck: { kind: http, requests: [{ expect: [{ status: 200 }] }] }\n'))
    expect(loadWorkspace(other)).rejects.toThrow(ConfigError)
    expect(loadWorkspace(other)).rejects.toThrow('requires nope/none, which no pack has')
    await rm(other, { recursive: true, force: true })
  })
})

describe('briefs', () => {
  test('a fix prompt carries the business context, the stack notes, the sites sharing the repo and the tools', async () => {
    const ws = await loadWorkspace(dir)
    const prompt = await fixPrompt(ws, ws.businesses[0]!, 'site', ['kit/video'], 'standards/site-video', { tools: ['sh'] })
    expect(prompt).toContain('## About Acme\n\nAcme sells widgets in Slovak and English.')
    expect(prompt).toContain('## Notes on the tiny stack\n\nTiny stack: no build step.')
    expect(prompt).toContain('The same repo also serves: shop (http://localhost:')
    expect(prompt).not.toContain('other (')
    expect(prompt).toContain('- Installed for these standards: `sh`')
    expect(prompt).toContain('## The video (`kit/video` v1, should)')
    expect(prompt).toContain('Builds on: `kit/brand`.')
  })

  test('a spec lists every adopted standard by category, with its state, and filters by severity', async () => {
    const ws = await loadWorkspace(dir)
    await results(result('site', 'kit/video', 'pass'))
    const spec = await specOf(ws, ws.businesses[0]!, 'site')
    expect(spec).toStartWith('# Standards for Acme / site')
    // categories in the schema's order: seo before sharing
    expect(spec.indexOf('## seo')).toBeLessThan(spec.indexOf('## sharing'))
    expect(spec).toContain('| sharing | The video (`kit/video`) | should | ✓ |')
    expect(spec).toContain('| seo | The odd (`kit/odd`) | nice | · |')
    expect(spec).toContain('#### Recipe\n\nMake the video from the brand folder.')
    const shoulds = await specOf(ws, ws.businesses[0]!, 'site', { severities: ['should'] })
    expect(shoulds).not.toContain('kit/odd')
  })
})

describe('labels', () => {
  test('re-checks only the labeled items of PRs whose production deployment succeeded, on every asset of the repo', async () => {
    const ws = await loadWorkspace(dir)
    await results()
    const merged = [
      { number: 5, url: 'https://github.com/acme/widgets/pull/5', mergedAt: new Date(NOW - HOUR).toISOString(), mergeCommit: { oid: 'aaa' }, labels: [{ name: 'std:kit/video' }, { name: 'bug' }] },
      { number: 6, url: 'https://github.com/acme/widgets/pull/6', mergedAt: new Date(NOW - HOUR).toISOString(), mergeCommit: { oid: 'ccc' }, labels: [] },
      { number: 7, url: 'https://github.com/acme/widgets/pull/7', mergedAt: new Date(NOW - 60_000).toISOString(), mergeCommit: { oid: 'bbb' }, labels: [{ name: 'std:kit/odd' }] },
    ]
    await Bun.write(join(dir, 'merged.json'), JSON.stringify(merged))

    const first = await recheckLabeled(ws, () => {}, NOW)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ repo: 'acme/widgets', pr: 5, items: ['kit/video'] })
    expect(first[0]!.cells).toEqual([
      { business: 'acme', asset: 'site', item: 'kit/video' },
      { business: 'acme', asset: 'shop', item: 'kit/video' },
    ])
    const saved = await Bun.file(join(dir, '.state/results/acme.json')).json()
    expect(Object.keys(saved).sort()).toEqual(['shop:kit/video', 'site:kit/video'])
    expect((await Bun.file(join(dir, '.state/labels.json')).json())['acme/widgets'].pending).toEqual([7])

    // #5 is done; #7 still waits on its deployment
    expect(await recheckLabeled(ws, () => {}, NOW + 60_000)).toEqual([])
    // after two hours it is checked anyway
    const later = await recheckLabeled(ws, () => {}, NOW + 3 * HOUR)
    expect(later.map(r => r.pr)).toEqual([7])
  })
})
