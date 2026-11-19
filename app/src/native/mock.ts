import type { ProfileInfo } from '@just-apps/claude-code'
import type { Business, CellStatus, PullRequest, Result, Worker } from '@justanarthur/modo-ui-standards'
import { type CliWorkspace, toStatus } from '../model'
import type { RunRecord } from '../runs'
import { STANDARDS_EXIT, STANDARDS_LINE, STANDARDS_STDERR, type StandardsExit, type StandardsLine } from './commands'
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
const tilde = (path: string) => path.replace(/^\/Users\/you(?=\/|$)/, '~')

// The fixture is the workspace at the default path; `workspace init` makes more, empty ones.
const fixture = structuredClone(workspace) as unknown as CliWorkspace
const workspaces = new Map<string, CliWorkspace>()
/** Where the folder dialog lands: a workspace to make, for onboarding. */
const PICKED = '/Users/you/Projects/acme-standards'

function workspaceAt(path: string) {
  if (/standards-workspace\/?$/.test(path)) return fixture
  return workspaces.get(home(path).replace(/\/$/, ''))
}

// A checkout path like the default answers, and a workspace the mock knows; any other one is missing, as on a
// machine without it. An empty workspace is left out, for the commands that need none.
function check({ checkout, workspace }: Omit<Paths, 'args'>) {
  if (!/just-standards\/?$/.test(checkout)) throw new Error(`No just-standards checkout at ${home(checkout)}: cli/standards.ts is missing.`)
  if (!workspace) return
  const found = workspaceAt(workspace)
  if (!found) throw new Error(`No workspace folder at ${home(workspace)}.`)
  return found
}

const cells = Object.entries(toStatus(status)).flatMap(([business, list]) => list.map(cell => ({ business, ...cell })))
type MockCell = CellStatus & { business: string }

/** A business's cells: the fixture's, or for one added since, each adopted item on its assets, unchecked. */
function cellsOf(ws: CliWorkspace): MockCell[] {
  return ws.businesses.flatMap(business => {
    const known = ws === fixture ? cells.filter(cell => cell.business === business.id) : []
    if (known.length) return known
    return business.packs.flatMap(ref => {
      const [id, pinned] = ref.split('@') as [string, string?]
      const pack = ws.packs.find(p => p.id === id)
      if (!pack) return []
      const version = pinned ? Number(pinned) : pack.version
      return pack.items
        .filter(item => item.since <= version)
        .flatMap(item =>
          business.assets
            .filter(asset => item.applies_to.includes(asset.kind))
            .map(asset => ({ business: business.id, asset: asset.id, item: item.key, title: item.title, state: 'unchecked' as const })),
        )
    })
  })
}
// The results of the mock's own checks, by `business:asset:item`, laid over the fixture's on the next `status`.
const fresh = new Map<string, Result>()
const keyOf = (business: string, asset: string, item: string) => `${business}:${asset}:${item}`

