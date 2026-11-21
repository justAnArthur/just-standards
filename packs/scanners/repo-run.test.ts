import { afterAll, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contextOf } from '../ai-ready/fixture.ts'
import { firstErrors, missingWorkspaceModules, typecheckCommand } from './repo-run.ts'
import lintClean from './items/lint-clean/check.ts'
import typecheckClean from './items/typecheck-clean/check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const git = (dir: string, ...args: string[]) =>
  Bun.spawnSync(['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir }).stdout.toString().trim()

const TSC = Bun.resolveSync('typescript/bin/tsc', import.meta.dir)
// A linter that reports every `var` in ESLint's stylish format and exits 1, as eslint does.
const LINTER = `import { readFileSync } from 'node:fs'
const file = 'src/index.ts'
const lines = readFileSync(file, 'utf8').split('\\n')
const errors = lines.flatMap((line, i) => line.includes('var ') ? [\`  \${i + 1}:1  error  Unexpected var, use let or const instead  no-var\`] : [])
if (errors.length) { console.log(\`\\n\${process.cwd()}/\${file}\\n\${errors.join('\\n')}\\n\\n✖ \${errors.length} problems\`); process.exit(1) }
`

/** A tiny TypeScript project, committed: npm with an empty lockfile (installs offline), a lint and a typecheck script. */
async function project(source: string, scripts: Record<string, string> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'standards-tsproject-'))
  dirs.push(dir)
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'tiny', private: true, scripts: { lint: 'node lint.mjs', typecheck: `node ${TSC} --noEmit`, ...scripts } }),
    'package-lock.json': JSON.stringify({ name: 'tiny', lockfileVersion: 3, requires: true, packages: { '': { name: 'tiny' } } }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', types: [] }, include: ['src'] }),
    'lint.mjs': LINTER,
    'src/index.ts': source,
  }
  for (const [path, text] of Object.entries(files)) await Bun.write(join(dir, path), text)
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'tiny')
  return dir
}

const worktrees = (dir: string) => git(dir, 'worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')).length

test('a type error and a lint error fail with file:line; the temporary worktree is gone afterwards', async () => {
  const dir = await project("export const n: number = 'one'\nvar x = 1\nexport { x }\n")
  const sha = git(dir, 'rev-parse', '--short=7', 'HEAD')
  const [typed, linted] = await Promise.all([typecheckClean(contextOf({ path: dir })), lintClean(contextOf({ path: dir }))])
  expect(typed.state).toBe('fail')
  expect(typed.evidence).toMatch(new RegExp(`^\`npm run typecheck\` exited 2 after \\d+ s, in a fresh worktree at ${sha}: src/index.ts:1 TS2322 Type 'string' is not assignable to type 'number'.$`))
  expect(linted.state).toBe('fail')
  expect(linted.evidence).toMatch(/`npm run lint` exited 1 after \d+ s, in a fresh worktree at \w{7}: src\/index.ts:2 Unexpected var, use let or const instead \(no-var\)$/)
  expect(worktrees(dir)).toBe(1)
  expect(existsSync(join(dir, '.worktrees'))).toBe(false)
})

test('clean code passes both; only committed code is checked', async () => {
  const dir = await project('export const n: number = 1\n')
  await Bun.write(join(dir, 'src/index.ts'), "export const n: number = 'uncommitted'\n")
  expect(await typecheckClean(contextOf({ path: dir }))).toMatchObject({ state: 'pass' })
  expect((await lintClean(contextOf({ path: dir }))).evidence).toMatch(/^`npm run lint` passed in \d+ s, in a fresh worktree at \w{7}$/)
})

test("a run's own worktree is checked in place, without another worktree", async () => {
  const dir = await project("export const n: number = 'one'\n")
  await mkdir(join(dir, '.worktrees'))
  const run = join(dir, '.worktrees', 'std-code-typecheck-clean')
  git(dir, 'worktree', 'add', '-q', '--detach', run, 'HEAD')
  await Bun.write(join(run, 'src/index.ts'), 'export const n: number = 2\n')
  git(run, 'commit', '-q', '-am', 'fix the type')
  const outcome = await typecheckClean(contextOf({ path: run }))
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toContain("in the run’s worktree")
  expect(worktrees(dir)).toBe(2)
})

