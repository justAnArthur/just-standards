import type { Result } from '@justanarthur/modo-ui-standards'
import { toStatus } from '../model'
import { STANDARDS_EXIT, STANDARDS_LINE, type StandardsExit, type StandardsLine } from './commands'
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

export const mockCommands = {
  standards_json(paths: Paths) {
    check(paths)
    const [command] = paths.args
    if (command === 'workspace') return JSON.stringify(workspace)
    if (command === 'status') return statusLines()
    throw new Error(`unknown command ${command}`)
  },

  standards_start({ key, args, ...paths }: Paths & { key: string }, { emit }: Context) {
    check(paths)
    if (runs.has(key)) throw new Error(`run ${key} is already going`)
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

  standards_kill({ key }: { key: string }, { emit }: Context) {
    const timers = runs.get(key)
    if (!timers) throw new Error(`run ${key} is not going`)
    timers.forEach(clearTimeout)
    runs.delete(key)
    setTimeout(() => emit(STANDARDS_EXIT, { key, code: null, stderr: '' } satisfies StandardsExit), 50)
  },
}
