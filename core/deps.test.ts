import { afterAll, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installDeps, managerOf } from './deps.ts'

const dirs: string[] = []
async function repo(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'standards-deps-'))
  dirs.push(dir)
  for (const [name, text] of Object.entries(files)) await Bun.write(join(dir, name), text)
  return dir
}
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))

test('the lockfile names the package manager, and what the worker may run', async () => {
  expect(managerOf(await repo({ 'pnpm-lock.yaml': '' }))?.install).toEqual(['pnpm', 'install', '--frozen-lockfile'])
  expect(managerOf(await repo({ 'package-lock.json': '{}' }))?.tools).toEqual(['Bash(npm *)', 'Bash(npx *)'])
  expect(managerOf(await repo({ 'bun.lock': '', 'package-lock.json': '{}' }))?.lock).toBe('bun.lock')
  expect(managerOf(await repo({ 'package.json': '{}' }))).toBeUndefined()
})

test('installs from the lockfile; nothing to do without one; a failure keeps the end of the output', async () => {
  expect(await installDeps(await repo({ 'package.json': '{}' }))).toBeUndefined()

  // bun deletes a lockfile with no packages, so npm stands in for a clean install
  const lock = '{"name":"empty","lockfileVersion":3,"requires":true,"packages":{"":{"name":"empty"}}}'
  const empty = await repo({ 'package.json': '{"name":"empty"}', 'package-lock.json': lock })
  expect(await installDeps(empty)).toEqual({ command: 'npm ci', ok: true })

  const broken = await repo({ 'package.json': '{"name":"broken","dependencies":{"left-pad":"1.3.0"}}', 'bun.lock': '{"lockfileVersion":1,"workspaces":{"":{"name":"broken"}},"packages":{}}' })
  const setup = await installDeps(broken)
  expect(setup).toMatchObject({ command: 'bun install --frozen-lockfile', ok: false })
  expect(setup?.error).toMatch(/lockfile/i)
})