test('no lint script fails; no package.json or checkout is an error', async () => {
  const dir = await project('export const n = 1\n', { lint: '' })
  expect((await lintClean(contextOf({ path: dir }))).evidence).toStartWith("package.json has no lint script at")
  expect((await lintClean(contextOf({}))).state).toBe('error')
})

test('how the typecheck is found: a script, a check that runs tsc, else tsc on tsconfig.json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'standards-tscmd-'))
  dirs.push(dir)
  expect(typecheckCommand('bun', dir, { typecheck: 'tsc --noEmit' }, dir)).toEqual({ label: 'bun run typecheck', cmd: ['bun', 'run', 'typecheck'] })
  expect(typecheckCommand('bun', dir, { check: "bun --filter '*' check" }, dir)).toMatchObject({ label: 'bun run check' })
  expect(typecheckCommand('bun', dir, { check: 'biome check' }, dir)).toBe('there is no typecheck script and no tsconfig.json')
  await Bun.write(join(dir, 'tsconfig.json'), '{}')
  expect(typecheckCommand('pnpm', dir, {}, dir)).toStartWith('there is no typecheck script, and tsc is not installed')
  await Bun.write(join(dir, 'node_modules/.bin/tsc'), '')
  expect(typecheckCommand('pnpm', dir, {}, dir)).toMatchObject({ label: 'tsc --noEmit' })
})

test("a monorepo whose packages are typed from their builds: the workspace packages tsc couldn't find", async () => {
  const dir = await mkdtemp(join(tmpdir(), 'standards-mono-'))
  dirs.push(dir)
  await Bun.write(join(dir, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['lib', 'ui'] }))
  await Bun.write(join(dir, 'lib/package.json'), JSON.stringify({ name: '@acme/lib' }))
  await Bun.write(join(dir, 'ui/package.json'), JSON.stringify({ name: 'acme-ui' }))
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  const output = [
    "ui check: a.ts(1,20): error TS2307: Cannot find module '@acme/lib/config' or its corresponding type declarations.",
    "ui check: b.ts(2,20): error TS2307: Cannot find module 'acme-ui' or its corresponding type declarations.",
    "ui check: c.ts(3,20): error TS2307: Cannot find module 'left-pad' or its corresponding type declarations.",
  ].join('\n')
  expect(await missingWorkspaceModules(output, dir)).toEqual(['@acme/lib', 'acme-ui'])
  expect(await missingWorkspaceModules("x.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.", dir)).toEqual([])
})

test('the first errors of tsc, ESLint and Biome', () => {
  expect(firstErrors("/w/src/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.\n", '/w')).toEqual(["src/a.ts:3 TS2322 Type 'string' is not assignable to type 'number'."])
  expect(firstErrors('src/a.ts:3:5 - error TS2304: Cannot find name \'x\'.\n', '/w')).toEqual(["src/a.ts:3 TS2304 Cannot find name 'x'."])
  expect(firstErrors('\n/w/app/page.tsx\n  12:5  error  \'x\' is assigned a value but never used  @typescript-eslint/no-unused-vars\n  13:1  warning  Unexpected console  no-console\n', '/w')).toEqual([
    "app/page.tsx:12 'x' is assigned a value but never used (@typescript-eslint/no-unused-vars)",
  ])
  expect(firstErrors('src/a.ts:3:7 lint/correctness/noUnusedVariables  FIXABLE  ━━━━━━━━━━\n\n  ✖ This variable is unused.\n', '/w')).toEqual([
    'src/a.ts:3 lint/correctness/noUnusedVariables This variable is unused.',
  ])
  expect(firstErrors('\x1b[31mSomething broke\x1b[0m\nfor good\n', '/w')).toEqual(['Something broke', 'for good'])
})
