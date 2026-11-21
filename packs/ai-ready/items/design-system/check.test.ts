import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { runCheck } from '../../../../core/checks/index.ts'
import type { LoadedItem } from '../../../../core/load.ts'
import { Item } from '../../../../core/schema.ts'
import { contextOf, gitRepo } from '../../fixture.ts'

const item = Item.parse(Bun.YAML.parse(await Bun.file(join(import.meta.dir, 'item.yml')).text())) as LoadedItem
const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo(files)
  dirs.push(dir)
  return runCheck({ ...contextOf({ path: dir }), item })
}

test('a design doc, stories or a Storybook config pass; tokens alone do not', async () => {
  for (const path of ['DESIGN.md', 'packages/ui/DESIGN.md', 'docs/design.md', 'src/Button.stories.tsx', '.storybook/main.ts', 'docs/design-system/tokens.md']) {
    expect({ path, state: (await run({ [path]: 'x' })).state }).toEqual({ path, state: 'pass' })
  }
  expect((await run({ 'src/tokens.css': ':root{}', 'README.md': '' })).state).toBe('fail')
})
