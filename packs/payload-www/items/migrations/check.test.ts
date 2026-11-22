import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../../nextjs/fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>, deps: Record<string, string> = {}, scripts: Record<string, string> = {}) => {
  const manifest = { scripts, dependencies: { next: '16.0.0', payload: '3.94.0', '@justanarthur/payload-www': '2.9.0', ...deps } }
  const dir = await gitRepo({ 'package.json': JSON.stringify(manifest), ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

const migration = { 'src/migrations/20260101_init.ts': 'export async function up() {}', 'src/migrations/index.ts': '' }

test('passes committed migrations run before the build', async () => {
  expect((await run(migration, {}, { ci: 'payload migrate && next build' })).state).toBe('pass')
  expect((await run({ ...migration, 'src/payload.config.ts': 'postgresAdapter({ prodMigrations: migrations })' })).state).toBe('pass')
})

test('fails push, no migrations, and migrations nothing runs', async () => {
  expect((await run({ ...migration, 'src/payload.config.ts': 'postgresAdapter({ push: true })' })).evidence).toContain('turns push on')
  expect((await run({})).evidence).toBe('no migrations folder is committed')
  expect((await run(migration, {}, { build: 'next build' })).evidence).toContain('neither prodMigrations nor a script')
})
