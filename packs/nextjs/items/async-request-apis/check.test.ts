import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo({ 'package.json': '{"dependencies":{"next":"16.2.0"}}', ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))

test('awaited params, searchParams, cookies() and headers() pass', async () => {
  const outcome = await run({
    'app/[slug]/page.tsx': [
      "import { cookies } from 'next/headers'",
      'type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }',
      'export async function generateMetadata({ params }: Props) {',
      '  const { slug } = await params',
      '  return { title: slug }',
      '}',
      'export default async function Page(props: Props) {',
      '  const params = await props.params',
      "  const theme = (await cookies()).get('theme')",
      '  return <h1 className={theme?.value}>{params.slug}</h1>',
      '}',
      '// cookies().get("old") in a comment is fine',
    ].join('\n'),
    'app/api/[id]/route.ts':
      'export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {\n  const { id } = await params\n  const q = new URL(request.url).searchParams.get("q")\n  return Response.json({ id, q })\n}\n',
    'app/client/page.tsx':
      "'use client'\nimport { use } from 'react'\nimport { useSearchParams } from 'next/navigation'\nexport default function Page(props: { params: Promise<{ id: string }> }) {\n  const { id } = use(props.params)\n  const searchParams = useSearchParams()\n  return <p>{id}{searchParams.get('q')}</p>\n}\n",
  })
  expect(outcome).toEqual({ state: 'pass', evidence: expect.stringContaining('awaited') })
})

test('fails on sync params typed as objects, destructured or read, and on sync cookies(), naming the lines', async () => {
  const outcome = await run({
    'app/[slug]/page.tsx': ['export default function Page({ params }: { params: { slug: string } }) {', '  const { slug } = params', '  return <h1>{params.slug}</h1>', '}'].join('\n'),
    'lib/session.ts':
      "import { cookies as jar, headers } from 'next/headers'\nexport const token = () => jar().get('token')\nexport function ua() {\n  const list = headers()\n  return list.get('user-agent')\n}\n",
  })
  expect(outcome.state).toBe('fail')
  for (const hit of ['app/[slug]/page.tsx:1', 'app/[slug]/page.tsx:2', 'app/[slug]/page.tsx:3', 'lib/session.ts:2', 'lib/session.ts:4']) expect(outcome.evidence).toContain(hit)
})

test('an UnsafeUnwrapped cast left by the codemod fails', async () => {
  const outcome = await run({
    'app/legacy/page.tsx': "import { type UnsafeUnwrappedCookies, cookies } from 'next/headers'\nexport default async function Page() {\n  const c = (await cookies()) as unknown as UnsafeUnwrappedCookies\n  return null\n}\n",
  })
  expect(outcome).toEqual({ state: 'fail', evidence: expect.stringContaining('app/legacy/page.tsx:1') })
})

test('generateStaticParams keeps its plain params', async () => {
  const outcome = await run({
    'app/[locale]/[page]/page.tsx': [
      'export async function generateStaticParams({ params }: { params: { locale: string } }) {',
      '  return (await pages(params.locale)).map(page => ({ page }))',
      '}',
      'export default async function Page({ params }: { params: Promise<{ page: string }> }) {',
      '  const { page } = await params',
      '  return page',
      '}',
    ].join('\n'),
  })
  expect(outcome.state).toBe('pass')
})

test('headers() of another module and object literals named params are not request APIs', async () => {
  const outcome = await run({
    'app/page.tsx': "import { headers } from './lib'\nexport default function Page() {\n  const h = headers()\n  return <Link href={{ pathname: '/x', params: { slug: 'a' } }} />\n}\n",
  })
  expect(outcome.state).toBe('pass')
})
