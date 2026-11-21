import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const INSTALL_TIMEOUT_MS = 10 * 60_000

/** A package manager, known by its lockfile: the command that installs exactly what the lockfile says, and what a worker may run. */
const MANAGERS = [
  { lock: 'bun.lock', install: ['bun', 'install', '--frozen-lockfile'], tools: ['Bash(bun *)', 'Bash(bunx *)'] },
  { lock: 'bun.lockb', install: ['bun', 'install', '--frozen-lockfile'], tools: ['Bash(bun *)', 'Bash(bunx *)'] },
  { lock: 'pnpm-lock.yaml', install: ['pnpm', 'install', '--frozen-lockfile'], tools: ['Bash(pnpm *)'] },
  { lock: 'yarn.lock', install: ['yarn', 'install', '--frozen-lockfile'], tools: ['Bash(yarn *)'] },
  { lock: 'package-lock.json', install: ['npm', 'ci'], tools: ['Bash(npm *)', 'Bash(npx *)'] },
]

export type Manager = (typeof MANAGERS)[number]

/** How a fresh worktree got its dependencies, for the run record and the worker's prompt. */
export interface Setup {
  command: string
  ok: boolean
  /** The end of the output when it failed. */
  error?: string
}

const versions = new Map<string, string | undefined>()

/**
 * The version of `name` the checkout at `dir` uses: the installed one in `node_modules`, else the first full version in
 * package.json's range (`^16.3.0` → 16.3.0). Undefined when it isn't a dependency. Cached per process.
 */
export function dependencyVersion(dir: string, name: string) {
  const key = `${dir} ${name}`
  if (versions.has(key)) return versions.get(key)
  let version: string | undefined
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>
    const declared = ['dependencies', 'devDependencies', 'peerDependencies'].map(field => manifest[field]?.[name]).find(Boolean)
    if (declared) {
      try {
        version = (JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8')) as { version?: string }).version
      } catch {}
      version ??= declared.match(/\d+\.\d+\.\d+/)?.[0] ?? declared.match(/\d+(\.\d+)?/)?.[0]?.replace(/^(\d+)$/, '$1.0').concat('.0')
    }
  } catch {}
  versions.set(key, version)
  return version
}

export const managerOf = (dir: string) => MANAGERS.find(manager => existsSync(join(dir, manager.lock)))

/** Installs the dependencies of a fresh worktree, so the worker can run the repo's typecheck, lint and tests. Undefined without a lockfile. */
export async function installDeps(dir: string, signal?: AbortSignal): Promise<Setup | undefined> {
  const manager = managerOf(dir)
  if (!manager) return undefined
  const command = manager.install.join(' ')
  try {
    const proc = Bun.spawn(manager.install, {
      cwd: dir,
      // CI keeps installers from prompting, and skips git hooks setup such as husky's
      env: { ...process.env, CI: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: INSTALL_TIMEOUT_MS,
      signal,
    })
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
    if (code === 0) return { command, ok: true }
    return { command, ok: false, error: `${stdout}\n${stderr}`.trim().slice(-500) || `exited ${code}` }
  } catch (error) {
    return { command, ok: false, error: (error as Error).message }
  }
}
