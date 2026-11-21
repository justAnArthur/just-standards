#!/usr/bin/env bun
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { type CellStatus, cellsOf, checkBusiness, statusOf } from '../core/cells.ts'
import { closeBrowser } from '../core/checks/browser.ts'
import { allowWorker, clone, initWorkspace, removeBusiness, removeWorker, setBusiness, setWorker } from '../core/config.ts'
import { fix } from '../core/fix.ts'
import { githubLogin, githubStatus } from '../core/github.ts'
import { ConfigError, loadWorkspace, type Workspace } from '../core/load.ts'
import { serveMcp } from '../core/mcp.ts'
import { fixPrompt, PromptError, specOf } from '../core/prompt.ts'
import { recheckLabeled } from '../core/labels.ts'
import { recipeProblems } from '../core/recipes.ts'
import { lines, listRuns, mergePr, prView, RunError, syncRuns, transcriptOf } from '../core/runs.ts'
import type { Result } from '../core/schema.ts'

const USAGE = `standards <command> [options]

  check [business…]                  run the checks and save the results
        --item <pack/item>  --asset <id>
  status [business…]                 the saved state of every cell
  prompt <business> <asset> <item…>  the fix instructions for a worker
        --branch <name>              (default standards/<asset>-<first item>)
  spec <business> <asset>            every standard the asset adopted, by category, with its recipe: a definition of done (Markdown)
        --severity must,should  --category seo,sharing
  fix <business> <asset> <item…>     a worker fixes the items in a new worktree and opens a PR; NDJSON
        --worker <id>  --interactive (permission questions on stdout, answers on stdin)
  runs [business…]                   the fix runs, newest first
  runs transcript <id>               everything Claude Code printed in a run
  runs sync [run…]                   read open PRs and check their previews; clean up after merged and closed ones;
                                     without runs, also re-check the std: labels of PRs merged and deployed since the last sync
  pr view <run>                      the run's pull request: state, checks, files, body
  pr merge <run>                     merge it, then sync the run
        --method merge|squash|rebase (default merge)
  validate                           load the workspace and every pack
  workspace                          the whole model as one JSON object: businesses, packs and their items, workers
  workspace init <dir>               make a workspace: businesses/, workers.yml with the presets, .gitignore
  worker set --json '<Worker>'       add a worker to workers.yml, or replace the one with its id
  worker remove <id>
  worker allow <id> <rule>           add a rule such as 'Bash(python3 -)' to the worker's allow list
  business set --json '<Business>'   write businesses/<id>.yml
  business remove <id>
  clone <business> <asset>           clone the asset's repo (or reuse a checkout) and set its path
        --into <dir>                 (default ~/Projects/<owner>/<name>)
  github status                      who gh is signed in as
  github login                       sign gh in through the browser
  mcp --run <id>                     the MCP server a fix run's worker calls finish on (stdio)

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
    run: { type: 'string' },
    into: { type: 'string' },
    method: { type: 'string' },
    severity: { type: 'string' },
    category: { type: 'string' },
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
      cell =>
        (!flags.item || cell.item.key === flags.item) &&
        (!flags.asset || cell.asset.id === flags.asset) &&
        // A probe a firewall reads as an attack runs only when named, or where the business allows it.
        (!cell.item.intrusive || business.intrusive || flags.item === cell.item.key),
    )
    if (!json) console.log(`\n${business.name} · ${cells.length} checks`)
    await checkBusiness(ws, business, cells, printResult)
  }
  // browser items share one Chromium; closed now rather than after its idle wait
  await closeBrowser()
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
  const dir = flags.workspace ?? process.env.STANDARDS_WORKSPACE ?? process.cwd()

  // These run without a loaded workspace: there may not be one yet, and the MCP server must start fast.
  if (command === 'mcp') {
    if (!flags.run) throw new RunError('usage: standards mcp --run <id>')
    return serveMcp(dir, flags.run, lines(Bun.stdin.stream()), text => process.stdout.write(`${text}\n`))
  }
  if (command === 'github') return github(rest[0])
  if (command === 'workspace' && rest[0] === 'init') {
    if (!rest[1]) throw new ConfigError('usage: standards workspace init <dir>')
    return line({ dir: await initWorkspace(rest[1]) })
  }

  const ws = await loadWorkspace(dir)

  if (command === 'check') return check(ws, rest)
  if (command === 'status') return status(ws, rest)
  if (command === 'validate') {
    const items = [...ws.packs.values()].reduce((sum, pack) => sum + pack.entries.length, 0)
    const problems = await recipeProblems(ws)
    const counts = `${ws.businesses.length} businesses, ${ws.workers.length} workers, ${ws.packs.size} packs, ${items} items`
    if (problems.length === 0) return console.log(`${counts}: valid`)
    // A recipe that doesn't say when it is done, or when to hand off, sends a worker off to guess (packs/RECIPE.md).
    console.error(`${counts}; ${problems.length} recipes don't follow packs/RECIPE.md:\n${problems.map(p => `  ${p}`).join("\n")}`)
    process.exit(1)
  }
  if (command === 'workspace') return console.log(JSON.stringify(await model(ws)))
  if (command === 'prompt') {
    const [businessId, assetId, ...items] = rest
    if (!businessId || !assetId || items.length === 0) throw new PromptError('usage: standards prompt <business> <asset> <item…>')
    const [business] = pick(ws, [businessId])
    const branch = flags.branch ?? `standards/${assetId}-${items[0]!.split('/')[1]}`
    return console.log(await fixPrompt(ws, business!, assetId, items, branch))
  }
  if (command === 'spec') {
    const [businessId, assetId] = rest
    if (!businessId || !assetId) throw new PromptError('usage: standards spec <business> <asset> [--severity must,should] [--category seo,…]')
    const [business] = pick(ws, [businessId])
    const list = (value?: string) => value?.split(',').map(part => part.trim()).filter(Boolean)
    return console.log(await specOf(ws, business!, assetId, { severities: list(flags.severity), categories: list(flags.category) }))
  }
  if (command === 'fix') return runFix(ws, rest)
  if (command === 'runs') return runs(ws, rest)
  if (command === 'pr') return pr(ws, rest)
  if (command === 'worker') return worker(ws, rest)
  if (command === 'business') return business(ws, rest)
  if (command === 'clone') {
    const [businessId, assetId] = rest
    if (!businessId || !assetId) throw new ConfigError('usage: standards clone <business> <asset> [--into <dir>]')
    return line({ path: await clone(ws, businessId, assetId, flags.into) })
  }
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
  const records = sub === 'sync' ? await syncRuns(ws, rest) : await listRuns(ws, sub ? [sub, ...rest] : [])
  for (const record of records) line(record)
  // A full sync also checks again what labeled PRs changed, once they are deployed.
  if (sub === 'sync' && rest.length === 0) for (const recheck of await recheckLabeled(ws)) line(recheck)
}

