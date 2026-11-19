import type { Business, CellStatus, LoadedItem, LoadedPack, Worker } from '@justanarthur/modo-ui-standards'

/** A pack as `standards workspace` prints it: its loaded items in place of their ids. */
export interface CliPack extends Omit<LoadedPack, 'items' | 'entries'> {
  items: LoadedItem[]
}

/** `standards workspace`. */
export interface CliWorkspace {
  dir: string
  businesses: Business[]
  packs: CliPack[]
  workers: Worker[]
}

/** What the screens read: the workspace with its packs shaped as the kit takes them. */
export interface Model {
  dir: string
  businesses: Business[]
  packs: LoadedPack[]
  workers: Worker[]
}

/** Each business's cells, by business id. */
export type Status = Record<string, CellStatus[]>

export function toModel({ packs, ...workspace }: CliWorkspace): Model {
  return {
    ...workspace,
    packs: packs.map(({ items, ...pack }) => ({ ...pack, items: items.map(({ id, since }) => ({ id, since })), entries: items })),
  }
}

/** One NDJSON line as an object; anything else the CLI printed is skipped. */
export function parseLine(line: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(line)
    return value && typeof value === 'object' ? value : undefined
  } catch {
    return undefined
  }
}

/** `standards status` as each business's cells. */
export function toStatus(ndjson: string): Status {
  const status: Status = {}
  for (const line of ndjson.split('\n')) {
    const value = parseLine(line)
    if (value?.type !== 'cell') continue
    const { type: _, business, ...cell } = value as unknown as CellStatus & { type: 'cell'; business: string }
    ;(status[business] ??= []).push(cell)
  }
  return status
}
