import { type CellStatus, cellKey, type PullRequest } from '@justanarthur/modo-ui-standards'
import type { Pane } from './pane'
import { type Run, type RunRecord, runsOf } from './runs'

/** What a run's pane shows: its pull request, or the transcript. */
export type RunView = 'pr' | 'transcript'

/** A run that ended with a PR opens on it, unless the transcript was picked; a running one shows its transcript. */
export const runView = (record: RunRecord, picked?: RunView): RunView =>
  record.pr && record.state !== 'running' ? (picked ?? 'pr') : 'transcript'

/** The pane a cell opens: the run whose PR is open on it (Back returns to the cell), else the cell itself. */
export function cellPane(cell: CellStatus, runs: Run[], business: string): Pane {
  const own: Pane = { kind: 'cell', key: cellKey(cell.asset, cell.item) }
  if (cell.run?.state !== 'pr-open') return own
  const url = cell.run.url
  const run = runsOf(runs, business, cell.asset, cell.item).find(r => r.record.pr?.url === url)
  return run ? { kind: 'run', key: run.record.id, back: own } : own
}

/** `standards pr view <run>`. */
export const parsePr = (json: string) => JSON.parse(json) as PullRequest

/** `standards pr merge <run>` prints the run's record once merged and synced. */
export const parseMerged = (json: string) => JSON.parse(json.trim().split('\n').at(-1)!) as RunRecord
