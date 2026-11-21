import { afterAll, expect, test } from 'bun:test'
import { contextOf } from '../../fixture.ts'
import check from './check.ts'

let delay = 0
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    if (new URL(request.url).pathname === '/old') return Response.redirect('/', 301)
    await Bun.sleep(delay)
    return new Response('<html></html>')
  },
})
afterAll(() => server.stop(true))
const url = `http://localhost:${server.port}/`

test('a fast page passes with the median of three', async () => {
  delay = 0
  expect(await check(contextOf({ url }))).toEqual({ state: 'pass', evidence: expect.stringMatching(/^http:\/\/localhost:\d+\/: first byte after median \d+ ms of \d+, \d+, \d+ ms$/) })
})

test('a slow page fails, and a redirect is followed and named', async () => {
  delay = 850
  const outcome = await check(contextOf({ url: `${url}old` }))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain(`(from ${url}old)`)
  expect(outcome.evidence).toContain('over 800 ms')
})
