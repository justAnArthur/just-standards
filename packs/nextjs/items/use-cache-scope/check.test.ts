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

test("async 'use cache' functions taking request values as arguments pass", async () => {
  const outcome = await run({
    'lib/data.ts':
      "import { cookies } from 'next/headers'\nexport async function prices({ locale }: { locale: string }) {\n  'use cache'\n  return fetch(`/prices/${locale}`)\n}\nexport async function page() {\n  const locale = (await cookies()).get('locale')?.value ?? 'sk'\n  return prices({ locale })\n}\n",
    'lib/cached.ts': "'use cache'\nexport const pageSize = 20\nexport async function list() {}\nexport const get = async () => {}\n",
  })
  expect(outcome).toEqual({ state: 'pass', evidence: "2 'use cache' scopes, all async, none reading cookies() or headers()" })
})

test("cookies() inside a 'use cache' function, and a sync cached function, fail", async () => {
  const outcome = await run({
    'lib/data.ts': "import { cookies } from 'next/headers'\nexport async function prices() {\n  'use cache'\n  const locale = (await cookies()).get('locale')\n  return locale\n}\nexport function total() {\n  'use cache'\n  return 1\n}\n",
    'lib/file.ts': "'use cache'\nimport { headers } from 'next/headers'\nexport function list() {\n  return headers()\n}\n",
  })
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain("lib/data.ts:4 (cookies()/headers() inside 'use cache')")
  expect(outcome.evidence).toContain("lib/data.ts:8 (a 'use cache' function must be async)")
  expect(outcome.evidence).toContain("lib/file.ts:3 (an export of a 'use cache' file must be async)")
  expect(outcome.evidence).toContain("lib/file.ts:4 (cookies()/headers() in a 'use cache' file)")
})

test("'use cache: private' may read cookies", async () => {
  const outcome = await run({ 'lib/me.ts': "import { cookies } from 'next/headers'\nexport async function me() {\n  'use cache: private'\n  return (await cookies()).get('id')\n}\n" })
  expect(outcome.state).toBe('pass')
})
