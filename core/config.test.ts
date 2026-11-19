import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, realpathSync } from 'node:fs'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadWorkspace } from './load.ts'
import { Worker } from './schema.ts'

const CLI = join(import.meta.dir, '../cli/standards.ts')

// Clones the local origin, then points origin at GitHub, as a real clone would leave it.
const FAKE_GH = `#!/bin/sh
echo "$*" >> "$FAKE_GH_LOG"
[ "$1 $2" = "repo clone" ] || exit 1
git clone -q "$FAKE_GH_ORIGIN" "$4" && git -C "$4" remote set-url origin "https://github.com/$3.git"
`

let dir = ''
let ws = ''
let env: Record<string, string | undefined> = {}

async function standards(args: string[], extra: Record<string, string> = {}) {
  const proc = Bun.spawn(['bun', CLI, ...args], { env: { ...env, ...extra }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  return { code, stdout, stderr, json: () => JSON.parse(stdout) }
}

const workers = async () => Bun.YAML.parse(await Bun.file(join(ws, 'workers.yml')).text()) as Worker[]

beforeAll(async () => {
  dir = realpathSync(await mkdtemp(join(tmpdir(), 'standards-config-')))
  ws = join(dir, 'ws')
  const gh = join(dir, 'gh')
  await Bun.write(gh, FAKE_GH)
  await chmod(gh, 0o755)
  env = { ...process.env, STANDARDS_WORKSPACE: ws, STANDARDS_GH_BIN: gh, FAKE_GH_LOG: join(dir, 'gh.log'), HOME: join(dir, 'home') }

  const git = (cwd: string, ...args: string[]) =>
    Bun.spawn(['git', '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, stdout: 'ignore', stderr: 'ignore' }).exited
  await git(dir, 'init', '-q', '-b', 'main', 'origin')
  await Bun.write(join(dir, 'origin/README.md'), '# widgets\n')
  await git(join(dir, 'origin'), 'add', '.')
  await git(join(dir, 'origin'), 'commit', '-q', '-m', 'first')
  env.FAKE_GH_ORIGIN = join(dir, 'origin')
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('permission_mode', () => {
  test("takes Claude Code's modes, reads the old default as manual, and defaults to acceptEdits", () => {
    const base = { id: 'w', runtime: 'claude-code', model: 'haiku' }
    for (const mode of ['manual', 'acceptEdits', 'auto', 'dontAsk', 'plan', 'bypassPermissions']) {
      expect(Worker.parse({ ...base, permission_mode: mode }).permission_mode).toBe(mode as Worker['permission_mode'])
    }
    expect(Worker.parse({ ...base, permission_mode: 'default' }).permission_mode).toBe('manual')
    expect(Worker.parse(base).permission_mode).toBe('acceptEdits')
    expect(Worker.safeParse({ ...base, permission_mode: 'yolo' }).success).toBe(false)
  })
})

describe('standards workspace init', () => {
  test('creates businesses/, the preset workers and a .gitignore for .state/, keeping what is there', async () => {
    const { code, json } = await standards(['workspace', 'init', ws])
    expect(code).toBe(0)
    expect(json()).toEqual({ dir: ws })
    expect(existsSync(join(ws, 'businesses'))).toBe(true)
    expect((await workers()).map(w => [w.id, w.model, w.permission_mode])).toEqual([
      ['sonnet-fixer', 'sonnet', 'acceptEdits'],
      ['opus-fixer', 'opus', 'acceptEdits'],
      ['opus-reviewer', 'opus', 'plan'],
    ])
    expect(await Bun.file(join(ws, '.gitignore')).text()).toBe('.state/\n')

    const other = join(dir, 'other')
    await Bun.write(join(other, '.gitignore'), 'node_modules/')
    await Bun.write(join(other, 'workers.yml'), '[]\n')
    expect((await standards(['workspace', 'init', other])).code).toBe(0)
    expect(await Bun.file(join(other, '.gitignore')).text()).toBe('node_modules/\n.state/\n')
    expect(await Bun.file(join(other, 'workers.yml')).text()).toBe('[]\n')
    await standards(['workspace', 'init', other])
    expect(await Bun.file(join(other, '.gitignore')).text()).toBe('node_modules/\n.state/\n')
  })
})

describe('standards worker', () => {
  test('set adds a worker, replaces one in place, and reads the old default mode as manual', async () => {
    const added = await standards(['worker', 'set', '--json', JSON.stringify({ id: 'haiku', runtime: 'claude-code', model: 'haiku', permission_mode: 'default' })])
    expect(added.code).toBe(0)
    expect(added.json()).toEqual({ id: 'haiku', runtime: 'claude-code', profile: '~/.claude', model: 'haiku', permission_mode: 'manual', allow: [] })

    const replaced = await standards(['worker', 'set', '--json', JSON.stringify({ id: 'opus-fixer', runtime: 'claude-code', model: 'opus', permission_mode: 'bypassPermissions' })])
    expect(replaced.code).toBe(0)
    const saved = await workers()
    expect(saved.map(w => w.id)).toEqual(['sonnet-fixer', 'opus-fixer', 'opus-reviewer', 'haiku'])
    expect(saved[1]).toMatchObject({ permission_mode: 'bypassPermissions', allow: [] })
    expect((await loadWorkspace(ws)).workers).toEqual(saved)
  })

  test('set refuses an invalid worker or bad JSON, and leaves workers.yml alone', async () => {
    const before = await Bun.file(join(ws, 'workers.yml')).text()
    const invalid = await standards(['worker', 'set', '--json', JSON.stringify({ id: 'x', runtime: 'codex', model: 'm', permission_mode: 'yolo' })])
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain('runtime')
    expect(invalid.stderr).toContain('permission_mode')
    const garbled = await standards(['worker', 'set', '--json', '{id:'])
    expect(garbled.code).toBe(1)
    expect(garbled.stderr).toContain('--json')
    expect(await Bun.file(join(ws, 'workers.yml')).text()).toBe(before)
  })

  test('allow appends a rule once', async () => {
    for (let i = 0; i < 2; i++) {
      const { code, json } = await standards(['worker', 'allow', 'haiku', 'Bash(python3 -)'])
      expect(code).toBe(0)
      expect(json().allow).toEqual(['Bash(python3 -)'])
    }
    expect((await workers()).find(w => w.id === 'haiku')?.allow).toEqual(['Bash(python3 -)'])
    const missing = await standards(['worker', 'allow', 'nobody', 'Bash(ls)'])
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain('no worker nobody')
  })
})

describe('standards business', () => {
  const acme = {
    id: 'acme',
    name: 'Acme',
    assets: [
      { id: 'widgets', kind: 'repo', repo: 'Acme/widgets' },
      { id: 'site', kind: 'website', url: 'https://acme.example', repo: 'acme/widgets' },
      { id: 'other', kind: 'repo', repo: 'acme/other' },
    ],
    packs: ['repo@1'],
    worker: 'haiku',
  }

  test('set writes businesses/<id>.yml and checks its packs and worker', async () => {
    const { code, json } = await standards(['business', 'set', '--json', JSON.stringify(acme)])
    expect(code).toBe(0)
    expect(json()).toEqual({ ...acme, waivers: [] })
    expect((await loadWorkspace(ws)).businesses).toEqual([{ ...acme, waivers: [] } as never])

    const cases: [object, string][] = [
      [{ ...acme, id: 'Bad Id' }, 'id'],
      [{ ...acme, packs: ['nope'] }, 'no pack nope'],
      [{ ...acme, worker: 'nobody' }, 'no worker nobody'],
    ]
    for (const [business, message] of cases) {
      const result = await standards(['business', 'set', '--json', JSON.stringify(business)])
      expect(result.code).toBe(1)
      expect(result.stderr).toContain(message)
    }
    expect(existsSync(join(ws, 'businesses/Bad Id.yml'))).toBe(false)
  })

  test('a worker a business uses can not be removed; others can', async () => {
    const used = await standards(['worker', 'remove', 'haiku'])
    expect(used.code).toBe(1)
    expect(used.stderr).toContain('acme uses worker haiku')
    expect((await standards(['worker', 'remove', 'opus-fixer'])).code).toBe(0)
    expect((await workers()).map(w => w.id)).toEqual(['sonnet-fixer', 'opus-reviewer', 'haiku'])
  })

  test('remove deletes the file', async () => {
    await standards(['business', 'set', '--json', JSON.stringify({ ...acme, id: 'temp' })])
    expect(existsSync(join(ws, 'businesses/temp.yml'))).toBe(true)
    expect((await standards(['business', 'remove', 'temp'])).code).toBe(0)
    expect(existsSync(join(ws, 'businesses/temp.yml'))).toBe(false)
    expect((await standards(['business', 'remove', 'temp'])).stderr).toContain('no business temp')
  })
})

describe('standards clone', () => {
  const pathOf = async (asset: string) => (await loadWorkspace(ws)).businesses[0]!.assets.find(a => a.id === asset)?.path

  test('clones into ~/Projects/<owner>/<name> and writes the path with ~', async () => {
    const { code, json, stderr } = await standards(['clone', 'acme', 'widgets'])
    expect(stderr).toBe('')
    expect(code).toBe(0)
    expect(json()).toEqual({ path: '~/Projects/acme/widgets' })
    expect(existsSync(join(dir, 'home/Projects/acme/widgets/README.md'))).toBe(true)
    expect(await pathOf('widgets')).toBe('~/Projects/acme/widgets')
  })

  test('reuses a checkout of the same repo without cloning again', async () => {
    const log = Bun.file(join(dir, 'gh.log'))
    const clones = (await log.text()).trim().split('\n').length
    const { code, json } = await standards(['clone', 'acme', 'site'])
    expect(code).toBe(0)
    expect(json()).toEqual({ path: '~/Projects/acme/widgets' })
    expect((await log.text()).trim().split('\n')).toHaveLength(clones)
  })

  test('refuses an asset that has a path, and a folder that holds another repo', async () => {
    const again = await standards(['clone', 'acme', 'widgets'])
    expect(again.code).toBe(1)
    expect(again.stderr).toContain('already has a path')
    const taken = await standards(['clone', 'acme', 'other', '--into', join(dir, 'home/Projects/acme/widgets')])
    expect(taken.code).toBe(1)
    expect(taken.stderr).toContain('something other than acme/other')
  })

  test('--into clones elsewhere, and a path outside home stays absolute', async () => {
    const into = join(dir, 'elsewhere/other')
    const { code, json } = await standards(['clone', 'acme', 'other', '--into', into])
    expect(code).toBe(0)
    expect(json()).toEqual({ path: into })
    expect(await pathOf('other')).toBe(into)
  })
})
