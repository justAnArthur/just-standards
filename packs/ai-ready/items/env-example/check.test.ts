import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo(files)
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}
const code = {
  'src/db.ts': 'export const url = process.env.DATABASE_URL\nconst { SMTP_HOST, SMTP_PORT: port = 25 } = process.env\n',
  'src/client.tsx': "const key = import.meta.env.VITE_KEY ?? process.env['NEXT_PUBLIC_SITE']\nif (import.meta.env.DEV) {}\n",
  'src/platform.ts': 'process.env.NODE_ENV; process.env.VERCEL_URL; process.env.NEXT_PUBLIC_VERCEL_ENV; process.env.CI\n',
  'scripts/migrate.ts': "process.env.PAYLOAD_MIGRATING = 'true'\nif (process.env.PAYLOAD_MIGRATING) {}\n",
  'src/db.test.ts': 'process.env.TEST_ONLY\n',
}

test('no example file fails and names what the code reads', async () => {
  const outcome = await run(code)
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toStartWith('no .env.example; the code reads ')
  expect(outcome.evidence).toContain('DATABASE_URL (src/db.ts:1), SMTP_HOST (src/db.ts:2), SMTP_PORT (src/db.ts:2)')
})

test('names the variables the example misses, and skips platform, bundler, test and self-set ones', async () => {
  const outcome = await run({ ...code, '.env.example': 'DATABASE_URL=\n# SMTP_HOST=localhost\n' })
  expect(outcome).toEqual({
    state: 'fail',
    evidence: '.env.example misses VITE_KEY (src/client.tsx:1), NEXT_PUBLIC_SITE (src/client.tsx:1), SMTP_PORT (src/db.ts:2)',
  })
})

test('passes when every variable is listed, commented or not, in any example file', async () => {
  const outcome = await run({ ...code, '.env.example': 'DATABASE_URL=\n# SMTP_HOST=\nSMTP_PORT=25\n', 'apps/web/.env.local.example': 'VITE_KEY=\nexport NEXT_PUBLIC_SITE=\n' })
  expect(outcome).toEqual({ state: 'pass', evidence: '.env.example, apps/web/.env.local.example lists all 5 variables the code reads' })
})

test('code that reads no variables passes', async () => {
  expect((await run({ 'index.ts': 'console.log(1)\n' })).state).toBe('pass')
})
