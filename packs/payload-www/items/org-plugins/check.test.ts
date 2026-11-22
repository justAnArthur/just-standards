import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../../nextjs/fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (deps: Record<string, string>, config = '') => {
  const base = { next: '16.0.0', payload: '3.94.0', '@justanarthur/payload-www': '2.9.0', sharp: '0.34.0' }
  const dir = await gitRepo({ 'package.json': JSON.stringify({ dependencies: { ...base, ...deps } }), 'src/payload.config.ts': config })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

test('passes the defaults', async () => {
  expect((await run({}, 'defaultPluginsConfigs: { seo: d => ({ ...d }) }')).state).toBe('pass')
})

test('fails @payloadcms/plugin-seo beside it and a plugin turned off', async () => {
  const outcome = await run({ '@payloadcms/plugin-seo': '3.94.0' }, 'defaultPluginsConfigs: { translator: false }')
  expect(outcome.evidence).toContain('@payloadcms/plugin-seo is installed: the org')
  expect(outcome.evidence).toContain('defaultPluginsConfigs.translator is turned off')
})
