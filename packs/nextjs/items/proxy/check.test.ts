import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
const run = async (files: Record<string, string>, next = '16.2.0') => {
  const dir = await gitRepo({ 'package.json': JSON.stringify({ dependencies: { next } }), ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))

test('a middleware file fails; proxy.ts exporting proxy passes', async () => {
  expect(await run({ 'src/middleware.ts': 'export function middleware() {}\n' })).toEqual({ state: 'fail', evidence: expect.stringContaining('src/middleware.ts (rename to proxy)') })
  expect(await run({ 'proxy.ts': "export function proxy() {}\nexport const config = { matcher: ['/'] }\n" })).toEqual({
    state: 'pass',
    evidence: 'proxy.ts follows the proxy convention',
  })
  expect((await run({ 'app/page.tsx': '' })).evidence).toBe('no middleware or proxy')
})

test('proxy.ts still exporting middleware, or setting a runtime, fails; so does the old flag name', async () => {
  const outcome = await run({
    'proxy.ts': "export async function middleware() {}\nexport const config = { runtime: 'nodejs' }\n",
    'next.config.ts': 'export default { skipMiddlewareUrlNormalize: true }\n',
  })
  expect(outcome.evidence).toContain('proxy.ts:1 (export proxy')
  expect(outcome.evidence).toContain('proxy.ts:2 (proxy has no runtime option')
  expect(outcome.evidence).toContain('skipProxyUrlNormalize')
})

test('middleware kept on the edge runtime on purpose passes', async () => {
  const outcome = await run({ 'middleware.ts': "export function middleware() {}\nexport const config = { runtime: 'edge' }\n" })
  expect(outcome).toEqual({ state: 'pass', evidence: expect.stringContaining('keeps the edge runtime on purpose') })
})
