import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../../nextjs/fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>, deps: Record<string, string> = {}, scripts: Record<string, string> = {}) => {
  const manifest = { scripts, dependencies: { next: '16.0.0', payload: '3.94.0', '@justanarthur/payload-www': '2.9.0', ...deps } }
  const dir = await gitRepo({ 'package.json': JSON.stringify(manifest), ...files })
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}

test('passes token classes, a theme file and an email template', async () => {
  const files = {
    'src/blocks/Hero/Component.tsx': '<section className="bg-primary text-primary-foreground">',
    'src/components/theme/tokens.ts': 'export const primary = "#0a84ff"',
    'src/blocks/Media/media.email-block.tsx': '<td style={{ color: "#333" }}>',
  }
  expect((await run(files)).state).toBe('pass')
})

test('fails colour literals in blocks and components', async () => {
  const files = {
    'src/blocks/Hero/Component.tsx': 'const a = 1\n<div className="bg-[#ff0000]">',
    'src/components/Card.module.css': '.card {\n  color: #333;\n}',
    'src/components/Badge.tsx': '<span style={{ background: "rgba(0, 0, 0, 0.5)" }}>',
  }
  const outcome = await run(files)
  expect(outcome.state).toBe('fail')
  for (const hit of ['Hero/Component.tsx:2', 'Card.module.css:2', 'Badge.tsx:1']) expect(outcome.evidence).toContain(hit)
})
