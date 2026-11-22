import { mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { blockersOf, cellsOf, readResults } from './cells.ts'
import { cleanEnv } from './checks/ai.ts'
import { run } from './checks/github.ts'
import { installDeps, managerOf } from './deps.ts'
import { expandHome, type Workspace } from './load.ts'
import { type Finish, finishFile } from './mcp.ts'
import { fixPrompt } from './prompt.ts'
import { labelPr } from './labels.ts'
import { hasDeployments } from './preview.ts'
import { createWorktree, ghBin, lines, previewOf, RunError, runsDir, writeRecord } from './runs.ts'
import type { Business, RunRecord, Worker } from './schema.ts'

export type RunEvent = { type: 'run'; event: 'started' | 'finished'; run: RunRecord } | { type: 'claude'; line: string }

export interface FixOptions {
  worker: string
  interactive?: boolean
  /** With `interactive`, lines for Claude Code's stdin: the app's control responses. */
  input?: AsyncIterable<string>
  signal?: AbortSignal
  emit: (event: RunEvent) => void
}

interface Result {
  subtype: string
  is_error: boolean
  result?: string
  total_cost_usd?: number
  session_id?: string
}

const KILL_AFTER_MS = 5000
const PR_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/g

const CLI = join(import.meta.dir, '../cli/standards.ts')
const FINISH_TOOL = 'mcp__standards__finish'
/** What every run needs besides the worker's own rules: reading its PR's checks and their logs. */
const RUN_TOOLS = [FINISH_TOOL, 'Bash(gh pr checks *)', 'Bash(gh run view *)']

const claudeBin = () => process.env.STANDARDS_CLAUDE_BIN ?? 'claude'
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

function killGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal)
  } catch {}
}

function parse(line: string) {
  try {
    return JSON.parse(line) as { type?: string; subtype?: string; session_id?: string }
  } catch {
    return undefined
  }
}

/** This CLI's `mcp` command, started the way this process was, so the worker can call `finish`. */
const mcpConfig = (ws: Workspace, id: string) =>
  JSON.stringify({ mcpServers: { standards: { type: 'stdio', command: process.execPath, args: [CLI, 'mcp', '--run', id, '--workspace', ws.dir] } } })

function args(worker: Worker, interactive: boolean, packDirs: string[], mcp: string, tools: string[]) {
  return [
    claudeBin(),
    ...['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', worker.model],
    // echoes the prompt back, so the recorded transcript starts with what the worker was asked
    '--replay-user-messages',
    ...(worker.effort ? ['--effort', worker.effort] : []),
    ...['--permission-mode', worker.permission_mode],
    ...(interactive ? ['--permission-prompt-tool', 'stdio'] : []),
    ...['--mcp-config', mcp],
    ...['--allowedTools', ...new Set([...worker.allow, ...RUN_TOOLS, ...tools])],
    // a recipe can point at files in its pack (the repo pack's skill), which live outside the worktree
    ...packDirs.flatMap(dir => ['--add-dir', dir]),
  ]
}

const packDirsOf = (ws: Workspace, items: string[]) =>
  [...new Set(items.map(key => ws.packs.get(key.split('/')[0] as string)?.dir).filter((dir): dir is string => !!dir))]

function env(worker: Worker) {
  const profile = resolve(expandHome(worker.profile))
  return profile === join(homedir(), '.claude') ? cleanEnv() : { ...cleanEnv(), CLAUDE_CONFIG_DIR: profile }
}

async function findPr(text: string, branch: string, worktree: string): Promise<RunRecord['pr']> {
  const url = [...text.matchAll(PR_URL)].at(-1)
  if (url) return { url: url[0], number: Number(url[1]), state: 'open' }
  try {
    const listed = await run([ghBin(), 'pr', 'list', '--head', branch, '--json', 'url,number'], worktree)
    const [pr] = listed.ok ? (JSON.parse(listed.stdout) as { url: string; number: number }[]) : []
    return pr && { url: pr.url, number: pr.number, state: 'open' }
  } catch {
    return undefined
  }
}

