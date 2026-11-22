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

const block = { 'src/blocks/cta/config.ts': "export const Cta = { slug: 'cta', custom: { '@justanarthur/payload-www': { path: '@/blocks/cta' } } }" }

test('passes a render path in the import map', async () => {
  expect((await run({ ...block, 'src/app/(payload)/admin/importMap.js': "'@/blocks/cta#default': Cta" })).state).toBe('pass')
})

test('fails no import map, and a block missing from it', async () => {
  expect((await run(block)).evidence).toContain('no generated importMap')
  expect((await run({ ...block, 'src/app/(payload)/admin/importMap.js': '{}' })).evidence).toContain('@/blocks/cta (src/blocks/cta/config.ts)')
})
