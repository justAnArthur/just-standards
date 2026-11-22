import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../../nextjs/fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo({ 'package.json': JSON.stringify({ dependencies: { next: '16.0.0', payload: '3.94.0', '@justanarthur/payload-www': '2.9.0' } }), ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

test('passes exported subpaths', async () => {
  const outcome = await run({
    'src/payload.config.ts': "import { createWWWConfig } from '@justanarthur/payload-www/config'\nconst { withWWWConfig } = createWWWConfig()\n",
    'src/app/page.tsx': "const m = await import('@justanarthur/payload-www/render-pages')\n",
  })
  expect(outcome.state).toBe('pass')
})

test('fails a missing subpath, the root, and removed call shapes', async () => {
  const outcome = await run({
    'src/a.ts': "import { x } from '@justanarthur/payload-www/server'\nimport y from '@justanarthur/payload-www'\n",
    'src/payload.config.ts': 'createWWWConfig({ locales })\nconst c = { defaultPlugins: d => d }\n',
  })
  expect(outcome.state).toBe('fail')
  for (const text of ['payload-www/server is not exported', 'payload-www is not exported', 'takes no arguments', 'defaultPluginsConfigs']) expect(outcome.evidence).toContain(text)
})
