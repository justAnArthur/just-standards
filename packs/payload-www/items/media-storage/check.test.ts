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

test('passes an upload collection stored through an adapter', async () => {
  const files = { 'src/collections/Media.ts': 'export const Media = { slug: "media", upload: true }', 'src/plugins.ts': 's3Storage({ collections: { media: true } })' }
  expect((await run(files, { '@payloadcms/storage-s3': '3.94.0' })).state).toBe('pass')
})

test('fails uploads on disk, and an adapter installed but never set up', async () => {
  const media = { 'src/collections/Media.ts': 'export const Media = { slug: "media", upload: { staticDir: "media" } }' }
  expect((await run(media)).evidence).toContain('stores files on the server disk')
  expect((await run(media, { '@payloadcms/storage-s3': '3.94.0' })).evidence).toContain('no code sets it up')
})