async function markDraft(pr: NonNullable<RunRecord['pr']>, cwd: string) {
  const undone = await run([ghBin(), 'pr', 'ready', pr.url, '--undo'], cwd)
  if (undone.ok || /already.*draft/i.test(undone.stderr)) pr.draft = true
}

/** Two runs of one item started in the same second would share an id. */
async function newRunDir(ws: Workspace, base: string) {
  await mkdir(runsDir(ws), { recursive: true })
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`
    const created = await mkdir(join(runsDir(ws), id)).then(
      () => true,
      error => (error.code === 'EEXIST' ? false : Promise.reject(error)),
    )
    if (created) return id
  }
}

/** The programs the items need that aren't on PATH. */
const missingTools = (tools: string[]) => tools.filter(tool => !Bun.which(tool))

async function validate(ws: Workspace, business: Business, assetId: string, items: string[], workerId: string) {
  const worker = ws.workers.find(w => w.id === workerId)
  if (!worker) throw new RunError(`no worker ${workerId} in workers.yml`)
  const asset = business.assets.find(a => a.id === assetId)
  if (!asset) throw new RunError(`${business.id} has no asset ${assetId}`)
  if (!asset.path) throw new RunError(`${business.id}/${assetId} has no path: no local checkout`)
  if (!asset.repo) throw new RunError(`${business.id}/${assetId} has no repo`)
  const cells = cellsOf(business, ws).filter(cell => cell.asset.id === assetId)
  const stray = items.find(key => !cells.some(cell => cell.item.key === key))
  if (stray) throw new RunError(`${stray} does not apply to ${business.id}/${assetId}`)
  const picked = cells.filter(cell => items.includes(cell.item.key))

  // A worker sent before what an item builds on exists would only hand the gap back to a person.
  const results = await readResults(ws, business.id)
  for (const cell of picked) {
    const blockers = blockersOf(business, ws, cell, results)
    if (blockers.length) throw new RunError(`${cell.item.key} on ${assetId} is blocked by ${blockers.join(', ')}: fix that first`)
  }
  const tools = [...new Set(picked.flatMap(cell => cell.item.tools))]
  const missing = missingTools(tools)
  if (missing.length) throw new RunError(`${items.join(', ')} needs ${missing.join(', ')}, which isn't installed (brew install ${missing.join(' ')})`)
  return { worker, path: expandHome(asset.path), tools }
}

