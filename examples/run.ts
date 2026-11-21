#!/usr/bin/env bun
// Builds the two example sites, serves them, checks both businesses with every pack in packs/ and writes
// examples/results/{before,after}.ndjson and summary.md. The servers are always stopped, even when a step fails.
//
//   bun examples/run.ts              build, serve, check, summarize
//   bun examples/run.ts --no-build   reuse the last builds
//
// Needs bun, git and the `claude` CLI (the AI checks run on haiku). The repo checks read the files git tracks, so
// commit or `git add` changes to examples/rental-* before a run.
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const EXAMPLES = import.meta.dir
const WORKSPACE = join(EXAMPLES, 'workspace')
const RESULTS = join(EXAMPLES, 'results')
/** Packs a local example can't adopt: `repo` reads the asset's GitHub repo (description, topics, homepage). */
const SKIPPED_PACKS = new Set(['repo'])
const READY_TIMEOUT_MS = 90_000

interface Site {
  name: 'before' | 'after'
  business: string
  dir: string
  port: number
}

const SITES: Site[] = [
  { name: 'before', business: 'rental-before', dir: join(EXAMPLES, 'rental-before'), port: 3101 },
  { name: 'after', business: 'rental-after', dir: join(EXAMPLES, 'rental-after'), port: 3102 },
]

interface Result {
  type: 'result'
  business: string
  asset: string
  item: string
  state: 'pass' | 'fail' | 'error'
  evidence: string
  ms: number
}

const started = performance.now()
const log = (message: string) => console.error(`[${((performance.now() - started) / 1000).toFixed(0).padStart(4)} s] ${message}`)

async function run(cmd: string[], cwd: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn(cmd, { cwd, env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  if (code !== 0) throw new Error(`${cmd.join(' ')} in ${cwd} exited ${code}:\n${(stderr || stdout).trim().slice(-2000)}`)
  return stdout
}

/** Every pack in packs/, but the ones a local example can't adopt. */
async function packIds() {
  const ids: string[] = []
  for await (const file of new Bun.Glob('*/pack.yml').scan(join(ROOT, 'packs'))) ids.push(file.split('/')[0] as string)
  return ids.filter(id => !SKIPPED_PACKS.has(id)).sort()
}

/** Sets the `packs:` line of a business file, keeping its comments and everything else. */
async function adoptPacks(business: string, packs: string[]) {
  const path = join(WORKSPACE, 'businesses', `${business}.yml`)
  const text = await Bun.file(path).text()
  const line = `packs: [${packs.join(', ')}]`
  if (!/^packs:.*$/m.test(text)) throw new Error(`${path} has no packs: line`)
  await Bun.write(path, text.replace(/^packs:.*$/m, line))
}

async function portBusy(port: number) {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1000) })
    return true
  } catch {
    return false
  }
}

async function waitReady(site: Site, server: Bun.Subprocess) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`${site.name}: next start exited ${server.exitCode}`)
    try {
      const response = await fetch(`http://localhost:${site.port}/`, { signal: AbortSignal.timeout(2000) })
      await response.body?.cancel()
      if (response.status < 500) return
    } catch {}
    await Bun.sleep(250)
  }
  throw new Error(`${site.name} did not answer on :${site.port} within ${READY_TIMEOUT_MS / 1000} s`)
}

const servers: Bun.Subprocess[] = []

async function stopServers() {
  for (const server of servers.splice(0)) {
    if (server.exitCode !== null) continue
    server.kill('SIGTERM')
    const stopped = await Promise.race([server.exited.then(() => true), Bun.sleep(5000).then(() => false)])
    if (!stopped) server.kill('SIGKILL')
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await stopServers()
    process.exit(130)
  })
}

function summarize(results: Record<Site['name'], Result[]>, packs: string[], seconds: number) {
  const byPack = (list: Result[], pack: string) => {
    const own = list.filter(result => result.item.startsWith(`${pack}/`))
    return { pass: own.filter(result => result.state === 'pass').length, total: own.length }
  }
  const cell = ({ pass, total }: { pass: number; total: number }) => (total === 0 ? '–' : `${pass}/${total}`)
  const rows = packs.map(pack => `| ${pack} | ${cell(byPack(results.before, pack))} | ${cell(byPack(results.after, pack))} |`)
  const total = (list: Result[]) => ({ pass: list.filter(result => result.state === 'pass').length, total: list.length })
  const open = results.after.filter(result => result.state !== 'pass')
  const lines = [
    '# Before and after',
    '',
    `Checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC with ${packs.length} packs, in ${Math.round(seconds)} s. Passing checks per pack; waived cells (production-only, the same for both) are not counted.`,
    '',
    '| pack | before | after |',
    '|---|---|---|',
    ...rows,
    `| **total** | **${cell(total(results.before))}** | **${cell(total(results.after))}** |`,
    '',
    open.length === 0
      ? 'Every checked item passes on the after site.'
      : ['Still open on the after site:', '', ...open.map(result => `- \`${result.item}\` (${result.asset}, ${result.state}): ${result.evidence.replace(/\s+/g, ' ').slice(0, 300)}`)].join('\n'),
    '',
  ]
  return lines.join('\n')
}

async function main() {
  const build = !process.argv.includes('--no-build')
  const packs = await packIds()
  log(`packs: ${packs.join(', ')}`)
  for (const site of SITES) await adoptPacks(site.business, packs)

  const untracked = await run(['git', 'status', '--porcelain', '--', 'examples/rental-before', 'examples/rental-after'], ROOT)
  if (untracked.trim()) log('warning: examples/rental-* has uncommitted changes; the repo checks read only what git tracks')

  for (const site of SITES) {
    if (await portBusy(site.port)) throw new Error(`port ${site.port} is in use: stop whatever serves it, then run again`)
  }

  if (build) {
    for (const site of SITES) {
      log(`${site.name}: bun install`)
      await run(['bun', 'install', '--frozen-lockfile'], site.dir)
      log(`${site.name}: next build`)
      await run(['bun', 'run', 'build'], site.dir, { NEXT_TELEMETRY_DISABLED: '1' })
    }
  }

  const results = { before: [] as Result[], after: [] as Result[] }
  try {
    for (const site of SITES) {
      log(`${site.name}: next start -p ${site.port}`)
      const server = Bun.spawn([join(site.dir, 'node_modules/.bin/next'), 'start', '-p', String(site.port)], {
        cwd: site.dir,
        env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
        stdout: 'ignore',
        stderr: 'pipe',
      })
      servers.push(server)
      await waitReady(site, server)
    }

    log('checking both businesses')
    await mkdir(RESULTS, { recursive: true })
    await Promise.all(
      SITES.map(async site => {
        const out = await run(['bun', 'cli/standards.ts', 'check', site.business, '--workspace', WORKSPACE, '--json'], ROOT)
        const list = out
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line) as Result)
          .filter(result => result.type === 'result')
          .sort((a, b) => a.asset.localeCompare(b.asset) || a.item.localeCompare(b.item))
        results[site.name] = list
        await Bun.write(join(RESULTS, `${site.name}.ndjson`), `${list.map(result => JSON.stringify(result)).join('\n')}\n`)
        log(`${site.name}: ${list.filter(result => result.state === 'pass').length}/${list.length} passing`)
      }),
    )
  } finally {
    await stopServers()
    log('servers stopped')
  }

  const seconds = (performance.now() - started) / 1000
  const summary = summarize(results, packs, seconds)
  await Bun.write(join(RESULTS, 'summary.md'), summary)
  console.log(summary)
}

main().catch(async error => {
  await stopServers()
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
