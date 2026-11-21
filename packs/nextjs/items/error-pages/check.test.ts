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

const GLOBAL_ERROR = "'use client' // error boundaries are Client Components\nexport default function GlobalError({ retry }) {\n  return <html><body><button onClick={() => retry()}>Retry</button></body></html>\n}\n"

test('a root not-found and a global-error with html and body pass', async () => {
  const outcome = await run({ 'src/app/not-found.tsx': 'export default function NotFound() {}\n', 'src/app/global-error.tsx': GLOBAL_ERROR })
  expect(outcome).toEqual({ state: 'pass', evidence: 'src/app/not-found.tsx and src/app/global-error.tsx' })
  expect((await run({ 'app/global-not-found.tsx': '', 'app/global-error.jsx': GLOBAL_ERROR })).state).toBe('pass')
})

test('a not-found only under [locale] and no global-error fail', async () => {
  const outcome = await run({ 'app/[locale]/not-found.tsx': '', 'app/[locale]/page.tsx': '' })
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('no app/not-found')
  expect(outcome.evidence).toContain('no app/global-error')
})

test('error boundaries must be Client Components, and global-error renders its own document', async () => {
  const outcome = await run({
    'app/not-found.tsx': '',
    'app/global-error.tsx': "'use client'\nexport default function GlobalError() { return <p>Oops</p> }\n",
    'app/shop/error.tsx': 'export default function Error() { return <p>Oops</p> }\n',
  })
  expect(outcome.evidence).toContain('app/global-error.tsx renders no <html> and <body>')
  expect(outcome.evidence).toContain("app/shop/error.tsx isn't a Client Component")
})

test('a pages-router app passes', async () => {
  expect((await run({ 'pages/index.tsx': '' })).evidence).toBe('no app/ router')
})
