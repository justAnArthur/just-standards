import { type Item, initialSession, reduce, type SessionModel } from '@just-apps/claude-code'
import type { CellRun, CellStatus, FixRun, TranscriptItem } from '@justanarthur/modo-ui-standards'
import { parseLine, type Status } from './model'

/** A fix run as the engine records it (`run.json`): the kit's `FixRun` without its transcript, plus where it ran. */
export interface RunRecord extends Omit<FixRun, 'transcript'> {
  business: string
  asset: string
  /** `pack/item` */
  items: string[]
  worktree: string
  finished_at?: string
  session_id?: string
  /** Why it failed or stopped. */
  error?: string
  /** What the worker said it did, through the `finish` tool. */
  summary?: string
  /** What a person must still do. */
  missing?: string[]
}

/** A run as the app holds it: its record and its Claude Code session, folded from the `claude` lines. */
export interface Run {
  record: RunRecord
  session: SessionModel
  /** Started from this window and its process is still going. */
  live: boolean
}

export const fixArgs = (business: string, asset: string, items: string[], worker: string) => [
  'fix',
  business,
  asset,
  ...items,
  '--worker',
  worker,
  '--interactive',
]

const isRecord = (value: unknown): value is RunRecord =>
  Boolean(value && typeof value === 'object' && 'id' in value && 'state' in value && 'items' in value)

/** `standards runs` and `runs sync`: bare records, or the `{"type":"run","run":…}` lines a fix prints. */
export function parseRecords(ndjson: string): RunRecord[] {
  return ndjson.split('\n').flatMap(line => {
    const value = parseLine(line)
    const record = value?.type === 'run' ? value.run : value
    return isRecord(record) ? [record] : []
  })
}

/** A finished session: nothing waits on an answer any more. */
const settle = (session: SessionModel): SessionModel => ({ ...session, pending: [], draft: '' })

/** A run's process went away without saying how it ended (it was SIGKILLed): its record still says `running`. */
export const LOST = 'its process ended without recording how the run went'

/** A recorded run. One still `running` that isn't this window's is stale, not live: it shows as stopped. */
export function recorded(record: RunRecord): Run {
  const stale = record.state === 'running' ? { ...record, state: 'stopped' as const, error: record.error ?? LOST } : record
  return { record: stale, session: initialSession, live: false }
}

/** A run this window starts, until the CLI prints its record. */
export function starting(id: string, business: string, asset: string, items: string[], worker: string, model: string): Run {
  return {
    record: { id, business, asset, items, worker, model, branch: '', worktree: '', started_at: new Date().toISOString(), state: 'running' },
    session: initialSession,
    live: true,
  }
}

/** Folds one line of `standards fix` in: a `run` line is the new record, a `claude` line goes to the session. */
export function foldRun(run: Run, line: string): Run {
  const value = parseLine(line)
  if (value?.type === 'run' && isRecord(value.run))
    return { ...run, record: value.run, session: value.event === 'finished' ? settle(run.session) : run.session }
  if (value?.type === 'claude' && typeof value.line === 'string') return { ...run, session: reduce(run.session, value.line) }
  return run
}

/** After the process exits. A run that never printed its end failed (the CLI refused it) or was stopped (killed). */
export function endRun(run: Run, code: number | null, stderr: string): Run {
  const ended = { ...run, live: false, session: settle(run.session) }
  if (run.record.state !== 'running') return ended
  const finished_at = new Date().toISOString()
  return {
    ...ended,
    record: {
      ...run.record,
      state: code === null ? 'stopped' : 'failed',
      finished_at,
      ms: Date.parse(finished_at) - Date.parse(run.record.started_at),
      error: stderr.trim() || (code === null ? undefined : `standards fix exited with ${code}`),
    },
  }
}

/** A finished run's `events.ndjson` (`standards runs transcript <id>`): Claude Code's raw lines. */
export const sessionOf = (events: string) => settle(events.split('\n').reduce(reduce, initialSession))

/** The session's turns as the kit's transcript; a subagent's own turns stay folded in its tool call. */
export function toTranscript(items: Item[]): TranscriptItem[] {
  return items.flatMap((item): TranscriptItem[] => {
    if (item.kind === 'user' || item.kind === 'text' || item.kind === 'thinking') return [{ kind: item.kind, id: item.id, text: item.text }]
    if (item.kind !== 'tool') return []
    const { id, name, input, result, isError, durationMs } = item
    return [{ kind: 'tool', id, name, input, result, is_error: isError, ms: durationMs }]
  })
}

export const toFixRun = ({ record, session }: Run): FixRun => ({ ...record, transcript: toTranscript(session.turns) })

const newest = (a: Run, b: Run) => Date.parse(b.record.started_at) - Date.parse(a.record.started_at)

/** The recorded runs and this window's, one per id (this window's is the fresher), newest first. */
export function allRuns(records: RunRecord[], mine: Run[]): Run[] {
  const ids = new Set(mine.map(run => run.record.id))
  return [...mine, ...records.filter(record => !ids.has(record.id)).map(recorded)].sort(newest)
}

const covers = ({ record }: Run, business: string, asset: string, item: string) =>
  record.business === business && record.asset === asset && record.items.includes(item)

/** The runs on one cell, newest first. */
export const runsOf = (runs: Run[], business: string, asset: string, item: string) =>
  runs.filter(run => covers(run, business, asset, item)).sort(newest)

/** What a cell's runs put on it: a live run its worker, else its latest run's open PR until the check passes. */
function cellRun(runs: Run[], cell: CellStatus): CellRun | undefined {
  const live = runs.find(run => run.live)
  if (live) return { state: 'running', worker: live.record.worker }
  const pr = runs[0]?.record.pr
  if (pr?.state === 'open' && cell.state !== 'pass') return { state: 'pr-open', url: pr.url, number: pr.number }
}

/** The cells with their runs laid over: `running` and `pr-open`. */
export function overlayRuns(status: Status, runs: Run[]): Status {
  if (!runs.length) return status
  return Object.fromEntries(
    Object.entries(status).map(([business, cells]) => [
      business,
      cells.map(cell => {
        const run = cellRun(runsOf(runs, business, cell.asset, cell.item), cell)
        return run ? { ...cell, run } : cell
      }),
    ]),
  )
}
