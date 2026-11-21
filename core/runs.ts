import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { run } from './checks/github.ts'
import type { Workspace } from './load.ts'
import { checkPreview } from './preview.ts'
import type { Preview, RunRecord } from './schema.ts'

export class RunError extends Error {}

type WithPr = RunRecord & { pr: NonNullable<RunRecord['pr']> }

export const ghBin = () => process.env.STANDARDS_GH_BIN ?? 'gh'
export const runsDir = (ws: Pick<Workspace, 'dir'>) => join(ws.dir, '.state', 'runs')

/** A run's folder; the id comes from outside, so it may not climb out of `runs/`. */
export function runDir(ws: Pick<Workspace, 'dir'>, id: string) {
  if (!/^[\w-]+$/.test(id)) throw new RunError(`no run ${id}`)
  return join(runsDir(ws), id)
}

export async function writeRecord(ws: Workspace, record: RunRecord) {
  await Bun.write(join(runsDir(ws), record.id, 'run.json'), `${JSON.stringify(record, null, 2)}\n`)
}

/** A byte stream as its lines, without the newlines. */
export async function* lines(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop()!
    yield* parts
  }
  if (buffer) yield buffer
}

/** Newest first. */
export async function listRuns(ws: Workspace, businesses: string[] = []) {
  const ids = await readdir(runsDir(ws)).catch(() => [])
  const records = await Promise.all(
    ids.map(id => Bun.file(join(runsDir(ws), id, 'run.json')).json().catch(() => undefined) as Promise<RunRecord | undefined>),
  )
  return records
    .filter((record): record is RunRecord => !!record && (businesses.length === 0 || businesses.includes(record.business)))
    .sort((a, b) => b.started_at.localeCompare(a.started_at) || b.id.localeCompare(a.id))
}

export function transcriptOf(ws: Workspace, id: string) {
  const path = join(runDir(ws, id), 'events.ndjson')
  if (!existsSync(path)) throw new RunError(`no run ${id}`)
  return Bun.file(path)
}

export async function readRecord(ws: Workspace, id: string) {
  const file = Bun.file(join(runDir(ws, id), 'run.json'))
  if (!(await file.exists())) throw new RunError(`no run ${id}`)
  return (await file.json()) as RunRecord
}

async function defaultBranch(checkout: string) {
  const head = () => run(['git', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], checkout)
  let found = await head()
  if (!found.ok) {
    // A checkout that got its origin from `git remote add` has no origin/HEAD until asked.
    await run(['git', 'remote', 'set-head', 'origin', '--auto'], checkout)
    found = await head()
  }
  if (!found.ok) throw new RunError(`${checkout}: can't tell origin's default branch`)
  return found.stdout.trim()
}

/** `<checkout>/.worktrees/std-<item>` on `standards/<item>`, fresh from origin's default branch; `-2`, `-3`… when taken. */
export async function createWorktree(checkout: string, itemId: string) {
  if (!existsSync(checkout)) throw new RunError(`${checkout} does not exist`)
  const fetched = await run(['git', 'fetch', 'origin'], checkout)
  if (!fetched.ok) throw new RunError(`git fetch origin in ${checkout}: ${fetched.stderr}`)
  const base = await defaultBranch(checkout)
  for (let n = 1; ; n++) {
    const name = n === 1 ? itemId : `${itemId}-${n}`
    const branch = `standards/${name}`
    const worktree = join(checkout, '.worktrees', `std-${name}`)
    const refs = await run(['git', 'for-each-ref', `refs/heads/${branch}`, `refs/remotes/origin/${branch}`], checkout)
    if (existsSync(worktree) || refs.stdout.trim()) continue
    const added = await run(['git', 'worktree', 'add', '--no-track', '-b', branch, worktree, base], checkout)
    if (!added.ok) throw new RunError(`git worktree add ${worktree}: ${added.stderr}`)
    return { branch, worktree }
  }
}

async function cleanUp(record: RunRecord) {
  const checkout = join(record.worktree, '..', '..')
  if (!existsSync(checkout)) return `${checkout} is gone`
  const removed = existsSync(record.worktree)
    ? await run(['git', 'worktree', 'remove', record.worktree], checkout)
    : await run(['git', 'worktree', 'prune'], checkout)
  if (!removed.ok) return removed.stderr
  // Squash and rebase merges leave the branch unmerged as far as git knows, so -D.
  if (record.pr?.state === 'merged') await run(['git', 'branch', '-D', record.branch], checkout)
}

