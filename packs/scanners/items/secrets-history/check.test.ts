import { afterAll, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contextOf } from '../../../ai-ready/fixture.ts'
import secretsHistory, { describe, scanArgs } from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))

const git = (dir: string, ...args: string[]) =>
  Bun.spawnSync(['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir }).stdout.toString().trim()

/** A repo whose history is these commits, each a set of files written (null removes one). */
async function repo(commits: Record<string, string | null>[]) {
  const dir = await mkdtemp(join(tmpdir(), 'standards-gitleaks-test-'))
  dirs.push(dir)
  git(dir, 'init', '-q')
  for (const [i, files] of commits.entries()) {
    for (const [path, text] of Object.entries(files)) {
      if (text === null) await rm(join(dir, path))
      else await Bun.write(join(dir, path), text)
    }
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', `commit ${i}`)
  }
  return dir
}

// A token of GitHub's shape, made up at run time so no test file holds one.
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const token = () => `ghp_${Array.from(crypto.getRandomValues(new Uint8Array(36)), byte => ALNUM[byte % ALNUM.length]).join('')}`
const hasGitleaks = !!Bun.which('gitleaks')

test('the subcommand follows the installed version', () => {
  expect(scanArgs('8.30.1', '/r')).toEqual(['git', '/r'])
  expect(scanArgs('v8.18.4', '/r')).toEqual(['detect', '--source', '/r'])
  expect(describe({ RuleID: 'github-pat', File: 'app/config.ts', StartLine: 3, Commit: '0123456789abcdef' }, 'app/')).toBe('github-pat in config.ts:3 (commit 0123456)')
})

test.skipIf(!hasGitleaks)('a secret removed from the tree is still found in history, by rule, file, line and commit, never by value', async () => {
  const secret = token()
  const dir = await repo([{ 'README.md': '# app\n' }, { 'src/config.ts': `export const token = '${secret}'\n` }, { 'src/config.ts': null }])
  const leaked = git(dir, 'rev-list', '--all').split('\n')[1]!.slice(0, 7)
  const outcome = await secretsHistory(contextOf({ path: dir }))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain(`found 1 secrets in 3 commits of ${await Bun.$`git -C ${dir} rev-parse --show-toplevel`.text().then(t => t.trim())}: github-pat in src/config.ts:1 (commit ${leaked})`)
  expect(outcome.evidence).not.toContain(secret)
  expect(outcome.evidence).not.toContain(secret.slice(4, 14))
})

test.skipIf(!hasGitleaks)('a clean history passes; a finding listed in .gitleaksignore passes', async () => {
  expect((await secretsHistory(contextOf({ path: await repo([{ 'a.ts': 'export const a = 1\n' }]) }))).state).toBe('pass')
  const secret = token()
  const dir = await repo([{ 'k.ts': `const k = '${secret}'\n` }])
  const commit = git(dir, 'rev-parse', 'HEAD')
  await Bun.write(join(dir, '.gitleaksignore'), `# rotated on 2026-11-21\n${commit}:k.ts:github-pat:1\n`)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'ignore the rotated token')
  expect(await secretsHistory(contextOf({ path: dir }))).toMatchObject({ state: 'pass' })
})

test.skipIf(!hasGitleaks)('a commit hash that the sourcegraph rule matches is not counted as a secret', async () => {
  const sha = Array.from(crypto.getRandomValues(new Uint8Array(20)), byte => byte.toString(16).padStart(2, '0')).join('')
  const dir = await repo([{ 'src/a.ts': `// the filter follows sourcegraph's popover.tsx @ ${sha} (MIT)\nexport const a = 1\n` }])
  const outcome = await secretsHistory(contextOf({ path: dir }))
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toEndWith('1 matches of sourcegraph-access-token on a bare 40-hex value (a commit hash, not a token) not counted')
})

test('no checkout is an error', async () => {
  expect((await secretsHistory(contextOf({}))).state).toBe('error')
  expect((await secretsHistory(contextOf({ path: tmpdir() }))).state).toBe('error')
})
