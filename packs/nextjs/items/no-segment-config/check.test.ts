import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
const repo = async (files: Record<string, string>) => {
  const dir = await gitRepo({ 'package.json': '{"dependencies":{"next":"16.2.0"}}', ...files })
  dirs.push(dir)
  return contextOf({ path: dir })
}
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))

const PAGE = "export const revalidate = 60\nexport default function Page() {}\n"

test('fails on segment config in app/ when cacheComponents is on, naming the file and line', async () => {
  const outcome = await check(await repo({ 'next.config.ts': 'export default { cacheComponents: true }\n', 'src/app/[locale]/page.tsx': `// note\n${PAGE}` }))
  expect(outcome).toEqual({ state: 'fail', evidence: expect.stringContaining('src/app/[locale]/page.tsx:2') })
})

test('reads cacheComponents from a config the next.config imports', async () => {
  const outcome = await check(
    await repo({
      'next.config.js': "const shared = require('./next.config.shared')\nmodule.exports = shared\n",
      'next.config.shared.js': 'module.exports = { cacheComponents: true }\n',
      'app/page.js': "export const dynamic = 'force-dynamic'\n",
    }),
  )
  expect(outcome.state).toBe('fail')
})

test('allows segment config when cacheComponents is off, and ignores comments', async () => {
  expect((await check(await repo({ 'next.config.ts': 'export default {}\n', 'app/page.tsx': PAGE }))).state).toBe('pass')
  const commented = await check(await repo({ 'next.config.ts': 'export default { cacheComponents: true }\n', 'app/page.tsx': '// export const dynamic = 1\n' }))
  expect(commented.state).toBe('pass')
})

test('checks each app of a monorepo and names it', async () => {
  const dir = await gitRepo({
    'package.json': '{"workspaces":["apps/*"]}',
    'apps/web/package.json': '{"dependencies":{"next":"16.0.0"}}',
    'apps/web/next.config.mjs': 'export default { cacheComponents: true }\n',
    'apps/web/app/page.tsx': PAGE,
    'apps/docs/package.json': '{"dependencies":{"next":"16.0.0"}}',
    'apps/docs/app/page.tsx': PAGE,
  })
  dirs.push(dir)
  const outcome = await check(contextOf({ path: dir }))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toStartWith('apps/web: ')
  expect(outcome.evidence).not.toContain('apps/docs')
})

test('rejects dynamicParams and an empty generateStaticParams, allows preferredRegion and maxDuration', async () => {
  const config = { 'next.config.ts': 'export default { cacheComponents: true }\n' }
  const dynamicParams = await check(await repo({ ...config, 'app/[slug]/page.tsx': 'export const dynamicParams = false\n' }))
  expect(dynamicParams).toEqual({ state: 'fail', evidence: expect.stringContaining('app/[slug]/page.tsx:1') })
  const empty = await check(
    await repo({
      ...config,
      'app/[slug]/page.tsx': 'export async function generateStaticParams() {\n  const slugs = await list()\n  if (!slugs) return []\n  return slugs\n}\n',
    }),
  )
  expect(empty).toEqual({ state: 'fail', evidence: expect.stringContaining('app/[slug]/page.tsx:3 (generateStaticParams returns [])') })
  const arrow = await check(await repo({ ...config, 'app/[slug]/page.tsx': 'export const generateStaticParams = async () => []\n' }))
  expect(arrow.state).toBe('fail')
  const kept = await check(await repo({ ...config, 'app/page.tsx': "export const preferredRegion = 'home'\nexport const maxDuration = 30\n" }))
  expect(kept.state).toBe('pass')
})

test('a repo without Next.js is an error, not a pass', async () => {
  const dir = await gitRepo({ 'package.json': '{"dependencies":{"vite":"6"}}' })
  dirs.push(dir)
  expect(await check(contextOf({ path: dir }))).toEqual({ state: 'error', evidence: expect.stringContaining('not a Next.js repo') })
})
