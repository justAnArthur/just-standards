import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, realpathSync } from 'node:fs'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RunRecord } from './schema.ts'

const CLI = join(import.meta.dir, '../cli/standards.ts')
const PR = 'https://github.com/acme/widgets/pull/7'

// `pr merge` flips the state `pr view` reports.
const FAKE_GH = `#!/bin/sh
echo "$*" >> "$FAKE_GH_DIR/log"
case "$1 $2" in
"pr view")
  case "$*" in
  *statusCheckRollup*) cat "$FAKE_GH_DIR/view.json" ;;
  *) echo "{\\"state\\":\\"$(cat "$FAKE_GH_DIR/state" 2>/dev/null || echo OPEN)\\"}" ;;
  esac ;;
"pr merge") echo MERGED > "$FAKE_GH_DIR/state" ;;
"auth status")
  [ -n "$FAKE_GH_AUTH" ] || { echo '{"hosts":{}}'; exit 1; }
  echo "$FAKE_GH_AUTH" ;;
*) exit 1 ;;
esac
`

const VIEW = {
  number: 7,
  url: PR,
  title: 'docs: a README written from the code',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  reviewDecision: 'APPROVED',
  statusCheckRollup: [
    { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', workflowName: 'ci' },
    { __typename: 'CheckRun', name: 'lint', status: 'IN_PROGRESS', conclusion: '' },
    { __typename: 'StatusContext', context: 'vercel', state: 'FAILURE', targetUrl: 'https://vercel.com' },
    { __typename: 'StatusContext', context: 'netlify', state: 'PENDING' },
  ],
  additions: 40,
  deletions: 2,
  changedFiles: 1,
  files: [{ path: 'README.md', additions: 40, deletions: 2 }],
  body: 'What changed.',
}

let dir = ''
let ws = ''
let checkout = ''
let env: Record<string, string | undefined> = {}

async function git(cwd: string, ...args: string[]) {
  const proc = Bun.spawn(['git', '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  if (code !== 0) throw new Error(`git ${args.join(' ')}: ${await new Response(proc.stderr).text()}`)
  return stdout.trim()
}

async function standards(args: string[], extra: Record<string, string> = {}) {
  const proc = Bun.spawn(['bun', CLI, ...args], { env: { ...env, ...extra }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  return { code, stderr, json: () => JSON.parse(stdout) }
}

const record = (id: string, extra: Partial<RunRecord>): RunRecord => ({
  id,
  business: 'acme',
  asset: 'widgets',
  items: ['repo/readme'],
  worker: 'fake',
  model: 'haiku',
  branch: 'standards/readme',
  worktree: join(checkout, '.worktrees/std-readme'),
  started_at: '2026-11-19T12:00:00.000Z',
  finished_at: '2026-11-19T12:05:00.000Z',
  ms: 300000,
  state: 'done',
  ...extra,
})

beforeAll(async () => {
  dir = realpathSync(await mkdtemp(join(tmpdir(), 'standards-github-')))
  ws = join(dir, 'ws')
  checkout = join(dir, 'widgets')
  const gh = join(dir, 'gh')
  await Bun.write(gh, FAKE_GH)
  await chmod(gh, 0o755)
  await Bun.write(join(dir, 'view.json'), JSON.stringify(VIEW))
  env = { ...process.env, STANDARDS_WORKSPACE: ws, STANDARDS_GH_BIN: gh, FAKE_GH_DIR: dir }

  await git(dir, 'init', '-q', '-b', 'main', 'widgets')
  await Bun.write(join(checkout, 'README.md'), '# widgets\n')
  await git(checkout, 'add', '.')
  await git(checkout, 'commit', '-q', '-m', 'first')
  await git(checkout, 'worktree', 'add', '-q', '-b', 'standards/readme', join(checkout, '.worktrees/std-readme'))

  await Bun.write(join(ws, 'workers.yml'), '- { id: fake, runtime: claude-code, model: haiku }\n')
  await Bun.write(join(ws, '.state/runs/run-pr/run.json'), JSON.stringify(record('run-pr', { pr: { url: PR, number: 7, state: 'open' } })))
  await Bun.write(join(ws, '.state/runs/run-nopr/run.json'), JSON.stringify(record('run-nopr', { state: 'failed', error: 'no pull request' })))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('standards pr', () => {
  test('view prints the PR from gh pr view, with the rollup as checks', async () => {
    const { code, json } = await standards(['pr', 'view', 'run-pr'])
    expect(code).toBe(0)
    const { statusCheckRollup: _, ...rest } = VIEW
    expect(json()).toEqual({
      ...rest,
      checks: [
        { name: 'test', state: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'lint', state: 'IN_PROGRESS', conclusion: '' },
        { name: 'vercel', state: 'COMPLETED', conclusion: 'FAILURE' },
        { name: 'netlify', state: 'PENDING', conclusion: '' },
      ],
    })
    expect(await Bun.file(join(dir, 'log')).text()).toContain(`pr view ${PR} --json number,url,title,state,isDraft,mergeable`)
  })

  test('view and merge refuse a run without a PR, or no run at all', async () => {
    expect((await standards(['pr', 'view', 'run-nopr'])).stderr).toContain('run run-nopr has no pull request')
    expect((await standards(['pr', 'merge', 'nope'])).stderr).toContain('no run nope')
    expect((await standards(['pr', 'merge', 'run-pr', '--method', 'octopus'])).stderr).toContain('--method is one of merge, squash, rebase')
  })

  test('merge merges, then removes the worktree and branch and prints the updated record', async () => {
    const { code, json } = await standards(['pr', 'merge', 'run-pr', '--method', 'squash'])
    expect(code).toBe(0)
    expect(await Bun.file(join(dir, 'log')).text()).toContain(`pr merge ${PR} --squash`)
    const merged = json() as RunRecord
    expect(merged).toEqual(record('run-pr', { pr: { url: PR, number: 7, state: 'merged' } }))
    expect(await Bun.file(join(ws, '.state/runs/run-pr/run.json')).json()).toEqual(merged)
    expect(existsSync(merged.worktree)).toBe(false)
    expect(await git(checkout, 'branch', '--list', 'standards/readme')).toBe('')
  })
})

describe('standards github status', () => {
  test("reads gh's active github.com account", async () => {
    const auth = JSON.stringify({
      hosts: {
        'github.com': [
          { state: 'success', active: false, host: 'github.com', login: 'old', gitProtocol: 'ssh' },
          { state: 'success', active: true, host: 'github.com', login: 'octocat', gitProtocol: 'https' },
        ],
      },
    })
    expect((await standards(['github', 'status'], { FAKE_GH_AUTH: auth })).json()).toEqual({ loggedIn: true, user: 'octocat', protocol: 'https' })
    expect((await standards(['github', 'status'])).json()).toEqual({ loggedIn: false })
  })
})
