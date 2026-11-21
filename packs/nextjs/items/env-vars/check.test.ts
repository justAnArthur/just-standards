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

test('public names and server-only secrets pass', async () => {
  const outcome = await run({
    '.env.example': 'NEXT_PUBLIC_SITE_URL=\nNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=\nNEXT_PUBLIC_MAPBOX_TOKEN=\nCMS_API_TOKEN=\n# NEXT_PUBLIC_OLD_SECRET= is commented out\n',
    'lib/cms.ts': "import 'server-only'\nexport const token = process.env.CMS_API_TOKEN\n",
    'components/Map.tsx': "'use client'\nexport const Map = () => <div data-url={process.env.NEXT_PUBLIC_SITE_URL} data-env={process.env.NODE_ENV} data-build={process.env.BUILD_ID} />\n",
    'next.config.ts': 'export default { env: { BUILD_ID: process.env.GIT_SHA } }\n',
  })
  expect(outcome).toEqual({ state: 'pass', evidence: expect.stringContaining('no secret is NEXT_PUBLIC_') })
})

test('a secret under NEXT_PUBLIC_ fails, in code and in tracked env files', async () => {
  const outcome = await run({
    '.env.production': 'NEXT_PUBLIC_CMS_API_TOKEN=abc\n',
    'lib/fetch.ts': 'export const headers = { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CMS_API_TOKEN}` }\n',
    'lib/db.ts': 'export const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY\n',
  })
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('.env.production:1 (NEXT_PUBLIC_CMS_API_TOKEN is a secret')
  expect(outcome.evidence).toContain('lib/fetch.ts:1')
  expect(outcome.evidence).toContain('lib/db.ts:1 (NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')
  // the value is never shown
  expect(outcome.evidence).not.toContain('abc')
})

test('a server variable read in a Client Component fails', async () => {
  const outcome = await run({ 'components/Search.tsx': "'use client'\nexport function Search() {\n  return fetch(process.env.API_URL)\n}\n" })
  expect(outcome).toEqual({ state: 'fail', evidence: expect.stringContaining('components/Search.tsx:3 (API_URL is empty in a Client Component)') })
})
