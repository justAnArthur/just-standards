import type { Result } from '@justanarthur/modo-ui-standards'
import { toStatus } from '../model'
import type { RunRecord } from '../runs'
import { STANDARDS_EXIT, STANDARDS_LINE, type StandardsExit, type StandardsLine } from './commands'
import { type FixScript, fixScript, type Step, stamped } from './fix-script'
import status from './fixtures/status.ndjson?raw'
import workspace from './fixtures/workspace.json'

interface Context {
  emit(event: string, payload: unknown): void
}

interface Paths {
  checkout: string
  workspace: string
  args: string[]
}

const home = (path: string) => path.replace(/^~/, '/Users/you')

// Paths like the defaults answer; any other one is missing, as on a machine without them.
function check({ checkout, workspace }: Omit<Paths, 'args'>) {
  if (!/just-standards\/?$/.test(checkout)) throw new Error(`No just-standards checkout at ${home(checkout)}: cli/standards.ts is missing.`)
  if (!/standards-workspace\/?$/.test(workspace)) throw new Error(`No workspace folder at ${home(workspace)}.`)
}

const cells = Object.entries(toStatus(status)).flatMap(([business, list]) => list.map(cell => ({ business, ...cell })))
// The results of the mock's own checks, by `business:asset:item`, laid over the fixture's on the next `status`.
const fresh = new Map<string, Result>()
const keyOf = (business: string, asset: string, item: string) => `${business}:${asset}:${item}`

function statusLines() {
  return cells
    .map(({ business, ...cell }) => {
      const result = fresh.get(keyOf(business, cell.asset, cell.item))
      return JSON.stringify({ type: 'cell', business, ...cell, ...(result && { state: result.state, result }) })
    })
    .join('\n')
}

function flag(args: string[], name: string) {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}

const runs = new Map<string, ReturnType<typeof setTimeout>[]>()

// Fix runs: the recorded ones (`standards runs`), each with its events (`runs transcript`), and the ones going now.
const records: RunRecord[] = []
const events = new Map<string, string[]>()
interface Fixing {
  script: FixScript
  timers: ReturnType<typeof setTimeout>[]
  /** Set while the run waits on its permission question. */
  waiting: boolean
}
const fixing = new Map<string, Fixing>()
let synced = false

const MINUTE = 60_000
const pad = (n: number) => String(n).padStart(2, '0')
const runId = (at: Date, business: string, item: string) =>
  `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}-${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}-${business}-${item.slice(item.indexOf('/') + 1)}`

function planOf(business: string, asset: string, items: string[], worker: string, started: Date) {
  const found = workspace.businesses.find(b => b.id === business)?.assets.find(a => a.id === asset) as
    | { path?: string; repo?: string; url?: string }
    | undefined
  if (!found?.path) throw new Error(`${business}/${asset} has no path: a fix needs a local checkout.`)
  return {
    id: runId(started, business, items[0]!),
    business,
    asset,
    items,
    worker,
    model: workspace.workers.find(w => w.id === worker)?.model ?? 'sonnet',
    path: home(found.path),
    repo: found.repo ?? `you/${business}`,
    site: (found.url ?? `https://github.com/${found.repo}`).replace(/\/$/, ''),
    started_at: started.toISOString(),
  }
}

/** A run that happened before the window opened: its record and its events, as the CLI left them. */
function seed(business: string, asset: string, item: string, worker: string, ago: number, how: 'allowed' | 'denied') {
  const started = new Date(Date.now() - ago)
  const script = fixScript(planOf(business, asset, [item], worker, started))
  const steps = [...script.opening, ...script[how]]
  let at = started.getTime()
  events.set(script.started.id, steps.map(step => stamped(step, (at += step.delay * 20))))
  const record = script.finish(how, new Date(at).toISOString())
  records.push(record)
}

seed('modo', 'docs', 'website/og-video', 'sonnet-fixer', 2 * 60 * MINUTE, 'allowed')
seed('modo', 'docs', 'website/icons', 'sonnet-fixer', 26 * 60 * MINUTE, 'allowed')
seed('acadsys', 'site', 'website/security-headers', 'opus-fixer', 30 * 60 * MINUTE, 'denied')

const newestFirst = () => [...records].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))

function emitFix(key: string, run: Fixing, emit: Context['emit'], steps: Step[], then: () => void) {
  let at = 0
  run.timers = steps.map(step =>
    setTimeout(() => {
      const line = stamped(step, Date.now())
      events.get(run.script.started.id)!.push(line)
      emit(STANDARDS_LINE, { key, line: JSON.stringify({ type: 'claude', line }) } satisfies StandardsLine)
    }, (at += step.delay)),
  )
  run.timers.push(setTimeout(then, at + 200))
}

function finishFix(key: string, run: Fixing, emit: Context['emit'], how: 'allowed' | 'denied' | 'stopped') {
  const record = run.script.finish(how, new Date().toISOString())
  records.splice(records.findIndex(r => r.id === record.id), 1, record)
  fixing.delete(key)
  emit(STANDARDS_LINE, { key, line: JSON.stringify({ type: 'run', event: 'finished', run: record }) } satisfies StandardsLine)
  emit(STANDARDS_EXIT, { key, code: record.state === 'done' ? 0 : 1, stderr: '' } satisfies StandardsExit)
}