/** Runs a worker on failing items of one asset, in a fresh worktree, until it opens a PR. Resolves with the final record. */
export async function fix(ws: Workspace, business: Business, assetId: string, items: string[], options: FixOptions) {
  const { worker, path, tools: needed } = await validate(ws, business, assetId, items, options.worker)
  // The asset in the name: several sites can share one repo, and each gets its own worktree and branch.
  const name = `${assetId}-${items[0]!.split('/')[1]!}`
  const { branch, worktree } = await createWorktree(path, name)

  const started = new Date()
  const id = await newRunDir(ws, `${stamp(started)}-${business.id}-${name}`)
  const record: RunRecord = {
    id,
    business: business.id,
    asset: assetId,
    items,
    worker: worker.id,
    model: worker.model,
    branch,
    worktree,
    started_at: started.toISOString(),
    state: 'running',
  }
  await writeRecord(ws, record)
  options.emit({ type: 'run', event: 'started', run: record })

  const finish = async (state: RunRecord['state'], error?: string) => {
    const finished = new Date()
    Object.assign(record, { finished_at: finished.toISOString(), ms: finished.getTime() - started.getTime(), state, error })
    options.signal?.removeEventListener('abort', stop)
    await writeRecord(ws, record)
    options.emit({ type: 'run', event: 'finished', run: record })
    return record
  }

  // Without dependencies the worker can't run the repo's typecheck or tests, and finds out only from CI.
  record.setup = await installDeps(worktree, options.signal)
  if (options.signal?.aborted) return finish('stopped', `stopped by ${String(options.signal.reason ?? 'abort')}`)
  await writeRecord(ws, record)
  const prompt = await fixPrompt(ws, business, assetId, items, branch, { setup: record.setup, tools: needed })
  // The repo's package manager, so the worker can run its scripts, and the programs the items need.
  const tools = [...(managerOf(worktree)?.tools ?? []), ...needed.map(tool => `Bash(${tool} *)`)]

  let stopped: string | undefined
  let open = true
  let proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'>
  try {
    proc = Bun.spawn(args(worker, !!options.interactive, packDirsOf(ws, items), mcpConfig(ws, id), tools), {
      cwd: worktree,
      env: env(worker),
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      detached: true,
    })
  } catch (error) {
    return finish('failed', `couldn't start ${claudeBin()}: ${(error as Error).message}`)
  }
  const stderr = new Response(proc.stderr).text()
  void proc.exited.then(() => {
    open = false
    // Whatever Claude Code left behind would otherwise hold its stdout open.
    killGroup(proc.pid, 'SIGTERM')
  })

  function stop() {
    stopped = String(options.signal!.reason ?? 'abort')
    killGroup(proc.pid, 'SIGTERM')
    setTimeout(() => killGroup(proc.pid, 'SIGKILL'), KILL_AFTER_MS).unref()
  }
  if (options.signal?.aborted) stop()
  options.signal?.addEventListener('abort', stop, { once: true })

  const send = (line: string) => {
    if (!open) return
    try {
      proc.stdin.write(`${line}\n`)
      proc.stdin.flush()
    } catch {}
  }
  send(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] }, parent_tool_use_id: null }))
  if (options.interactive && options.input) {
    void (async () => {
      for await (const line of options.input!) if (line.trim()) send(line)
    })()
  }

  const events = Bun.file(join(runsDir(ws), id, 'events.ndjson')).writer()
  const output = lines(proc.stdout)[Symbol.asyncIterator]()
  /** Claude Code's output up to its next result, recorded and passed on; undefined when it ends first. */
  async function nextResult(): Promise<Result | undefined> {
    for (let next = await output.next(); !next.done; next = await output.next()) {
      const line = next.value
      events.write(`${line}\n`)
      events.flush()
      options.emit({ type: 'claude', line })
      const message = parse(line)
      if (message?.type === 'system' && message.subtype === 'init') record.session_id = message.session_id
      if (message?.type === 'result') return message as Result
    }
    return undefined
  }
  const readFinish = async () => {
    const finished = (await Bun.file(finishFile(ws.dir, id)).json().catch(() => undefined)) as Finish | undefined
    if (finished) Object.assign(record, { summary: finished.summary, missing: finished.missing })
    return finished
  }

  let result = await nextResult()
  let failing: string[] = []
  // Each round ends with a result. The worker is sent back while its items still fail on the PR's preview.
  for (let round = 0; result && !stopped; round++) {
    const finished = await readFinish()
    record.cost_usd = result.total_cost_usd ?? record.cost_usd
    record.session_id = result.session_id ?? record.session_id
    if (result.is_error || result.subtype !== 'success') break
    // A PR given to `finish` wins over one in the text.
    record.pr ??= await findPr(finished?.pr_url ?? result.result ?? '', branch, worktree)
    if (!record.pr) break
    // The labels say which standards the PR touches; after it is merged and deployed, only those are checked again.
    if (round === 0) await labelPr(record.pr.url, ws, items, worktree)
    record.preview = await verify(ws, record, worktree, options.signal)
    failing = record.preview?.results.filter(r => r.state !== 'pass').map(r => r.item) ?? []
    await writeRecord(ws, record)
    // Stop when it passes, can't be checked, or the rounds are used up. Naming something `missing` doesn't stop it:
    // workers put work there they could do (a nonce CSP, a soft 404), so they are sent back and asked again.
    if (failing.length === 0 || round >= MAX_ROUNDS || stopped) break
    record.rounds = round + 1
    await unlink(finishFile(ws.dir, id)).catch(() => {})
    send(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: sendBack(record.preview!, record.missing) }] }, parent_tool_use_id: null }))
    result = await nextResult()
  }
  open = false
  try {
    proc.stdin.end()
  } catch {}
  while (!(await output.next()).done);
  await events.end()
  const code = await proc.exited

  if (stopped) return finish('stopped', `stopped by ${stopped}`)
  if (!result) return finish('failed', `claude exited ${code} without a result ${(await stderr).trim().slice(-300)}`.trim())
  if (result.is_error || result.subtype !== 'success') return finish('failed', (result.result || result.subtype).slice(0, 300))
  if (!record.pr) return finish('failed', 'no pull request')
  const checked = (record.preview?.results.length ?? 0) > 0
  if (checked) record.verified = failing.length === 0
  if (failing.length) record.unverified = failing
  // A PR that still needs a person, or still fails on its preview, reads as a draft, whatever the worker opened.
  if (record.missing?.length || failing.length) await markDraft(record.pr, worktree)
  return finish('done')
}

