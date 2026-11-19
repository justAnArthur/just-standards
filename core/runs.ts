import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { run } from './checks/github.ts'
import type { Workspace } from './load.ts'
import type { RunRecord } from './schema.ts'

export class RunError extends Error {}

export const ghBin = () => process.env.STANDARDS_GH_BIN ?? 'gh'
export const runsDir = (ws: Workspace) => join(ws.dir, '.state', 'runs')

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
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
}

export function transcriptOf(ws: Workspace, id: string) {
  const path = join(runsDir(ws), id, 'events.ndjson')
  if (!/^[\w-]+$/.test(id) || !existsSync(path)) throw new RunError(`no run ${id}`)
  return Bun.file(path)
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

/** Reads the state of every open PR; merged or closed ones get their worktree removed. Returns the records it changed. */
export async function syncRuns(ws: Workspace) {
  const changed: RunRecord[] = []
  for (const record of await listRuns(ws)) {
    if (record.pr?.state !== 'open') continue
    const view = await run([ghBin(), 'pr', 'view', record.pr.url, '--json', 'state'])
    if (!view.ok) {
      console.error(`${record.id}: gh pr view ${record.pr.url}: ${view.stderr}`)
      continue
    }
    const state = (JSON.parse(view.stdout) as { state: string }).state.toLowerCase()
    if (state !== 'merged' && state !== 'closed') continue
    record.pr.state = state
    const problem = await cleanUp(record)
    if (problem) console.error(`${record.id}: left ${record.worktree} in place: ${problem}`)
    await writeRecord(ws, record)
    changed.push(record)
  }
  return changed
}
