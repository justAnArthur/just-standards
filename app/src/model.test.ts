import { expect, test } from 'bun:test'
import { itemsOf } from '@justanarthur/modo-ui-standards'
import { type CliWorkspace, toModel, toStatus } from './model'
import workspace from './native/fixtures/workspace.json'

const status = await Bun.file(`${import.meta.dir}/native/fixtures/status.ndjson`).text()

const model = toModel(workspace as CliWorkspace)

test('packs: the printed items become the entries, their ids the items', () => {
  const website = model.packs.find(pack => pack.id === 'website')!
  expect(website.entries.map(item => item.key)).toContain('website/og-video')
  expect(website.items[0]).toEqual({ id: 'meta-basics', since: 1 })
  expect(website.items.length).toBe(website.entries.length)
  expect(website.changelog.length).toBeGreaterThan(0)
})

test('packs: a business pinned to an older version gets only its items', () => {
  const modo = model.businesses.find(business => business.id === 'modo')!
  const website = model.packs.find(pack => pack.id === 'website')!
  expect(itemsOf(modo, website).map(item => item.id)).not.toContain('hero')
})

test('status: cells by business, without the line type or business', () => {
  const cells = toStatus(status)
  expect(Object.keys(cells)).toEqual(model.businesses.map(business => business.id))
  const modo = cells.modo!
  expect(modo.find(cell => cell.state === 'waived')?.waiver?.reason).toContain('GitHub Pages')
  expect(modo[0]).not.toHaveProperty('type')
  expect(modo[0]).not.toHaveProperty('business')
})

test('status: skips blank and stray lines', () => {
  const line = '{"type":"cell","business":"b","asset":"site","item":"website/icons","title":"Icons","state":"unchecked"}'
  expect(toStatus(`\nnot json\n${line}\n{"type":"other"}\n`)).toEqual({
    b: [{ asset: 'site', item: 'website/icons', title: 'Icons', state: 'unchecked' }],
  })
})
