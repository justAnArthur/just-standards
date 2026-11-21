import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import { run } from '../../../../core/checks/github.ts'
import { expandHome } from '../../../../core/load.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { exec, listed } from '../../shared.ts'

const TIMEOUT_MS = 10 * 60_000
const SHOWN = 8

/** One finding of gitleaks' JSON report. `Secret` and `Match` are never read: they hold the value (redacted with `--redact`). */
export interface Leak {
  RuleID: string
  File: string
  StartLine: number
  Commit?: string
}

/**
 * Rules whose bare form is indistinguishable from a git commit hash: gitleaks' `sourcegraph-access-token` also matches
 * any 40-hex string (Sourcegraph's legacy token format), so a SHA cited in a comment (`popover.tsx @ <sha>`) is a
 * finding. Only the `sgp_` form is a token Sourcegraph still issues; a line without it is counted as a hash.
 */
const HASH_LIKE: Record<string, RegExp> = { 'sourcegraph-access-token': /sgp_/ }

/** Whether a finding is only a commit hash, read from the commit itself (never printed). */
async function hashOnly(leak: Leak, root: string) {
  const real = HASH_LIKE[leak.RuleID]
  if (!real || !leak.Commit) return false
  const shown = await run(['git', 'show', `${leak.Commit}:${leak.File}`], root)
  const line = shown.ok ? shown.stdout.split('\n')[leak.StartLine - 1] : undefined
  return line !== undefined && !real.test(line)
}

/** `aws-access-token in config/prod.env:3 (commit 1a2b3c4)`: where it is, never what it is. */
export const describe = (leak: Leak, prefix = '') =>
  `${leak.RuleID} in ${leak.File.slice(prefix.length)}:${leak.StartLine}${leak.Commit ? ` (commit ${leak.Commit.slice(0, 7)})` : ''}`

/** The subcommand that scans history: `git` from gitleaks 8.19, `detect` before it. */
export function scanArgs(version: string, root: string) {
  const [major = 0, minor = 0] = version.replace(/^v/, '').split('.').map(Number)
  return major > 8 || (major === 8 && minor >= 19) ? ['git', root] : ['detect', '--source', root]
}

/** No secret in any commit of the repo's history, by gitleaks. */
export default async function secretsHistory({ asset }: Context): Promise<Outcome> {
  if (!asset.path) return { state: 'error', evidence: `gitleaks reads the history of a local checkout: give asset ${asset.id} a path` }
  const gitleaks = Bun.which('gitleaks')
  if (!gitleaks) return { state: 'error', evidence: 'gitleaks is not installed (brew install gitleaks, or https://github.com/gitleaks/gitleaks#installing); nothing was scanned' }
  const dir = expandHome(asset.path)
  const top = await run(['git', 'rev-parse', '--show-toplevel', '--show-prefix'], dir)
  if (!top.ok) return { state: 'error', evidence: `${dir} is not a git checkout` }
  const [root = dir, prefix = ''] = top.stdout.split('\n')

  const version = (await run([gitleaks, 'version'])).stdout.trim()
  const out = await mkdtemp(join(tmpdir(), 'standards-gitleaks-'))
  try {
    const report = join(out, 'report.json')
    const ran = await exec(
      [gitleaks, ...scanArgs(version, root), '--no-banner', '--redact', '--log-level', 'error', '--exit-code', '0', '--report-format', 'json', '--report-path', report],
      // gitleaks reads .gitleaksignore from its working directory
      { cwd: root, timeoutMs: TIMEOUT_MS },
    )
    if (ran.timedOut) return { state: 'error', evidence: `gitleaks didn't finish within ${TIMEOUT_MS / 60_000} minutes; nothing was concluded` }
    const file = Bun.file(report)
    if (ran.code !== 0 || !(await file.exists())) {
      // the last line of its log, never the report
      const why = (ran.stderr || ran.stdout).trim().split('\n').at(-1)?.slice(0, 200) || `exited ${ran.code}`
      return { state: 'error', evidence: `gitleaks ${version} failed on ${root}: ${why}` }
    }
    // A repo serving several assets is scanned whole; an asset in a subfolder answers for its own files.
    const found = ((await file.json()) as Leak[]).filter(leak => leak.File.startsWith(prefix))
    const hashes = await Promise.all(found.map(leak => hashOnly(leak, root)))
    const leaks = found.filter((_, i) => !hashes[i])
    const dismissed = found.length - leaks.length
    const aside = dismissed ? `; ${dismissed} matches of ${[...new Set(found.filter((_, i) => hashes[i]).map(leak => leak.RuleID))].join(', ')} on a bare 40-hex value (a commit hash, not a token) not counted` : ''
    const commits = await run(['git', 'rev-list', '--count', '--all'], root)
    const where = `${prefix ? `${prefix} in ` : ''}${commits.ok ? `${commits.stdout.trim()} commits` : 'the history'} of ${root}`
    if (leaks.length === 0) return { state: 'pass', evidence: `gitleaks ${version} found no secrets in ${where}${aside}` }
    const unique = [...new Set(leaks.map(leak => describe(leak, prefix)))]
    return { state: 'fail', evidence: `gitleaks ${version} found ${leaks.length} secrets in ${where}: ${listed(unique, SHOWN)}${aside}` }
  } finally {
    await rm(out, { recursive: true, force: true })
  }
}
