import { afterAll, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import serverRendered, { MIN_WORDS, served } from './check.ts'

const words = (n: number) => Array.from({ length: n }, (_, i) => `slovo${i}`).join(' ')
const pages: Record<string, string> = {
  '/shell': '<html><body><div id="root"></div><script>render()</script></body></html>',
  '/main': `<html><body><header><nav>${words(200)}</nav></header><main><h1>Prenájom áut</h1><p>${words(150)}</p></main></body></html>`,
  // a Next.js page whose content streamed into a hidden boundary still has it in the HTML
  '/streamed': `<html><body><div hidden id="S:0"><h1>Vans</h1><p>${words(130)}</p></div><script>$RC("B:0","S:0")</script></body></html>`,
  '/chrome-only': `<html><body><header><h1>Logo</h1></header><main></main><footer>${words(300)}</footer></body></html>`,
}
const server = Bun.serve({
  port: 0,
  fetch: request => new Response(pages[new URL(request.url).pathname] ?? 'nope', { headers: { 'content-type': 'text/html' } }),
})
afterAll(() => server.stop(true))
const ctx = (path: string) => ({ asset: { id: 'site', kind: 'website', url: `http://localhost:${server.port}${path}` } }) as Context

test('an app shell fails: no h1, no words', async () => {
  const outcome = await serverRendered(ctx('/shell'))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('no h1 with text')
  expect(outcome.evidence).toContain(`0 words of visible text in the body outside header, nav and footer, under ${MIN_WORDS}`)
})

test('counts the words of main, not the nav', async () => {
  expect(await served(pages['/main'] as string)).toMatchObject({ h1: 'Prenájom áut', where: 'main', words: 152 })
  expect((await serverRendered(ctx('/main'))).state).toBe('pass')
})

test('streamed content in a hidden boundary counts; scripts do not', async () => {
  expect(await served(pages['/streamed'] as string)).toMatchObject({ h1: 'Vans', words: 131 })
})

test('a page whose only text is header and footer fails', async () => {
  const outcome = await serverRendered(ctx('/chrome-only'))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('0 words')
})
