import { afterAll, beforeAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const registry = Bun.serve({
  port: 0,
  fetch: request => (new URL(request.url).pathname === '/next/latest' ? Response.json({ version: '16.4.6' }) : new Response('no', { status: 404 })),
})
const dirs: string[] = []
beforeAll(() => {
  process.env.STANDARDS_NPM_REGISTRY = `http://localhost:${registry.port}`
})
afterAll(async () => {
  registry.stop(true)
  delete process.env.STANDARDS_NPM_REGISTRY
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })))
})
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo(files)
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

test('one major behind passes, two fail', async () => {
  expect(await run({ 'package.json': '{"dependencies":{"next":"^15.5.0"}}' })).toEqual({ state: 'pass', evidence: 'next ^15.5.0, latest 16.4.6' })
  expect(await run({ 'package.json': '{"dependencies":{"next":"13.4.19"}}' })).toEqual({
    state: 'fail',
    evidence: 'next 13.4.19 is 3 majors behind the latest 16.4.6',
  })
})

test('reads a pnpm catalog version, and names each app of a monorepo', async () => {
  const outcome = await run({
    'package.json': '{"private":true}',
    'pnpm-workspace.yaml': 'catalog:\n  next: 16.1.0\n',
    'apps/a/package.json': '{"dependencies":{"next":"catalog:"}}',
    'apps/b/package.json': '{"devDependencies":{"next":"14.2.0"}}',
  })
  expect(outcome).toEqual({ state: 'fail', evidence: 'apps/b: next 14.2.0 is 2 majors behind the latest 16.4.6' })
})