function statusLines(ws: CliWorkspace) {
  return cellsOf(ws)
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

function planOf(business: string, asset: string, items: string[], worker: string, started: Date, ws = fixture) {
  const found = ws.businesses.find(b => b.id === business)?.assets.find(a => a.id === asset)
  if (!found?.path) throw new Error(`${business}/${asset} has no path: a fix needs a local checkout.`)
  return {
    id: runId(started, business, items[0]!),
    business,
    asset,
    items,
    worker,
    model: ws.workers.find(w => w.id === worker)?.model ?? 'sonnet',
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
function startFix(key: string, args: string[], emit: Context['emit'], ws: CliWorkspace) {
  const [, business, asset, ...rest] = args
  const items = rest.slice(0, rest.indexOf('--worker'))
  const worker = flag(args, '--worker')!
  let plan: ReturnType<typeof planOf>
  try {
    plan = planOf(business!, asset!, items, worker, new Date(), ws)
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

/** The engine's schema refusal: `<where>:` and then `  <path>: <message>` per issue. */
function refuse(where: string, issues: [string, string][]) {
  if (issues.length) throw new Error(`${where}:\n${issues.map(([path, message]) => `  ${path}: ${message}`).join('\n')}`)
}

const ID = /^[a-z0-9-]+$/
const PATTERN = (re: RegExp) => `Invalid string: must match pattern ${re}`

function parseJson(text: string | undefined) {
  if (!text) throw new Error("usage: --json '<object>'")
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`--json: ${(error as Error).message}`)
  }
}

function setBusiness(ws: CliWorkspace, text?: string) {
  const business = parseJson(text) as Business
  const issues: [string, string][] = []
  if (!ID.test(business.id ?? '')) issues.push(['id', PATTERN(ID)])
  if (typeof business.name !== 'string' || !business.name) issues.push(['name', 'Invalid input: expected string, received undefined'])
  if (!business.assets?.length) issues.push(['assets', 'Too small: expected array to have >=1 items'])
  business.assets?.forEach((asset, i) => {
    if (!ID.test(asset.id ?? '')) issues.push([`assets.${i}.id`, PATTERN(ID)])
    if (asset.url && !URL.canParse(asset.url)) issues.push([`assets.${i}.url`, 'Invalid URL'])
    if (asset.repo && !/^[\w.-]+\/[\w.-]+$/.test(asset.repo)) issues.push([`assets.${i}.repo`, PATTERN(/^[\w.-]+\/[\w.-]+$/)])
  })
  refuse('business', issues)
  for (const ref of business.packs) {
    const id = ref.split('@')[0]
    if (!ws.packs.some(p => p.id === id)) throw new Error(`businesses/${business.id}: no pack ${id}`)
  }
  const saved = { ...business, waivers: business.waivers ?? [] }
  const at = ws.businesses.findIndex(b => b.id === business.id)
  ws.businesses = at < 0 ? [...ws.businesses, saved].sort((a, b) => a.id.localeCompare(b.id)) : ws.businesses.with(at, saved)
  return JSON.stringify(saved)
}

function setWorker(ws: CliWorkspace, text?: string) {
  const worker = { profile: '~/.claude', permission_mode: 'acceptEdits', allow: [], ...parseJson(text) } as Worker
  refuse('worker', [
    ...(typeof worker.id === 'string' ? [] : [['id', 'Invalid input: expected string, received undefined'] as [string, string]]),
    ...(typeof worker.model === 'string' ? [] : [['model', 'Invalid input: expected string, received undefined'] as [string, string]]),
  ])
  const at = ws.workers.findIndex(w => w.id === worker.id)
  ws.workers = at < 0 ? [...ws.workers, worker] : ws.workers.with(at, worker)
  return JSON.stringify(worker)
}

function findWorker(ws: CliWorkspace, id: string) {
  const worker = ws.workers.find(w => w.id === id)
  if (!worker) throw new Error(`no worker ${id} in workers.yml`)
  return worker
}

function findBusiness(ws: CliWorkspace, id: string) {
  const business = ws.businesses.find(b => b.id === id)
  if (!business) throw new Error(`no business ${id} in ${home(ws.dir)}/businesses`)
  return business
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function cloneAsset(ws: CliWorkspace, businessId: string, assetId: string) {
  const business = findBusiness(ws, businessId)
  const asset = business.assets.find(a => a.id === assetId)
  if (!asset) throw new Error(`${businessId} has no asset ${assetId}`)
  if (!asset.repo) throw new Error(`${businessId}/${assetId} has no repo`)
  if (asset.path) throw new Error(`${businessId}/${assetId} already has a path: ${asset.path}`)
  const [owner, name] = asset.repo.split('/') as [string, string]
  await wait(1200)
  asset.path = `~/Projects/${owner.toLowerCase()}/${name}`
  return JSON.stringify({ path: asset.path })
}

const PRESETS: Worker[] = fixture.workers.map(w => ({ ...w }))

function initWorkspace(dir: string) {
  const root = home(dir).replace(/\/$/, '')
  if (!workspaceAt(root)) workspaces.set(root, { dir: tilde(root), businesses: [], packs: fixture.packs, workers: PRESETS.map(w => ({ ...w })) })
  return JSON.stringify({ dir: root })
}

// `gh` starts signed out, so the web host can show the sign-in.
let github: { loggedIn: boolean; user?: string; protocol?: string } = { loggedIn: false }
const logins = new Map<string, ReturnType<typeof setTimeout>[]>()
const DEVICE_CODE = '4F2A-9C1D'

/** `standards github login`: gh's one-time code on stderr, then it waits for Enter and the browser. */
function startLogin(key: string, emit: Context['emit']) {
  const say = (line: string) => emit(STANDARDS_STDERR, { key, line } satisfies StandardsLine)
  logins.set(key, [setTimeout(() => say(`! First copy your one-time code: ${DEVICE_CODE}`), 700)])
}

function enterLogin(key: string, emit: Context['emit']) {
  const timers = logins.get(key)!
  timers.push(
    setTimeout(() => {
      github = { loggedIn: true, user: 'you', protocol: 'https' }
      logins.delete(key)
      emit(STANDARDS_STDERR, { key, line: '✓ Authentication complete.' } satisfies StandardsLine)
      emit(STANDARDS_EXIT, { key, code: 0, stderr: '✓ Authentication complete.' } satisfies StandardsExit)
    }, 2500),
  )
}

function recordOf(id: string) {
  const record = records.find(r => r.id === id)
  if (!record) throw new Error(`no run ${id}`)
  if (!record.pr) throw new Error(`run ${id} has no pull request`)
  return record as RunRecord & { pr: NonNullable<RunRecord['pr']> }
}

const short = (item: string) => item.slice(item.indexOf('/') + 1)

/** `standards pr view`: the PR the run opened, as gh would describe it. */
function prOf(record: RunRecord & { pr: NonNullable<RunRecord['pr']> }): PullRequest {
  const items = record.items.map(short)
  return {
    number: record.pr.number,
    url: record.pr.url,
    title: `fix(standards): ${items.join(', ')}`,
    state: record.pr.state === 'merged' ? 'MERGED' : record.pr.state === 'closed' ? 'CLOSED' : 'OPEN',
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: '',
    checks: [
      { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'typecheck', state: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'Vercel – Preview', state: 'COMPLETED', conclusion: 'SUCCESS' },
    ],
    additions: 18,
    deletions: 3,
    changedFiles: 2,
    files: [
      { path: 'src/app/(frontend)/layout.tsx', additions: 16, deletions: 3 },
      { path: 'public/og/home.mp4', additions: 2, deletions: 0 },
    ],
    body: [
      `Fixes the just-standards ${items.length === 1 ? 'item' : 'items'} ${items.map(i => `\`${i}\``).join(', ')} on \`${record.asset}\`.`,
      '',
      '## What changed',
      '- Adds the `og:video` tags to the home page head.',
      '- Points them at a 1280×720 MP4 served from `public/og/`.',
      '',
      `Run \`${record.id}\` by ${record.worker}.`,
    ].join('\n'),
  }
}

async function mergePr(id: string, method = 'merge') {
  if (!['merge', 'squash', 'rebase'].includes(method)) throw new Error('--method is one of merge, squash, rebase')
  const record = recordOf(id)
  await wait(900)
  const merged = { ...record, pr: { ...record.pr, state: 'merged' as const } }
  records.splice(records.indexOf(record), 1, merged)
  return JSON.stringify(merged)
}

const PROFILES: ProfileInfo[] = [
  { configDir: '/Users/you/.claude', signedIn: true, email: 'you@example.com', organizationType: 'claude_max' },
  { configDir: '/Users/you/.claude-work', signedIn: true, email: 'you@studio.example', organizationType: 'claude_team' },
  { configDir: '/Users/you/.claude-ci', signedIn: false },
]

export const mockCommands = {
  standards_json(paths: Paths) {
    const ws = check(paths)
    const [command, sub, id, arg] = paths.args
    if (command === 'github' && sub === 'status') return JSON.stringify(github)
    if (command === 'workspace' && sub === 'init') return initWorkspace(id!)
    if (!ws) throw new Error('this command needs --workspace')
    // The CLI prints the workspace's folder absolute.
    if (command === 'workspace') return JSON.stringify({ ...ws, dir: home(ws.dir) })
    if (command === 'status') return statusLines(ws)
    // `--json` is the output flag: the object is the argument after it.
    const object = paths.args[paths.args.indexOf('--json') + 1]
    if (command === 'business' && sub === 'set') return setBusiness(ws, object)
    if (command === 'business' && sub === 'remove') {
      findBusiness(ws, id!)
      ws.businesses = ws.businesses.filter(b => b.id !== id)
      return ''
    }
    if (command === 'worker' && sub === 'set') return setWorker(ws, object)
    if (command === 'worker' && sub === 'remove') {
      findWorker(ws, id!)
      const user = ws.businesses.find(b => b.worker === id)
      if (user) throw new Error(`${user.id} uses worker ${id} as its default`)
      ws.workers = ws.workers.filter(w => w.id !== id)
      return ''
    }
    if (command === 'worker' && sub === 'allow') {
      const worker = findWorker(ws, id!)
      if (!worker.allow.includes(arg!)) worker.allow = [...worker.allow, arg!]
      return JSON.stringify(worker)
    }
    if (command === 'clone') return cloneAsset(ws, sub!, id!)
    if (command === 'pr' && sub === 'view') return JSON.stringify(prOf(recordOf(id!)))
    if (command === 'pr' && sub === 'merge') return mergePr(id!, flag(paths.args, '--method'))
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
    const ws = check(paths)
    if (runs.has(key) || fixing.has(key) || logins.has(key)) throw new Error(`run ${key} is already going`)
    if (args[0] === 'github' && args[1] === 'login') return startLogin(key, emit)
    if (!ws) throw new Error('this command needs --workspace')
    if (args[0] === 'fix') return startFix(key, args, emit, ws)
    const [, business] = args
    const item = flag(args, '--item')
    const asset = flag(args, '--asset')
    const picked = cellsOf(ws).filter(
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

  pick_folder: async () => {
    await wait(400)
    return PICKED
  },

  list_profiles: () => PROFILES,

  standards_write({ key, line }: { key: string; line: string }, { emit }: Context) {
    if (logins.has(key)) return enterLogin(key, emit)
    const run = fixing.get(key)
    if (!run) throw new Error(`run ${key} is not going`)
    const { type, response } = JSON.parse(line) as { type: string; response?: { request_id: string; response?: { behavior: string } } }
    if (type !== 'control_response' || response?.request_id !== run.script.requestId || !run.waiting) return
    run.waiting = false
    const how = response.response?.behavior === 'allow' ? 'allowed' : 'denied'
    emitFix(key, run, emit, run.script[how], () => finishFix(key, run, emit, how))
  },

  standards_kill({ key }: { key: string }, { emit }: Context) {
    const login = logins.get(key)
    if (login) {
      login.forEach(clearTimeout)
      logins.delete(key)
      setTimeout(() => emit(STANDARDS_EXIT, { key, code: null, stderr: '' } satisfies StandardsExit), 50)
      return
    }
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
