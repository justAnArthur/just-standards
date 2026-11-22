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

test('passes the plugin with a frontend that reads it', async () => {
  const files = { 'src/plugins.ts': 'redirectsPlugin({ collections: ["pages"] })', 'src/app/redirects.ts': 'payload.find({ collection: "redirects" })' }
  expect((await run(files, { '@payloadcms/plugin-redirects': '3.94.0' })).state).toBe('pass')
})

test('fails no plugin, and a collection nothing reads', async () => {
  expect((await run({})).evidence).toContain('not set up')
  const unread = await run({ 'src/plugins.ts': 'redirectsPlugin({})' }, { '@payloadcms/plugin-redirects': '3.94.0' })
  expect(unread.evidence).toContain('no frontend code reads it')
})
