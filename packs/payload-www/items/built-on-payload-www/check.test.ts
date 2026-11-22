import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../../nextjs/fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (deps: Record<string, string>, files: Record<string, string> = {}) => {
  const dir = await gitRepo({ 'package.json': JSON.stringify({ dependencies: { next: '16.0.0', ...deps } }), ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}
const composed = "const { withWWWConfig } = createWWWConfig()\nexport default buildConfig(withWWWConfig({ blocks }))\n"

test('passes a config composed with withWWWConfig', async () => {
  expect((await run({ payload: '3.94.0', '@justanarthur/payload-www': '^2.9.0' }, { 'src/payload.config.ts': composed })).state).toBe('pass')
})

test('fails plain Payload, and a toolkit dependency the config never uses', async () => {
  expect(await run({ payload: '3.33.0' }, { 'src/payload.config.ts': 'export default buildConfig({})' })).toEqual({
    state: 'fail',
    evidence: 'depends on payload but not on @justanarthur/payload-www',
  })
  const unused = await run({ payload: '3.94.0', '@justanarthur/payload-www': '^2.9.0' }, { 'payload.config.ts': '// createWWWConfig()\nexport default buildConfig({})' })
  expect(unused.evidence).toContain("doesn't compose its config")
})

test('a Next app without payload passes as not applying', async () => {
  expect(await run({})).toEqual({ state: 'pass', evidence: 'not a Payload app' })
})
