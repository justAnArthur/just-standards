import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo({ 'package.json': '{"dependencies":{"next":"15.0.0"}}', ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

test('fails on a Google Fonts link in a layout or an @import in CSS', async () => {
  const outcome = await run({
    'app/layout.tsx': '<head>\n  <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />\n</head>\n',
    'app/globals.css': "@import url('https://fonts.googleapis.com/css2?family=Lora');\n",
  })
  expect(outcome).toEqual({ state: 'fail', evidence: expect.stringContaining('app/globals.css:1, app/layout.tsx:2') })
})

test('passes next/font and a commented-out import', async () => {
  const outcome = await run({
    'app/layout.tsx': "import { Inter } from 'next/font/google'\nconst inter = Inter({ subsets: ['latin'] })\n",
    'app/globals.css': "/* @import url('https://fonts.googleapis.com/css2?family=Lora'); */\n",
  })
  expect(outcome.state).toBe('pass')
})
