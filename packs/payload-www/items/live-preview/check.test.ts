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

test('passes livePreview in a config, fails without', async () => {
  expect((await run({ 'src/payload.config.ts': 'admin: { livePreview: { url } }' })).state).toBe('pass')
  expect((await run({ 'src/payload.config.ts': 'admin: {}' })).state).toBe('fail')
})