/** The preview check, or a note saying why there is none: it must not stop a sync. */
export async function previewOf(ws: Workspace, record: RunRecord, sha: string): Promise<Preview> {
  try {
    return await checkPreview(ws, record, sha)
  } catch (error) {
    return { sha, checked_at: new Date().toISOString(), results: [], note: (error as Error).message }
  }
}

/**
 * Reads the state of the run's PR. An open one gets its items checked on the preview of a new head commit, until a preview
 * answered; a merged or closed one gets its worktree removed. True when the record changed.
 */
async function syncRun(ws: Workspace, record: WithPr) {
  const view = await run([ghBin(), 'pr', 'view', record.pr.url, '--json', 'state,headRefOid,isDraft'])
  if (!view.ok) {
    console.error(`${record.id}: gh pr view ${record.pr.url}: ${view.stderr}`)
    return false
  }
  const pr = JSON.parse(view.stdout) as { state: string; headRefOid?: string; isDraft?: boolean }
  const state = pr.state.toLowerCase()
  if (state !== 'merged' && state !== 'closed') {
    let changed = false
    if (pr.isDraft !== undefined && pr.isDraft !== !!record.pr.draft) {
      record.pr.draft = pr.isDraft
      changed = true
    }
    const sha = pr.headRefOid
    if (sha && (record.preview?.sha !== sha || record.preview.results.length === 0)) {
      record.preview = await previewOf(ws, record, sha)
      changed = true
    }
    if (changed) await writeRecord(ws, record)
    return changed
  }
  record.pr.state = state
  const problem = await cleanUp(record)
  if (problem) console.error(`${record.id}: left ${record.worktree} in place: ${problem}`)
  await writeRecord(ws, record)
  return true
}

/** Syncs every run whose PR is open, or only the runs `ids`. Returns the records it changed. */
export async function syncRuns(ws: Workspace, ids: string[] = []) {
  const changed: RunRecord[] = []
  const records = ids.length ? await Promise.all(ids.map(id => readRecord(ws, id))) : await listRuns(ws)
  for (const record of records) {
    if (record.pr?.state === 'open' && (await syncRun(ws, record as WithPr))) changed.push(record)
  }
  return changed
}

async function withPr(ws: Workspace, id: string) {
  const record = await readRecord(ws, id)
  if (!record.pr) throw new RunError(`run ${id} has no pull request`)
  return record as WithPr
}

const PR_FIELDS = 'number,url,title,state,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,additions,deletions,changedFiles,files,body'

type Rollup =
  | { __typename: 'CheckRun'; name: string; status: string; conclusion: string }
  | { __typename: 'StatusContext'; context: string; state: string }

/** A check run's state is its progress and its conclusion the outcome; a commit status has one state for both. */
function checkOf(check: Rollup) {
  if (check.__typename === 'CheckRun') return { name: check.name, state: check.status, conclusion: check.conclusion }
  const pending = check.state === 'PENDING' || check.state === 'EXPECTED'
  return { name: check.context, state: pending ? 'PENDING' : 'COMPLETED', conclusion: pending ? '' : check.state }
}

/** The run's PR as `gh pr view` sees it, with the status rollup as `checks`. */
export async function prView(ws: Workspace, id: string) {
  const record = await withPr(ws, id)
  const view = await run([ghBin(), 'pr', 'view', record.pr.url, '--json', PR_FIELDS])
  if (!view.ok) throw new RunError(`gh pr view ${record.pr.url}: ${view.stderr}`)
  const { statusCheckRollup, ...pr } = JSON.parse(view.stdout) as { statusCheckRollup: Rollup[] }
  return { ...pr, checks: statusCheckRollup.map(checkOf) }
}

export const MERGE_METHODS = ['merge', 'squash', 'rebase']

/** Merges the run's PR, then syncs the run. Returns the record. */
export async function mergePr(ws: Workspace, id: string, method = 'merge') {
  if (!MERGE_METHODS.includes(method)) throw new RunError(`--method is one of ${MERGE_METHODS.join(', ')}`)
  const record = await withPr(ws, id)
  const merged = await run([ghBin(), 'pr', 'merge', record.pr.url, `--${method}`])
  if (!merged.ok) throw new RunError(`gh pr merge ${record.pr.url}: ${merged.stderr}`)
  await syncRun(ws, record)
  return record
}
