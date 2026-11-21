import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '../../core/checks/context.ts'
import type { LoadedItem } from '../../core/load.ts'
import type { Asset, Business } from '../../core/schema.ts'

/** A git repo in a temp dir with these files tracked. */
export async function gitRepo(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'standards-pack-'))
  for (const [path, text] of Object.entries(files)) await Bun.write(join(dir, path), text)
  for (const args of [['init', '-q'], ['add', '.']]) Bun.spawnSync(['git', ...args], { cwd: dir })
  return dir
}

const business = { id: 'acme', name: 'Acme', assets: [], packs: [], waivers: [] } as unknown as Business

export const contextOf = (asset: Partial<Asset>): Context => ({
  business,
  asset: { id: 'repo', kind: 'repo', ...asset } as Asset,
  item: {} as LoadedItem,
})