/** `standards fix … --interactive`: the run's record, Claude Code's lines up to its question, then the answer's ending. */
function startFix(key: string, args: string[], emit: Context['emit']) {
  const [, business, asset, ...rest] = args
  const items = rest.slice(0, rest.indexOf('--worker'))
  const worker = flag(args, '--worker')!
  let plan: ReturnType<typeof planOf>
  try {
    plan = planOf(business!, asset!, items, worker, new Date())
  } catch (error) {
    setTimeout(() => emit(STANDARDS_EXIT, { key, code: 1, stderr: (error as Error).message } satisfies StandardsExit), 300)
    return
  }
  const run: Fixing = { script: fixScript(plan), timers: [], waiting: false }
  fixing.set(key, run)
  records.push(run.script.started)
  events.set(run.script.started.id, [])
  // Creating the worktree takes a moment before Claude Code starts.
  run.timers.push(
    setTimeout(() => {
      emit(STANDARDS_LINE, { key, line: JSON.stringify({ type: 'run', event: 'started', run: run.script.started }) } satisfies StandardsLine)
      emitFix(key, run, emit, run.script.opening, () => {
        run.waiting = true
      })
    }, 600),
  )
}

export const mockCommands = {
  standards_json(paths: Paths) {
    check(paths)
    const [command, sub, id] = paths.args
    // The CLI prints the workspace's folder absolute.
    if (command === 'workspace') return JSON.stringify({ ...workspace, dir: home(workspace.dir) })
    if (command === 'status') return statusLines()
    if (command === 'runs' && sub === 'transcript') {
      const lines = events.get(id!)
      if (!lines) throw new Error(`no run ${id}`)
      return lines.join('\n')
    }
    if (command === 'runs' && sub === 'sync') {
      // Once per page load, modo's icons PR has merged since the last look.
      if (synced) return ''
      synced = true
      const at = records.findIndex(r => r.items.includes('website/icons'))
      const merged: RunRecord = { ...records[at]!, pr: { ...records[at]!.pr!, state: 'merged' } }
      records[at] = merged
      return JSON.stringify(merged)
    }
    if (command === 'runs') return newestFirst().map(r => JSON.stringify(r)).join('\n')
    throw new Error(`unknown command ${command}`)
  },

  standards_start({ key, args, ...paths }: Paths & { key: string }, { emit }: Context) {
    check(paths)
    if (runs.has(key) || fixing.has(key)) throw new Error(`run ${key} is already going`)
    if (args[0] === 'fix') return startFix(key, args, emit)
    const [, business] = args
    const item = flag(args, '--item')
    const asset = flag(args, '--asset')
    const picked = cells.filter(
      cell =>
        cell.state !== 'waived' &&
        (!business || business.startsWith('--') || cell.business === business) &&
        (!item || cell.item === item) &&
        (!asset || cell.asset === asset),
    )
    // Like the real checks: a few hundred ms to several seconds each, six at a time.
    const spread = picked.length === 1 ? 900 : 12_000
    const timers = picked.map(cell => {
      const at = 300 + Math.random() * spread
      return setTimeout(() => {
        const last = fresh.get(keyOf(cell.business, cell.asset, cell.item)) ?? cell.result
        const result: Result = {
          business: cell.business,
          asset: cell.asset,
          item: cell.item,
          item_version: last?.item_version ?? 1,
          state: last?.state ?? 'pass',
          evidence: last?.evidence ?? 'checked',
          checked_at: new Date().toISOString(),
          ms: Math.round(at),
        }
        fresh.set(keyOf(cell.business, cell.asset, cell.item), result)
        emit(STANDARDS_LINE, { key, line: JSON.stringify({ type: 'result', ...result }) } satisfies StandardsLine)
      }, at)
    })
    timers.push(setTimeout(() => {
      runs.delete(key)
      emit(STANDARDS_EXIT, { key, code: 0, stderr: '' } satisfies StandardsExit)
    }, spread + 400))
    runs.set(key, timers)
  },

  home_dir: () => home('~'),

  standards_write({ key, line }: { key: string; line: string }, { emit }: Context) {
    const run = fixing.get(key)
    if (!run) throw new Error(`run ${key} is not going`)
    const { type, response } = JSON.parse(line) as { type: string; response?: { request_id: string; response?: { behavior: string } } }
    if (type !== 'control_response' || response?.request_id !== run.script.requestId || !run.waiting) return
    run.waiting = false
    const how = response.response?.behavior === 'allow' ? 'allowed' : 'denied'
    emitFix(key, run, emit, run.script[how], () => finishFix(key, run, emit, how))
  },

  standards_kill({ key }: { key: string }, { emit }: Context) {
    const fix = fixing.get(key)
    if (fix) {
      fix.timers.forEach(clearTimeout)
      // The CLI records `stopped` and prints the record before it exits.
      setTimeout(() => finishFix(key, fix, emit, 'stopped'), 150)
      return
    }
    const timers = runs.get(key)
    if (!timers) throw new Error(`run ${key} is not going`)
    timers.forEach(clearTimeout)
    runs.delete(key)
    setTimeout(() => emit(STANDARDS_EXIT, { key, code: null, stderr: '' } satisfies StandardsExit), 50)
  },
}
