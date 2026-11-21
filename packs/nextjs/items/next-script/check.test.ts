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

test('next/script, JSON-LD and an inline theme script pass', async () => {
  const outcome = await run({
    'app/layout.tsx': [
      "import Script from 'next/script'",
      'export default function Layout({ children }) {',
      '  return (',
      '    <html>',
      '      <head><script dangerouslySetInnerHTML={{ __html: `document.documentElement.dataset.theme = localStorage.theme` }} /></head>',
      '      <body>{children}<Script src="https://www.googletagmanager.com/gtag/js?id=G-1" strategy="afterInteractive" /></body>',
      '    </html>',
      '  )',
      '}',
    ].join('\n'),
    'app/page.tsx': 'export default () => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@type": "Organization" }) }} />\n',
  })
  expect(outcome).toEqual({ state: 'pass', evidence: 'no raw <script> loads a third-party script' })
})

test('a raw <script src> and an inline gtag snippet fail, naming the lines', async () => {
  const outcome = await run({
    'app/layout.tsx': [
      'export default function Layout({ children }) {',
      '  return (',
      '    <html>',
      '      <head>',
      '        <script',
      '          async',
      '          src="https://www.googletagmanager.com/gtag/js?id=G-1"',
      '        />',
      "        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer = []; function gtag(){dataLayer.push(arguments)} gtag('js', new Date())` }} />",
      '      </head>',
      '      <body>{children}</body>',
      '    </html>',
      '  )',
      '}',
    ].join('\n'),
  })
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('app/layout.tsx:5 (<script src>)')
  expect(outcome.evidence).toContain('app/layout.tsx:9 (inline third-party tag)')
})
