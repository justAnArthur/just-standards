import type { CellRun, CellStatus, Result } from '@justanarthur/modo-ui-standards'
import { parseLine, type Status } from './model'

/** What one `standards check` covers: everything, a business, or one cell of it. */
export interface Scope {
  business?: string
  asset?: string
  /** `pack/item` */
  item?: string
}

// The kit has no "checking" state: a pending cell borrows the running look, and an empty worker draws "…" in it.
const CHECKING: CellRun = { state: 'running', worker: '' }

export const isChecking = (cell: CellStatus) => cell.run?.state === 'running' && cell.run.worker === ''

export function argsOf({ business, asset, item }: Scope): string[] {
  return ['check', ...(business ? [business] : []), ...(item ? ['--item', item] : []), ...(asset ? ['--asset', asset] : [])]
}

const inScope = (scope: Scope, business: string, cell: CellStatus) =>
  (!scope.business || scope.business === business) &&
  (!scope.asset || scope.asset === cell.asset) &&
  (!scope.item || scope.item === cell.item)

function mapCells(status: Status, f: (business: string, cell: CellStatus) => CellStatus): Status {
  return Object.fromEntries(Object.entries(status).map(([business, cells]) => [business, cells.map(cell => f(business, cell))]))
}

function settle({ run: _, ...cell }: CellStatus): CellStatus {
  return cell
}

/** The cell as its last result left it: the drawer would read a checking mark as a worker on it. */
export const settled = (cell: CellStatus) => (isChecking(cell) ? settle(cell) : cell)

/** Marks the cells a run will check. The engine skips waived cells, so they keep their look. */
export const startChecks = (status: Status, scope: Scope): Status =>
  mapCells(status, (business, cell) => (cell.state !== 'waived' && inScope(scope, business, cell) ? { ...cell, run: CHECKING } : cell))

/** Folds one line of `standards check` in: a result becomes its cell's state, fresh, so never stale or older. */
export function applyLine(status: Status, line: string): Status {
  const value = parseLine(line)
  if (value?.type !== 'result') return status
  const { type: _, ...result } = value as unknown as Result & { type: 'result' }
  const cells = status[result.business]
  if (!cells) return status
  return {
    ...status,
    [result.business]: cells.map(cell =>
      cell.asset === result.asset && cell.item === result.item
        ? { asset: cell.asset, item: cell.item, title: cell.title, state: result.state, result }
        : cell,
    ),
  }
}

/** After a run: the cells it never reported (it failed or was stopped) go back to their last state. */
export const endChecks = (status: Status, scope: Scope): Status =>
  mapCells(status, (business, cell) => (inScope(scope, business, cell) ? settled(cell) : cell))

/** The cells without the checking marks, for the totals: a cell being checked is not work in flight. */
export const withoutChecking = (status: Status): Status => mapCells(status, (_, cell) => settled(cell))

export const checkingCount = (status: Status) => Object.values(status).flat().filter(isChecking).length

/** The newest result's time, or undefined before any check. */
export function lastChecked(status: Status): string | undefined {
  let last: string | undefined
  for (const cell of Object.values(status).flat()) {
    const at = cell.result?.checked_at
    if (at && (!last || at > last)) last = at
  }
  return last
}
