import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runCheck } from './checks/index.ts'
import type { LoadedItem, Workspace } from './load.ts'
import type { Asset, Business, Result } from './schema.ts'

const STALE_DAYS = 7
const CONCURRENCY = 6

export interface Cell {
  asset: Asset
  item: LoadedItem
}

export type CellState = 'pass' | 'pass-older' | 'fail' | 'error' | 'stale' | 'unchecked' | 'waived'

export interface CellStatus {
  asset: string
  item: string
  title: string
  state: CellState
  result?: Result
  waiver?: Business['waivers'][number]
}

const cellKey = (asset: string, item: string) => `${asset}:${item}`
const today = () => new Date().toISOString().slice(0, 10)

/** The cells a business has: each adopted pack's items at its version, on the assets of a matching kind. */
export function cellsOf(business: Business, ws: Workspace): Cell[] {
  return business.packs.flatMap(ref => {
    const [id, pinned] = ref.split('@') as [string, string | undefined]
    const pack = ws.packs.get(id)
    if (!pack) return []
    const version = pinned ? Number(pinned) : pack.version
    const items = pack.entries.filter(item => item.since <= version)
    return items.flatMap(item => business.assets.filter(asset => item.applies_to.includes(asset.kind)).map(asset => ({ asset, item })))
  })
}

export function waiverOf(business: Business, cell: Cell) {
  return business.waivers.find(
    waiver =>
      waiver.item === cell.item.key && (!waiver.asset || waiver.asset === cell.asset.id) && (!waiver.until || waiver.until >= today()),
  )
}

const resultsFile = (ws: Workspace, business: string) => join(ws.dir, '.state', 'results', `${business}.json`)

export async function readResults(ws: Workspace, business: string): Promise<Record<string, Result>> {
  const file = Bun.file(resultsFile(ws, business))
  return (await file.exists()) ? file.json() : {}
}

async function writeResults(ws: Workspace, business: string, results: Record<string, Result>) {
  await mkdir(join(ws.dir, '.state', 'results'), { recursive: true })
  await Bun.write(resultsFile(ws, business), `${JSON.stringify(results, null, 2)}\n`)
}

export async function checkCell(business: Business, cell: Cell): Promise<Result> {
  const started = performance.now()
  const outcome = await runCheck({ business, asset: cell.asset, item: cell.item })
  return {
    business: business.id,
    asset: cell.asset.id,
    item: cell.item.key,
    item_version: cell.item.version,
    ...outcome,
    checked_at: new Date().toISOString(),
    ms: Math.round(performance.now() - started),
  }
}

/** Checks the cells (waived ones skipped), reports each result as it lands, and saves them. */
export async function checkBusiness(ws: Workspace, business: Business, cells: Cell[], onResult: (result: Result) => void) {
  const queue = cells.filter(cell => !waiverOf(business, cell))
  const results = await readResults(ws, business.id)
  const worker = async () => {
    for (let cell = queue.shift(); cell; cell = queue.shift()) {
      const result = await checkCell(business, cell)
      results[cellKey(result.asset, result.item)] = result
      onResult(result)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  await writeResults(ws, business.id, results)
}

function stateOf(item: LoadedItem, result: Result | undefined): CellState {
  if (!result) return 'unchecked'
  const age = (Date.now() - Date.parse(result.checked_at)) / 86_400_000
  if (age > STALE_DAYS) return 'stale'
  if (result.state === 'pass' && result.item_version < item.version) return 'pass-older'
  return result.state
}

export async function statusOf(ws: Workspace, business: Business): Promise<CellStatus[]> {
  const results = await readResults(ws, business.id)
  return cellsOf(business, ws).map(cell => {
    const result = results[cellKey(cell.asset.id, cell.item.key)]
    const waiver = waiverOf(business, cell)
    const base = { asset: cell.asset.id, item: cell.item.key, title: cell.item.title, result }
    return waiver ? { ...base, state: 'waived', waiver } : { ...base, state: stateOf(cell.item, result) }
  })
}
