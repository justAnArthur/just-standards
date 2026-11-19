#!/usr/bin/env bun
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { type CellStatus, cellsOf, checkBusiness, statusOf } from '../core/cells.ts'
import { fix } from '../core/fix.ts'
import { ConfigError, loadWorkspace, type Workspace } from '../core/load.ts'
import { fixPrompt, PromptError } from '../core/prompt.ts'
import { lines, listRuns, RunError, syncRuns, transcriptOf } from '../core/runs.ts'
import type { Result } from '../core/schema.ts'

const USAGE = `standards <command> [options]

  check [business…]                  run the checks and save the results
        --item <pack/item>  --asset <id>
  status [business…]                 the saved state of every cell
  prompt <business> <asset> <item…>  the fix instructions for a worker
        --branch <name>              (default standards/<first item>)
  fix <business> <asset> <item…>     a worker fixes the items in a new worktree and opens a PR; NDJSON
        --worker <id>  --interactive (permission questions on stdout, answers on stdin)
  runs [business…]                   the fix runs, newest first
  runs transcript <id>               everything Claude Code printed in a run
  runs sync                          read open PRs; clean up the worktrees of merged and closed ones
  validate                           load the workspace and every pack
  workspace                          the whole model as one JSON object: businesses, packs and their items, workers

  --workspace <dir>   default $STANDARDS_WORKSPACE, then the current directory
  --json              one JSON object per line (also when stdout is not a terminal)`

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    workspace: { type: 'string' },
    json: { type: 'boolean' },
    item: { type: 'string' },
    asset: { type: 'string' },
    branch: { type: 'string' },
    worker: { type: 'string' },
    interactive: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
})

const json = flags.json || !process.stdout.isTTY
const tty = process.stdout.isTTY
const paint = (code: number, text: string) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text)
const GLYPH: Record<CellStatus['state'], string> = {
  pass: paint(32, '✓'),
  'pass-older': paint(32, 'v'),
  fail: paint(31, '✕'),
  error: paint(33, '!'),
  stale: paint(90, '◷'),
  unchecked: paint(90, '·'),
  waived: paint(90, '–'),
}

const line = (value: object) => console.log(JSON.stringify(value))
const short = (text: string, max = 110) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

function pick(ws: Workspace, ids: string[]) {
  if (ids.length === 0) return ws.businesses
  return ids.map(id => {
    const business = ws.businesses.find(b => b.id === id)
    if (!business) throw new ConfigError(`no business ${id} in ${ws.dir}/businesses`)
    return business
  })
}

function printResult(result: Result) {
  if (json) return line({ type: 'result', ...result })
  const glyph = GLYPH[result.state]
  console.log(`  ${glyph} ${result.asset.padEnd(10)} ${result.item.padEnd(28)} ${paint(90, short(result.evidence))}`)
}

async function check(ws: Workspace, ids: string[]) {
  for (const business of pick(ws, ids)) {
    const cells = cellsOf(business, ws).filter(
      cell => (!flags.item || cell.item.key === flags.item) && (!flags.asset || cell.asset.id === flags.asset),
    )
    if (!json) console.log(`\n${business.name} · ${cells.length} checks`)
    await checkBusiness(ws, business, cells, printResult)
  }
}

async function status(ws: Workspace, ids: string[]) {
  for (const business of pick(ws, ids)) {
    const cells = await statusOf(ws, business)
    if (json) {
      for (const cell of cells) line({ type: 'cell', business: business.id, ...cell })
      continue
    }
    const counted = cells.filter(cell => cell.state !== 'waived')
    const passing = counted.filter(cell => cell.state === 'pass').length
    console.log(`\n${business.name} · ${passing}/${counted.length} passing`)
    for (const cell of cells) {
      const note = cell.waiver ? `waived: ${cell.waiver.reason}` : (cell.result?.evidence ?? '')
      console.log(`  ${GLYPH[cell.state]} ${cell.asset.padEnd(10)} ${cell.item.padEnd(28)} ${paint(90, short(note))}`)
    }
  }
}

const readRecipe = async (dir: string) => {
  const file = Bun.file(join(dir, 'recipe.md'))
  return (await file.exists()) ? (await file.text()).trim() : undefined
}

/** What an app needs to draw the grid and its details: the config as loaded, each item with its recipe instead of its folder. */
async function model(ws: Workspace) {
  const packs = await Promise.all(
    [...ws.packs.values()].map(async ({ dir: _, entries, ...pack }) => ({
      ...pack,
      items: await Promise.all(entries.map(async ({ dir, ...item }) => ({ ...item, recipe: await readRecipe(dir) }))),
    })),
  )
  return { dir: ws.dir, businesses: ws.businesses, packs, workers: ws.workers }
}

async function main() {
  const [command, ...rest] = positionals
  if (flags.help || !command) return console.log(USAGE)
  const ws = await loadWorkspace(flags.workspace ?? process.env.STANDARDS_WORKSPACE ?? process.cwd())

  if (command === 'check') return check(ws, rest)
  if (command === 'status') return status(ws, rest)
  if (command === 'validate') {
    const items = [...ws.packs.values()].reduce((sum, pack) => sum + pack.entries.length, 0)
    return console.log(`${ws.businesses.length} businesses, ${ws.workers.length} workers, ${ws.packs.size} packs, ${items} items: valid`)
  }
  if (command === 'workspace') return console.log(JSON.stringify(await model(ws)))
  if (command === 'prompt') {
    const [businessId, assetId, ...items] = rest
    if (!businessId || !assetId || items.length === 0) throw new PromptError('usage: standards prompt <business> <asset> <item…>')
    const [business] = pick(ws, [businessId])
    const branch = flags.branch ?? `standards/${items[0]!.split('/')[1]}`
    return console.log(await fixPrompt(ws, business!, assetId, items, branch))
  }
  if (command === 'fix') return runFix(ws, rest)
  if (command === 'runs') return runs(ws, rest)
  throw new ConfigError(`unknown command ${command}\n\n${USAGE}`)
}

async function runFix(ws: Workspace, [businessId, assetId, ...items]: string[]) {
  if (!businessId || !assetId || items.length === 0 || !flags.worker) {
    throw new RunError('usage: standards fix <business> <asset> <item…> --worker <id> [--interactive]')
  }
  const [business] = pick(ws, [businessId])
  const controller = new AbortController()
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => controller.abort(signal))
  const record = await fix(ws, business!, assetId, items, {
    worker: flags.worker,
    interactive: flags.interactive,
    input: flags.interactive ? lines(Bun.stdin.stream()) : undefined,
    signal: controller.signal,
    emit: line,
  })
  // stdin may still be open, and would keep the process alive.
  process.exit(record.state === 'done' ? 0 : 1)
}

async function runs(ws: Workspace, [sub, ...rest]: string[]) {
  if (sub === 'transcript') {
    if (!rest[0]) throw new RunError('usage: standards runs transcript <id>')
    return process.stdout.write(await transcriptOf(ws, rest[0]).text())
  }
  const records = sub === 'sync' ? await syncRuns(ws) : await listRuns(ws, sub ? [sub, ...rest] : [])
  for (const record of records) line(record)
}

main().catch(error => {
  if (!(error instanceof ConfigError || error instanceof PromptError || error instanceof RunError)) throw error
  console.error(error.message)
  process.exit(1)
})
