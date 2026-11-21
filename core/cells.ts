import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runCheck } from './checks/index.ts'
import { dependencyVersion } from './deps.ts'
import { expandHome, type LoadedItem, type Workspace } from './load.ts'
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
  /** Required items that don't pass yet, on this asset or one sharing its repo: no worker is sent until they do. */
  blocked_by?: string[]
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
    return items.flatMap(item =>
      business.assets.filter(asset => item.applies_to.includes(asset.kind) && usesDependency(item, asset)).map(asset => ({ asset, item })),
    )
  })
}

/** An item with `applies_when` applies only where the asset's checkout has that dependency in that range. */
function usesDependency(item: LoadedItem, asset: Asset) {
  const when = item.applies_when
  if (!when) return true
  if (!asset.path) return false
  const version = dependencyVersion(expandHome(asset.path), when.dependency)
  if (!version) return false
  return !when.version || Bun.semver.satisfies(version, when.version)
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

export async function checkCell(business: Business, cell: Cell, wsDir?: string): Promise<Result> {
  const started = performance.now()
  const outcome = await runCheck({ business, asset: cell.asset, item: cell.item, wsDir })
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
      const result = await checkCell(business, cell, ws.dir)
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

const sameRepo = (a: Asset, b: Asset) => !!a.repo && !!b.repo && a.repo.toLowerCase() === b.repo.toLowerCase()

/**
 * The items `cell` requires that don't pass yet: each is looked for on the cell's asset and on assets sharing its repo
 * (a website needs the brand assets of its repo). A required item the business doesn't adopt blocks nothing.
 */
export function blockersOf(business: Business, ws: Workspace, cell: Cell, results: Record<string, Result>) {
  if (cell.item.requires.length === 0) return []
  const all = cellsOf(business, ws)
  return cell.item.requires.filter(key => {
    const related = all.filter(other => other.item.key === key && (other.asset.id === cell.asset.id || sameRepo(other.asset, cell.asset)))
    return related.length > 0 && !related.some(other => results[cellKey(other.asset.id, key)]?.state === 'pass' || waiverOf(business, other))
  })
}

export async function statusOf(ws: Workspace, business: Business): Promise<CellStatus[]> {
  const results = await readResults(ws, business.id)
  return cellsOf(business, ws).map(cell => {
    const result = results[cellKey(cell.asset.id, cell.item.key)]
    const waiver = waiverOf(business, cell)
    const base = { asset: cell.asset.id, item: cell.item.key, title: cell.item.title, result }
    if (waiver) return { ...base, state: 'waived', waiver }
    const state = stateOf(cell.item, result)
    const blocked = state === 'pass' ? [] : blockersOf(business, ws, cell, results)
    return blocked.length ? { ...base, state, blocked_by: blocked } : { ...base, state }
  })
}
