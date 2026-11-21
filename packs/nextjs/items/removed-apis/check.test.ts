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

test('passes on a clean Next 16 app', async () => {
  expect((await run({ 'next.config.ts': 'export default { cacheComponents: true, turbopack: {} }\n', 'app/page.tsx': 'export default function Page() {}\n' })).state).toBe('pass')
})

test('names what 16 removed in config, source and scripts', async () => {
  const dir = await gitRepo({
    'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' }, scripts: { lint: 'next lint', build: 'next build' } }),
    'next.config.js': "module.exports = {\n  eslint: { ignoreDuringBuilds: true },\n  publicRuntimeConfig: {},\n  experimental: { ppr: true },\n  // amp: {}\n}\n",
    'app/page.tsx': "import getConfig from 'next/config'\nexport const experimental_ppr = true\n",
    'app/actions.ts': "'use server'\nimport { revalidateTag } from 'next/cache'\nexport async function save() {\n  revalidateTag('posts')\n  revalidateTag(`post-${1}`, 'max')\n}\n",
    'app/@modal/(.)photo/page.tsx': 'export default function Page() {}\n',
  })
  dirs.push(dir)
  const outcome = await check(contextOf({ path: dir }))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('next.config.js:2 (the eslint option is removed)')
  expect(outcome.evidence).toContain('next.config.js:3 (runtime config is removed)')
  expect(outcome.evidence).toContain('next.config.js:4 (experimental ppr')
  expect(outcome.evidence).not.toContain('AMP')
  expect(outcome.evidence).toContain('more')
})

test('reads the scripts, parallel slots and the webpack config', async () => {
  const dir = await gitRepo({
    'package.json': JSON.stringify({ dependencies: { next: '16.1.0' }, scripts: { lint: 'next lint --fix', build: 'next build' } }),
    'next.config.mjs': 'export default {\n  webpack(config) {\n    return config\n  },\n}\n',
    'app/@modal/page.tsx': 'export default function Page() {}\n',
  })
  dirs.push(dir)
  const outcome = await check(contextOf({ path: dir }))
  expect(outcome.evidence).toContain('script "lint" (`next lint` is removed)')
  expect(outcome.evidence).toContain('app/@modal/ has no default.js')
  expect(outcome.evidence).toContain('webpack config')
})

test('a webpack config is fine with --webpack or a turbopack config, and a slot with default.tsx', async () => {
  const dir = await gitRepo({
    'package.json': JSON.stringify({ dependencies: { next: '16.1.0' }, scripts: { build: 'next build --webpack' } }),
    'next.config.mjs': 'export default { webpack: config => config }\n',
    'app/@modal/default.tsx': 'export default function Default() { return null }\n',
    'app/@modal/x/page.tsx': 'export default function Page() {}\n',
  })
  dirs.push(dir)
  expect((await check(contextOf({ path: dir }))).state).toBe('pass')
})

test('rules follow the installed major: 15 keeps what 16 removed', async () => {
  const files = { 'next.config.js': 'module.exports = { eslint: {} }\n', 'app/layout.tsx': "import { Inter } from '@next/font/google'\n" }
  const fifteen = await run(files, '15.5.0')
  expect(fifteen.evidence).toContain('@next/font is removed')
  expect(fifteen.evidence).not.toContain('eslint')
})