/** How many times a worker is sent back to an item that still fails on the preview. */
const MAX_ROUNDS = 2
/** How long to wait for a preview deployment of the PR's head, in a repo that has deployments. */
const PREVIEW_WAIT_MS = 10 * 60_000
const PREVIEW_POLL_MS = 20_000

/** The run's items on the preview of its PR's head commit, waiting a while for the deployment. */
async function verify(ws: Workspace, record: RunRecord, worktree: string, signal?: AbortSignal) {
  const head = await run([ghBin(), 'pr', 'view', record.pr!.url, '--json', 'headRefOid'], worktree)
  const sha = head.ok ? (JSON.parse(head.stdout) as { headRefOid?: string }).headRefOid : undefined
  if (!sha) return record.preview
  const asset = ws.businesses.find(b => b.id === record.business)?.assets.find(a => a.id === record.asset)
  const deadline = Date.now() + (asset?.url && asset.repo && (await hasDeployments(asset.repo)) ? PREVIEW_WAIT_MS : 0)
  for (;;) {
    const preview = await previewOf(ws, record, sha)
    const waiting = preview.note?.startsWith('no preview deployment')
    if (!waiting || Date.now() >= deadline || signal?.aborted) return preview
    await Bun.sleep(previewPollMs())
  }
}

const previewPollMs = () => Number(process.env.STANDARDS_PREVIEW_POLL_MS ?? PREVIEW_POLL_MS)

/** The message that sends a worker back: what still fails on the preview, and what to do. */
function sendBack(preview: NonNullable<RunRecord['preview']>, missing: string[] = []) {
  const failing = preview.results.filter(r => r.state !== 'pass')
  return [
    `These standards still fail on the PR's preview (${preview.url ?? 'its worktree'}, commit ${preview.sha.slice(0, 7)}):`,
    '',
    ...failing.map(r => `- \`${r.item}\`: ${r.evidence}`),
    '',
    ...(missing.length
      ? [
          'You named these as missing:',
          '',
          ...missing.map(line => `- ${line}`),
          '',
          '`missing` is only for what a person must give: a secret, a paid account, a legal fact that is neither on the site nor in the business context. A change that is large, touches many files, needs a framework detail looked up, or "deserves a PR of its own" is work, not missing: do it now, in this PR.',
          '',
        ]
      : []),
    'Fix them on the same branch, push, wait for the checks again, and call `finish` again with the same PR URL. If only a person can fix one, say exactly what they must give in `missing`.',
  ].join('\n')
}
