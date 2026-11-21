import { expect, test } from 'bun:test'
import { serve } from '../../fixture.ts'
import serverLeak from './check.ts'

test('a platform name without a version passes', async () => {
  expect((await serve({ server: 'Vercel' }, serverLeak)).evidence).toBe('no X-Powered-By or version banner (Server: Vercel)')
  expect((await serve({ server: 'cloudflare', via: '1.1 vegur' }, serverLeak)).state).toBe('pass')
})

test('X-Powered-By of any value, and versions in Server, fail', async () => {
  expect(await serve({ 'x-powered-by': 'Next.js, Payload' }, serverLeak)).toEqual({
    state: 'fail',
    evidence: "the home page's response names its software: x-powered-by: Next.js, Payload",
  })
  expect((await serve({ server: 'Apache/2.4.41 (Ubuntu)' }, serverLeak)).evidence).toContain('server: Apache/2.4.41 (Ubuntu)')
  expect((await serve({ via: '1.1 varnish (Varnish/6.0)' }, serverLeak)).state).toBe('fail')
})
