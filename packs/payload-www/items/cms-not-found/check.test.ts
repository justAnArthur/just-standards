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

test('passes a 404 rendered from the CMS, directly or through a component', async () => {
  expect((await run({ 'src/app/(frontend)/[locale]/not-found.tsx': "import { createCollectionPageExports } from '@justanarthur/payload-www/render-pages'" })).state).toBe('pass')
  const through = { 'src/app/(frontend)/[locale]/not-found.tsx': "import { NotFound } from '@/components/NotFound'", 'src/components/NotFound/index.tsx': 'await getPayload({ config })' }
  expect((await run(through)).state).toBe('pass')
})

test('fails a hard-coded 404 and none at all', async () => {
  expect((await run({ 'src/app/(frontend)/[locale]/not-found.tsx': '<h1>404</h1>' })).evidence).toContain('is hard-coded')
  expect((await run({ 'src/app/(payload)/admin/not-found.tsx': '' })).evidence).toContain('no not-found page')
})
