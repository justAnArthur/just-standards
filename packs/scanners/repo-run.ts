// lint-clean and typecheck-clean: the repo's own commands, run on a fresh worktree of the committed code.

import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, rmdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Context } from '../../core/checks/context.ts'
import { run } from '../../core/checks/github.ts'
import { installDeps, managerOf } from '../../core/deps.ts'
import { expandHome } from '../../core/load.ts'
import type { Outcome } from '../../core/schema.ts'
import { exec, listed, plain, type Ran } from './shared.ts'

const TIMEOUT_MS = 10 * 60_000
const SHOWN = 5
/** The run's own worktree (core/fix.ts names them `std-<asset>-<item>`), or one of ours: checked in place. */
const OWN_WORKTREE = /\/\.worktrees\/std-[^/]+(\/|$)/
const TYPECHECK_SCRIPTS = ['typecheck', 'type-check', 'check-types', 'types:check', 'tsc']
/** A `check` script that runs tsc, or each workspace's `check` (modo: `bun --filter '*' check`). */
const TS_CHECK = /\btsc\b|--filter|(^|\s)-r(\s|$)|--recursive|--workspaces|\bturbo\b|\bnx\b/

export interface Command {
  /** For evidence: `pnpm run lint`. */
  label: string
  cmd: string[]
}

export interface RepoRun {
  lint: Outcome
  typecheck: Outcome
}

/** The package manager that runs scripts in a checkout whose lockfile is in `dir`. */
export const runnerOf = (dir: string) => {
  const lock = managerOf(dir)?.lock
  if (lock?.startsWith('bun')) return 'bun'
  if (lock === 'pnpm-lock.yaml') return 'pnpm'
  if (lock === 'yarn.lock') return 'yarn'
  return 'npm'
}

const script = (pm: string, name: string): Command => ({ label: `${pm} run ${name}`, cmd: [pm, 'run', name] })

/** How the repo lints: its `lint` script. Undefined when it has none. */
export function lintCommand(pm: string, scripts: Record<string, string>): Command | undefined {
  return scripts.lint ? script(pm, 'lint') : undefined
}

/** How the repo typechecks: a typecheck script, a `check` that runs tsc, else `tsc --noEmit` on its tsconfig.json. */
export function typecheckCommand(pm: string, dir: string, scripts: Record<string, string>, top: string): Command | string {
  const named = TYPECHECK_SCRIPTS.find(name => scripts[name])
  if (named) return script(pm, named)
  if (scripts.check && TS_CHECK.test(scripts.check)) return script(pm, 'check')
  if (!existsSync(join(dir, 'tsconfig.json'))) return 'there is no typecheck script and no tsconfig.json'
  // tsc may be hoisted to a parent workspace's node_modules
  for (let at = dir; ; at = dirname(at)) {
    const bin = join(at, 'node_modules', '.bin', 'tsc')
    if (existsSync(bin)) return { label: 'tsc --noEmit', cmd: [bin, '--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'] }
    if (at === top || at === dirname(at)) return 'there is no typecheck script, and tsc is not installed (add typescript to devDependencies)'
  }
}

/**
 * The first errors in a tool's output, as `file:line message`: tsc (`a.ts(3,5): error TS2322: …` or the pretty form),
 * ESLint's stylish format, Biome's diagnostics; else the lines that say error, else the last lines.
 */
export function firstErrors(output: string, root: string, max = SHOWN): string[] {
  const lines = plain(output).split('\n').map(line => line.replaceAll(`${root}/`, '').replace(/\s+$/, ''))
  const found: string[] = []
  let file: string | undefined
  for (const [i, line] of lines.entries()) {
    const tsc = line.match(/^(\S.*?)(?:\((\d+),\d+\)|:(\d+):\d+)\s*-?:?\s*error (TS\d+): (.*)$/)
    if (tsc) {
      found.push(`${tsc[1]}:${tsc[2] ?? tsc[3]} ${tsc[4]} ${tsc[5]}`)
      continue
    }
    if (/^[^\s].*\.\w+$/.test(line) && !line.includes(' ')) file = line
    const eslint = line.match(/^\s+(\d+):\d+\s+error\s+(.+?)(?:\s{2,}(\S+))?$/)
    if (eslint && file) {
      found.push(`${file}:${eslint[1]} ${eslint[2]}${eslint[3] ? ` (${eslint[3]})` : ''}`)
      continue
    }
    const biome = line.match(/^(\S+?):(\d+):\d+\s+(\S+)/)
    if (biome && /━/.test(line)) {
      const message = lines.slice(i + 1, i + 4).find(next => /^\s*[✖×!]/.test(next))?.replace(/^\s*[✖×!]\s*/, '')
      found.push(`${biome[1]}:${biome[2]} ${biome[3]}${message ? ` ${message}` : ''}`)
    }
  }
  if (found.length) return found.slice(0, max)
  const said = lines.filter(line => /\berror\b/i.test(line) && line.trim())
  return (said.length ? said : lines.filter(line => line.trim()).slice(-max)).slice(0, max).map(line => line.trim())
}

