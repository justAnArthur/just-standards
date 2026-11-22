import { afterAll, beforeAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../../nextjs/fixture.ts'
import check from './check.ts'

const versions: Record<string, string> = { '@justanarthur/payload-www': '2.9.0', '@justanarthur/payload-plugin-seo': '4.2.0' }
let server: ReturnType<typeof Bun.serve>
const dirs: string[] = []
beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: request => {
      const name = decodeURIComponent(new URL(request.url).pathname).replace(/^\/|\/latest$/g, '')
      return versions[name] ? Response.json({ version: versions[name] }) : new Response('', { status: 404 })
    },
  })
  process.env.STANDARDS_NPM_REGISTRY = `http://localhost:${server.port}`
})
afterAll(async () => {
  server.stop()
  delete process.env.STANDARDS_NPM_REGISTRY
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })))
})
const run = async (deps: Record<string, string>) => {
  const dir = await gitRepo({ 'package.json': JSON.stringify({ dependencies: { next: '16.0.0', ...deps } }) })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

test('passes the latest minor and @payloadcms packages on the payload version', async () => {
  const outcome = await run({ payload: '3.94.1', '@payloadcms/next': '3.94.1', '@justanarthur/payload-www': '^2.9.0', '@justanarthur/payload-plugin-seo': '4.2.0' })
  expect(outcome.state).toBe('pass')
})

test('fails a toolkit a minor behind and a @payloadcms package apart', async () => {
  const outcome = await run({ payload: '3.94.1', '@payloadcms/ui': '3.88.0', '@justanarthur/payload-www': '2.6.0' })
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('@justanarthur/payload-www 2.6.0 (latest 2.9.0)')
  expect(outcome.evidence).toContain('@payloadcms/ui 3.88.0 differ from payload 3.94.1')
})
