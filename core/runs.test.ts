import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, realpathSync } from 'node:fs'
import { chmod, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lines } from './runs.ts'
import type { RunRecord } from './schema.ts'

const CLI = join(import.meta.dir, '../cli/standards.ts')
const FAKE_CLAUDE = join(import.meta.dir, 'fixtures/fake-claude.ts')
const PR7 = 'https://github.com/acme/widgets/pull/7'
const PR8 = 'https://github.com/acme/widgets/pull/8'

const FAKE_GH = `#!/bin/sh
if [ "$1 $2" = "pr list" ]; then echo "\${FAKE_GH_LIST:-[]}"; exit 0; fi
if [ "$1 $2" = "pr view" ]; then
  state=OPEN
  [ "$3" = "$FAKE_GH_MERGED" ] && state=MERGED
  [ "$3" = "$FAKE_GH_CLOSED" ] && state=CLOSED
  echo "{\\"state\\":\\"$state\\"}"; exit 0
fi
exit 1
`

type Line = { type: 'run'; event: string; run: RunRecord } | { type: 'claude'; line: string }

let dir = ''
let ws = ''
let checkout = ''
let env: Record<string, string | undefined> = {}
const made: RunRecord[] = []

async function git(cwd: string, ...args: string[]) {
  const proc = Bun.spawn(['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  if (code !== 0) throw new Error(`git ${args.join(' ')}: ${stderr}`)
  return stdout.trim()
}

function standards(args: string[], extra: Record<string, string> = {}) {
  const proc = Bun.spawn(['bun', CLI, ...args], { env: { ...env, ...extra }, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  const out = lines(proc.stdout)[Symbol.asyncIterator]()
  const seen: Line[] = []
  const next = async () => {
    const { value, done } = await out.next()
    if (done) return undefined
    seen.push(JSON.parse(value))
    return seen.at(-1)
  }
  const finish = async () => {
    while (await next());
    return { seen, code: await proc.exited, stderr: await new Response(proc.stderr).text() }
  }
  return { proc, next, finish }
}

const claudeLines = (seen: Line[]) => seen.flatMap(l => (l.type === 'claude' ? [JSON.parse(l.line)] : []))
const finished = (seen: Line[]) => {
  const last = seen.at(-1)
  if (last?.type !== 'run' || last.event !== 'finished') throw new Error(`no finished line: ${JSON.stringify(last)}`)
  made.push(last.run)
  return last.run
}

beforeAll(async () => {
  dir = realpathSync(await mkdtemp(join(tmpdir(), 'standards-runs-')))
  ws = join(dir, 'ws')
  checkout = join(dir, 'widgets')
  const gh = join(dir, 'gh')
  await Bun.write(gh, FAKE_GH)
  await chmod(gh, 0o755)
  env = {
    ...process.env,
    STANDARDS_WORKSPACE: ws,
    STANDARDS_CLAUDE_BIN: FAKE_CLAUDE,
    STANDARDS_GH_BIN: gh,
    CLAUDECODE: '1',
    ANTHROPIC_BASE_URL: 'http://localhost:9',
    GIT_AUTHOR_NAME: 'test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  }

  await git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git')
  await git(dir, 'init', '-q', '-b', 'main', 'widgets')
  await Bun.write(join(checkout, 'README.md'), '# widgets\n')
  await git(checkout, 'add', '.')
  await git(checkout, 'commit', '-q', '-m', 'first')
  await git(checkout, 'remote', 'add', 'origin', join(dir, 'origin.git'))
  await git(checkout, 'push', '-q', 'origin', 'main')
  await Bun.write(join(checkout, 'later.txt'), 'only on origin\n')
  await git(checkout, 'add', '.')
  await git(checkout, 'commit', '-q', '-m', 'second')
  await git(checkout, 'push', '-q', 'origin', 'main')
  await git(checkout, 'reset', '-q', '--hard', 'HEAD~1')

  await Bun.write(
    join(ws, 'businesses/acme.yml'),
    `id: acme
name: Acme
assets:
  - { id: widgets, kind: repo, repo: acme/widgets, path: ${checkout} }
  - { id: elsewhere, kind: repo, repo: acme/elsewhere }
packs: [repo]
`,
  )
  await Bun.write(
    join(ws, 'workers.yml'),
    `- { id: fake, runtime: claude-code, model: haiku, allow: ["Bash(git *)", "Bash(gh pr *)"] }
- { id: other, runtime: claude-code, profile: ${join(dir, 'profile')}, model: sonnet, effort: low }
`,
  )
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('standards fix', () => {
  test('refuses an asset without a checkout, an item that does not apply, or an unknown worker', async () => {
    const cases: [string[], string][] = [
      [['acme', 'elsewhere', 'repo/readme', '--worker', 'fake'], 'no local checkout'],
      [['acme', 'widgets', 'website/llms-txt', '--worker', 'fake'], 'website/llms-txt does not apply to acme/widgets'],
      [['acme', 'widgets', 'repo/readme', '--worker', 'nobody'], 'no worker nobody'],
    ]
    for (const [args, message] of cases) {
      const { seen, code, stderr } = await standards(['fix', ...args]).finish()
      expect(code).toBe(1)
      expect(seen).toEqual([])
      expect(stderr).toContain(message)
    }
    expect(existsSync(join(ws, '.state/runs'))).toBe(false)
    expect(existsSync(join(checkout, '.worktrees'))).toBe(false)
  })

  test('works in a fresh worktree from origin, records everything, and ends done with the PR from the result', async () => {
    const { seen, code } = await standards(['fix', 'acme', 'widgets', 'repo/readme', 'repo/license', '--worker', 'fake']).finish()
    expect(code).toBe(0)

    const worktree = join(checkout, '.worktrees/std-readme')
    const first = seen[0]!
    expect(first.type === 'run' && first.event).toBe('started')
    expect(first.type === 'run' && first.run).toMatchObject({
      business: 'acme',
      asset: 'widgets',
      items: ['repo/readme', 'repo/license'],
      worker: 'fake',
      model: 'haiku',
      branch: 'standards/readme',
      worktree,
      state: 'running',
    })
    expect(first.type === 'run' && first.run.id).toMatch(/^\d{8}-\d{6}-acme-readme$/)

    const run = finished(seen)
    expect(run).toMatchObject({ state: 'done', pr: { url: PR7, number: 7, state: 'open' }, cost_usd: 0.0123, session_id: 'fake-session' })
    expect(run.ms).toBeNumber()
    expect(run.error).toBeUndefined()

    const [init, text] = claudeLines(seen)
    expect(init).toMatchObject({ subtype: 'init', cwd: worktree, model: 'haiku', config_dir: null, leaked: [] })
    expect(init.argv).toEqual(
      expect.arrayContaining(['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits']),
    )
    expect(init.argv.slice(-5, -2)).toEqual(['--allowedTools', 'Bash(git *)', 'Bash(gh pr *)'])
    expect(init.argv.slice(-2)).toEqual(['--add-dir', join(import.meta.dir, '../packs/repo')])
    expect(init.argv).not.toContain('--permission-prompt-tool')
    expect(init.argv).not.toContain('--effort')
    expect(text.message.content[0].text).toContain('Bring Acme / widgets up to standard')

    expect(await git(worktree, 'branch', '--show-current')).toBe('standards/readme')
    expect(await git(worktree, 'rev-parse', 'HEAD')).toBe(await git(checkout, 'rev-parse', 'origin/main'))
    expect(existsSync(join(worktree, 'later.txt'))).toBe(true)

    const saved = await Bun.file(join(ws, '.state/runs', run.id, 'run.json')).json()
    expect(saved).toEqual(run)
    const events = (await Bun.file(join(ws, '.state/runs', run.id, 'events.ndjson')).text()).trimEnd().split('\n')
    expect(events).toEqual(seen.flatMap(l => (l.type === 'claude' ? [l.line] : [])))
    expect(events).toHaveLength(5)
  })

  test('a taken branch gets -2, and the PR comes from gh pr list when the result has none', async () => {
    const list = JSON.stringify([{ url: PR8, number: 8 }])
    const { seen, code } = await standards(['fix', 'acme', 'widgets', 'repo/readme', '--worker', 'fake'], { FAKE_CLAUDE: 'no-pr', FAKE_GH_LIST: list }).finish()
    expect(code).toBe(0)
    const run = finished(seen)
    expect(run).toMatchObject({ branch: 'standards/readme-2', worktree: join(checkout, '.worktrees/std-readme-2'), state: 'done' })
    expect(run.pr).toEqual({ url: PR8, number: 8, state: 'open' })
  })

  test('a session without a pull request fails', async () => {
    const { seen, code } = await standards(['fix', 'acme', 'widgets', 'repo/readme', '--worker', 'fake'], { FAKE_CLAUDE: 'no-pr' }).finish()
    expect(code).toBe(1)
    expect(finished(seen)).toMatchObject({ branch: 'standards/readme-3', state: 'failed', error: 'no pull request' })
  })

  test('--interactive passes permission questions out and the answers on stdin back in', async () => {
    const run = standards(['fix', 'acme', 'widgets', 'repo/license', '--worker', 'other', '--interactive'])
    for (let l = await run.next(); l; l = await run.next()) {
      if (l.type !== 'claude' || JSON.parse(l.line).type !== 'control_request') continue
      const { request_id } = JSON.parse(l.line)
      run.proc.stdin.write(`${JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id, response: { behavior: 'allow', updatedInput: {} } } })}\n`)
      run.proc.stdin.flush()
      break
    }
    const { seen, code } = await run.finish()
    expect(code).toBe(0)
    const record = finished(seen)
    expect(record).toMatchObject({ branch: 'standards/license', model: 'sonnet', state: 'done' })

    const messages = claudeLines(seen)
    expect(messages[0].argv).toEqual(expect.arrayContaining(['--effort', 'low', '--permission-prompt-tool', 'stdio']))
    expect(messages[0].config_dir).toBe(join(dir, 'profile'))
    expect(messages.find(m => m.type === 'user')?.message.content[0].content).toBe(PR7)
  })

  test('SIGTERM kills the whole process tree and records stopped', async () => {
    const run = standards(['fix', 'acme', 'widgets', 'repo/topics', '--worker', 'fake'], { FAKE_CLAUDE: 'hang' })
    let child = 0
    for (let l = await run.next(); l; l = await run.next()) {
      if (l.type !== 'claude' || JSON.parse(l.line).subtype !== 'fake_child') continue
      child = JSON.parse(l.line).pid
      break
    }
    expect(child).toBeGreaterThan(0)
    run.proc.kill('SIGTERM')
    const { seen, code } = await run.finish()
    expect(code).toBe(1)
    const record = finished(seen)
    expect(record).toMatchObject({ state: 'stopped', error: 'stopped by SIGTERM' })
    expect((await Bun.file(join(ws, '.state/runs', record.id, 'run.json')).json()).state).toBe('stopped')

    const alive = () => {
      try {
        return process.kill(child, 0)
      } catch {
        return false
      }
    }
    for (let i = 0; i < 50 && alive(); i++) await Bun.sleep(20)
    expect(alive()).toBe(false)
  })
})

describe('standards runs', () => {
  test('lists the records newest first, by business', async () => {
    const { seen } = await standards(['runs']).finish()
    const records = seen as unknown as RunRecord[]
    expect(records.map(r => r.id)).toEqual(made.toReversed().map(r => r.id))
    expect(records).toEqual(made.toReversed())
    expect((await standards(['runs', 'acme']).finish()).seen).toHaveLength(made.length)
    expect((await standards(['runs', 'nobody']).finish()).seen).toEqual([])
  })

  test('transcript prints the events as recorded', async () => {
    const id = made[0]!.id
    const proc = Bun.spawn(['bun', CLI, 'runs', 'transcript', id], { env, stdout: 'pipe' })
    expect(await new Response(proc.stdout).text()).toBe(await Bun.file(join(ws, '.state/runs', id, 'events.ndjson')).text())
    const missing = await standards(['runs', 'transcript', 'nope']).finish()
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain('no run nope')
  })

  test('sync removes the worktree of a merged PR and its branch, and keeps the branch of a closed one', async () => {
    const nothing = await standards(['runs', 'sync']).finish()
    expect(nothing.seen).toEqual([])

    const merged = await standards(['runs', 'sync'], { FAKE_GH_MERGED: PR8 }).finish()
    expect(merged.seen).toEqual([expect.objectContaining({ branch: 'standards/readme-2', pr: { url: PR8, number: 8, state: 'merged' } })])
    expect(existsSync(join(checkout, '.worktrees/std-readme-2'))).toBe(false)
    expect(await git(checkout, 'branch', '--list', 'standards/readme-2')).toBe('')

    const closed = await standards(['runs', 'sync'], { FAKE_GH_CLOSED: PR7 }).finish()
    const changed = closed.seen as unknown as RunRecord[]
    expect(changed.map(r => r.branch).sort()).toEqual(['standards/license', 'standards/readme'])
    expect(changed.every(r => r.pr?.state === 'closed')).toBe(true)
    expect(await readdir(join(checkout, '.worktrees'))).toEqual(expect.not.arrayContaining(['std-readme', 'std-license']))
    expect(await git(checkout, 'branch', '--list', 'standards/readme')).toContain('standards/readme')

    const saved = (await standards(['runs']).finish()).seen as unknown as RunRecord[]
    expect(saved.find(r => r.branch === 'standards/readme-2')?.pr?.state).toBe('merged')
  })
})