function judge(command: Command | string | undefined, ran: Ran | undefined, where: string, root: string, missing: string): Outcome {
  if (command === undefined) return { state: 'fail', evidence: missing }
  if (typeof command === 'string') return { state: 'fail', evidence: `${command}, ${where}` }
  if (!ran) return { state: 'error', evidence: `\`${command.label}\` didn't run, ${where}` }
  const took = `${Math.round(ran.ms / 1000)} s`
  if (ran.timedOut) return { state: 'error', evidence: `\`${command.label}\` didn't finish within ${TIMEOUT_MS / 60_000} minutes, ${where}` }
  if (ran.code === 0) return { state: 'pass', evidence: `\`${command.label}\` passed in ${took}, ${where}` }
  const errors = firstErrors(`${ran.stdout}\n${ran.stderr}`, root)
  return { state: 'fail', evidence: `\`${command.label}\` exited ${ran.code} after ${took}, ${where}: ${listed(errors, SHOWN)}` }
}

const NO_LINT = (at: string) => `package.json has no lint script ${at}: add one that runs the repo's linter (\`biome check\`, \`eslint .\`)`

/** The repo's own workspace packages that tsc could not find (TS2307), by name. */
export async function missingWorkspaceModules(output: string, root: string) {
  const wanted = new Set([...output.matchAll(/TS2307: Cannot find module '([^']+)'|Cannot find module '([^']+)' or its corresponding type/g)].map(m => m[1] ?? m[2]) as string[])
  if (wanted.size === 0) return []
  const listedFiles = await run(['git', 'ls-files', '--', 'package.json', '**/package.json'], root)
  const names = new Set<string>()
  for (const path of listedFiles.stdout.split('\n').filter(path => path && !path.includes('node_modules/'))) {
    try {
      const name = ((await Bun.file(join(root, path)).json()) as { name?: string }).name
      if (name) names.add(name)
    } catch {}
  }
  const packageOf = (spec: string) => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/')
  return [...new Set([...wanted].map(packageOf).filter(name => names.has(name)))]
}

