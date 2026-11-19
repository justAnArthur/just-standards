import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { z } from 'zod'
import { Business, Item, Pack, Worker } from './schema.ts'

export const BUNDLED_PACKS = join(import.meta.dir, '../packs')

export interface LoadedItem extends Item {
  pack: string
  /** `pack/item` */
  key: string
  /** the pack version that added it */
  since: number
  dir: string
}

export interface LoadedPack extends Pack {
  dir: string
  entries: LoadedItem[]
}

export interface Workspace {
  dir: string
  businesses: Business[]
  workers: Worker[]
  packs: Map<string, LoadedPack>
}

export class ConfigError extends Error {}

export const expandHome = (path: string) => (path.startsWith('~/') || path === '~' ? join(homedir(), path.slice(1)) : path)

async function readYaml<S extends z.ZodType>(file: string, schema: S): Promise<z.infer<S>> {
  const text = await Bun.file(file).text()
  let data: unknown
  try {
    data = Bun.YAML.parse(text)
  } catch (error) {
    throw new ConfigError(`${file}: ${(error as Error).message}`)
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    throw new ConfigError(`${file}:\n${issues.join('\n')}`)
  }
  return parsed.data
}

async function subdirs(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
}

async function loadPack(dir: string): Promise<LoadedPack> {
  const pack = await readYaml(join(dir, 'pack.yml'), Pack)
  const entries = await Promise.all(
    pack.items.map(async ref => {
      const { id, since } = typeof ref === 'string' ? { id: ref, since: 1 } : ref
      const itemDir = join(dir, 'items', id)
      const item = await readYaml(join(itemDir, 'item.yml'), Item)
      if (item.id !== id) throw new ConfigError(`${itemDir}/item.yml: id is ${item.id}, pack.yml lists ${id}`)
      return { ...item, pack: pack.id, key: `${pack.id}/${id}`, since, dir: itemDir }
    }),
  )
  return { ...pack, dir, entries }
}

/** Later directories override earlier ones pack by pack, so a workspace can replace a bundled pack. */
export async function loadPacks(dirs: string[]) {
  const packs = new Map<string, LoadedPack>()
  for (const dir of dirs) {
    for (const name of await subdirs(dir)) {
      if (!(await Bun.file(join(dir, name, 'pack.yml')).exists())) continue
      const pack = await loadPack(join(dir, name))
      packs.set(pack.id, pack)
    }
  }
  return packs
}

export async function loadWorkspace(dir: string, bundled = BUNDLED_PACKS): Promise<Workspace> {
  const root = expandHome(dir)
  const businessDir = join(root, 'businesses')
  const files = (await readdir(businessDir).catch(() => [])).filter(file => /\.ya?ml$/.test(file)).sort()
  const businesses = await Promise.all(files.map(file => readYaml(join(businessDir, file), Business)))
  const workersFile = join(root, 'workers.yml')
  const workers = (await Bun.file(workersFile).exists()) ? await readYaml(workersFile, Worker.array()) : []
  const packs = await loadPacks([bundled, join(root, 'packs')])

  for (const business of businesses) {
    for (const ref of business.packs) {
      const id = ref.split('@')[0] as string
      if (!packs.has(id)) throw new ConfigError(`businesses/${business.id}: no pack ${id}`)
    }
    if (business.worker && !workers.some(worker => worker.id === business.worker)) {
      throw new ConfigError(`businesses/${business.id}: no worker ${business.worker} in workers.yml`)
    }
  }
  return { dir: root, businesses, workers, packs }
}
