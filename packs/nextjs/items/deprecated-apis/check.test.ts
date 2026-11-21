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

test('names deprecated APIs with their replacement', async () => {
  const outcome = await run({
    'next.config.ts': "export default {\n  experimental: {\n    turbopackFileSystemCacheForDev: false,\n    turbopack: { rules: {} },\n    serverComponentsExternalPackages: ['sharp'],\n  },\n}\n",
    'app/page.tsx': "import Image from 'next/image'\nimport { unstable_cacheLife as cacheLife } from 'next/cache'\nexport const runtime = 'edge'\nexport default function Page() {\n  return <Image\n    src=\"/a.png\"\n    alt=\"\"\n    priority\n  />\n}\n",
    'components/Form.tsx': "'use client'\nimport { useFormState } from 'react-dom'\n",
  })
  expect(outcome.state).toBe('fail')
  for (const hit of ['next.config.ts:4 (experimental.turbopack', 'next.config.ts:5 (experimental.serverComponentsExternalPackages', 'app/page.tsx:2 (unstable_cacheLife', "app/page.tsx:3 (runtime 'edge'", 'app/page.tsx:5 (Image priority'])
    expect(outcome.evidence).toContain(hit)
})

test('priority={false}, preload and a top-level turbopack pass; 15 apps keep priority', async () => {
  const page = "import Image from 'next/image'\nexport default () => <><Image src=\"/a.png\" alt=\"\" preload /><Image src=\"/b.png\" alt=\"\" priority={false} /></>\n"
  expect((await run({ 'next.config.ts': 'export default { turbopack: {} }\n', 'app/page.tsx': page })).state).toBe('pass')
  expect((await run({ 'app/page.tsx': "import Image from 'next/image'\nexport default () => <Image src=\"/a.png\" alt=\"\" priority />\n" }, '15.5.0')).state).toBe('pass')
})