async function fresh(dir: string): Promise<RepoRun> {
  const both = (outcome: Outcome) => ({ lint: outcome, typecheck: outcome })
  const top = await run(['git', 'rev-parse', '--show-toplevel', '--show-prefix', 'HEAD'], dir)
  if (!top.ok) return both({ state: 'error', evidence: `${dir} is not a git checkout` })
  const [root = dir, prefix = '', sha = ''] = top.stdout.split('\n')
  const at = `at ${sha.slice(0, 7)}`

  const inPlace = OWN_WORKTREE.test(`${dir}/`)
  const holder = join(root, '.worktrees')
  const holderExisted = existsSync(holder)
  const worktree = inPlace ? root : join(holder, `std-scan-${crypto.randomUUID().slice(0, 8)}`)
  const work = inPlace ? dir : join(worktree, prefix)
  try {
    if (!inPlace) {
      await mkdir(holder, { recursive: true })
      const added = await run(['git', 'worktree', 'add', '--detach', '--quiet', worktree, sha], root)
      if (!added.ok) return both({ state: 'error', evidence: `couldn't make a worktree of ${root}: ${added.stderr.split('\n').at(-1)}` })
    }
    const where = `${inPlace ? 'in the run’s worktree' : 'in a fresh worktree'} ${at}`
    const manifest = Bun.file(join(work, 'package.json'))
    if (!(await manifest.exists())) return both({ state: 'error', evidence: `${prefix || 'the repo root'} has no package.json ${at}` })
    const scripts = ((await manifest.json()) as { scripts?: Record<string, string> }).scripts ?? {}

    // The nearest lockfile up from the asset's folder: a workspace package installs from its monorepo's root.
    let installAt = work
    while (!managerOf(installAt) && installAt !== worktree && installAt !== dirname(installAt)) installAt = dirname(installAt)
    if (!managerOf(installAt)) return both({ state: 'error', evidence: `no lockfile ${at}, so dependencies can't be installed as the repo pins them` })
    if (!inPlace || !existsSync(join(installAt, 'node_modules'))) {
      const setup = await installDeps(installAt)
      if (setup && !setup.ok) return both({ state: 'error', evidence: `\`${setup.command}\` failed ${where}: ${firstErrors(setup.error ?? '', worktree, 3).join('; ')}` })
    }

    const pm = runnerOf(installAt)
    const lint = lintCommand(pm, scripts)
    const typecheck = typecheckCommand(pm, work, scripts, worktree)
    const go = (command: Command | string | undefined) =>
      command && typeof command !== 'string' ? exec(command.cmd, { cwd: work, timeoutMs: TIMEOUT_MS, env: { CI: '1', FORCE_COLOR: '0' } }) : undefined
    const [linted, firstTyped] = await Promise.all([go(lint), go(typecheck)])
    let typed = firstTyped
    let typedWhere = where
    // A monorepo whose packages are typed from their builds (`exports` → `dist/*.d.ts`) typechecks only after its
    // build, as its CI runs it: build once and typecheck again.
    if (typed && typed.code !== 0 && !typed.timedOut && scripts.build) {
      const missing = await missingWorkspaceModules(`${typed.stdout}\n${typed.stderr}`, worktree)
      if (missing.length) {
        const build = script(pm, 'build')
        const built = await exec(build.cmd, { cwd: work, timeoutMs: TIMEOUT_MS, env: { CI: '1', FORCE_COLOR: '0' } })
        if (built.code !== 0 || built.timedOut) {
          const why = built.timedOut ? `didn't finish within ${TIMEOUT_MS / 60_000} minutes` : `exited ${built.code}: ${listed(firstErrors(`${built.stdout}\n${built.stderr}`, worktree), SHOWN)}`
          return { lint: judge(lint, linted, where, worktree, NO_LINT(at)), typecheck: { state: 'fail', evidence: `the typecheck needs the build of ${listed(missing, 3, ', ')}, and \`${build.label}\` ${why}, ${where}` } }
        }
        typed = await go(typecheck)
        typedWhere = `${where}, after \`${build.label}\` (${listed(missing, 3, ', ')} are typed from their builds)`
      }
    }
    return { lint: judge(lint, linted, where, worktree, NO_LINT(at)), typecheck: judge(typecheck, typed, typedWhere, worktree, '') }
  } finally {
    if (!inPlace) {
      await run(['git', 'worktree', 'remove', '--force', worktree], root)
      await rm(worktree, { recursive: true, force: true })
      await run(['git', 'worktree', 'prune'], root)
      // leave the repo as it was: no empty .worktrees/ of ours
      if (!holderExisted && (await readdir(holder).catch(() => ['?'])).length === 0) await rmdir(holder).catch(() => {})
    }
  }
}

const runs = new Map<string, Promise<RepoRun>>()

/**
 * Lints and typechecks the asset's committed code once per process: lint-clean and typecheck-clean share one worktree
 * and one install. A run's own worktree (a PR being verified) is checked in place.
 */
export async function repoRun({ asset }: Context): Promise<RepoRun | Outcome> {
  if (!asset.path) return { state: 'error', evidence: `this check runs the repo's commands and needs a local checkout: give asset ${asset.id} a path` }
  const dir = expandHome(asset.path)
  const head = await run(['git', 'rev-parse', 'HEAD'], dir)
  const key = `${dir} ${head.stdout.trim()}`
  let pending = runs.get(key)
  if (!pending) {
    pending = fresh(dir)
    runs.set(key, pending)
  }
  return pending
}

export const isRepoRun = (value: RepoRun | Outcome): value is RepoRun => 'lint' in value