async function pr(ws: Workspace, [sub, id]: string[]) {
  if (sub === 'view' && id) return line(await prView(ws, id))
  if (sub === 'merge' && id) return line(await mergePr(ws, id, flags.method))
  throw new RunError('usage: standards pr view <run> | pr merge <run> [--method merge|squash|rebase]')
}

// `--json` is the output flag, so the object after it arrives as a positional.
async function worker(ws: Workspace, [sub, ...args]: string[]) {
  if (sub === 'set') return line(await setWorker(ws, args[0]))
  if (sub === 'remove' && args[0]) return removeWorker(ws, args[0])
  if (sub === 'allow' && args[0] && args[1]) return line(await allowWorker(ws, args[0], args[1]))
  throw new ConfigError("usage: standards worker set --json '<Worker>' | worker remove <id> | worker allow <id> <rule>")
}

async function business(ws: Workspace, [sub, arg]: string[]) {
  if (sub === 'set') return line(await setBusiness(ws, arg))
  if (sub === 'remove' && arg) return removeBusiness(ws, arg)
  throw new ConfigError("usage: standards business set --json '<Business>' | business remove <id>")
}

async function github(sub: string | undefined) {
  if (sub === 'status') return line(await githubStatus())
  if (sub === 'login') process.exit(await githubLogin())
  throw new RunError('usage: standards github status | github login')
}

main().catch(error => {
  if (!(error instanceof ConfigError || error instanceof PromptError || error instanceof RunError)) throw error
  console.error(error.message)
  process.exit(1)
})
