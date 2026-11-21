import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo({ 'package.json': '{"dependencies":{"next":"16.0.0"}}', ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

test('fails on a hand-written <head> and next/head in app/', async () => {
  const outcome = await run({
    'app/layout.tsx': "export const metadata = {}\nexport default ({ children }) => (\n  <html>\n    <head>\n      <meta name=\"x\" content=\"y\" />\n    </head>\n  </html>\n)\n",
    'app/about/page.tsx': "import Head from 'next/head'\n",
  })
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('app/about/page.tsx:1, app/layout.tsx:4, app/layout.tsx:5')
})

test('fails when nothing exports metadata, passes when a layout does; an SVG <title> is fine', async () => {
  const icon = 'export const Logo = () => <svg><title>Logo</title></svg>\n'
  expect((await run({ 'app/page.tsx': 'export default () => null\n', 'app/Logo.tsx': icon })).evidence).toContain('no layout or page')
  const ok = await run({ 'app/layout.tsx': 'export async function generateMetadata() { return {} }\n', 'app/Logo.tsx': icon })
  expect(ok).toEqual({ state: 'pass', evidence: expect.stringContaining('1 metadata / generateMetadata exports') })
})

test('a pages-router app passes: next/head is its API', async () => {
  expect((await run({ 'pages/index.tsx': "import Head from 'next/head'\n" })).state).toBe('pass')
})
