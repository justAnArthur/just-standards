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

test('remotePatterns for named hosts pass; i18n domains are not image domains', async () => {
  const outcome = await run({
    'next.config.js':
      "module.exports = {\n  i18n: { domains: [{ domain: 'example.sk', defaultLocale: 'sk' }] },\n  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com', pathname: '/uploads/**' }, new URL('https://img.example.com/**')] },\n}\n",
  })
  expect(outcome).toEqual({ state: 'pass', evidence: 'images take remotePatterns for named hosts' })
})

test('images.domains, a ** host and SVGs without a CSP fail, naming the lines', async () => {
  const outcome = await run({
    'next.config.ts': [
      'export default {',
      '  images: {',
      "    domains: ['cdn.example.com'],",
      "    remotePatterns: [{ protocol: 'https', hostname: '**' }],",
      '    dangerouslyAllowSVG: true,',
      '  },',
      '}',
    ].join('\n'),
  })
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('next.config.ts:3 (images.domains is deprecated')
  expect(outcome.evidence).toContain('next.config.ts:4 (a pattern that allows any host)')
  expect(outcome.evidence).toContain('next.config.ts:5 (SVGs allowed without')
})

test('dangerouslyAllowSVG with a contentSecurityPolicy passes', async () => {
  const config = "export default { images: { dangerouslyAllowSVG: true, contentSecurityPolicy: \"default-src 'self'; script-src 'none'; sandbox;\" } }\n"
  expect((await run({ 'next.config.mjs': config })).state).toBe('pass')
})
