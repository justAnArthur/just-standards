import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

const dirs: string[] = []
afterAll(() => Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true }))))
const run = async (files: Record<string, string>) => {
  const dir = await gitRepo(files)
  dirs.push(dir)
  return check(contextOf({ path: dir }))
}
const manifest = JSON.stringify({ scripts: { dev: 'next dev', build: 'cross-env NODE_OPTIONS=--no-deprecation next build', test: 'vitest run', lint: 'eslint .' } })

test('no AGENTS.md or CLAUDE.md fails', async () => {
  expect((await run({ 'README.md': '# x' })).evidence).toStartWith('no AGENTS.md or CLAUDE.md')
})

test('names each task the doc does not show, with the command to add', async () => {
  const outcome = await run({ 'package.json': manifest, 'pnpm-lock.yaml': '', 'AGENTS.md': 'Run `pnpm install`, then `pnpm dev`.\n' })
  expect(outcome).toEqual({
    state: 'fail',
    evidence: "AGENTS.md doesn't show how to build (`pnpm run build`), test (`pnpm run test`), lint (`pnpm run lint`)",
  })
})

test('follows CLAUDE.md imports, and accepts a script by its command', async () => {
  const doc = '## Commands\n\n```sh\nbun install\nbun run dev\nbun --filter web build\n```\n\nTests: `vitest run`. Lint: `bun run lint`.\n'
  const outcome = await run({ 'package.json': manifest, 'bun.lock': '', 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': doc })
  expect(outcome).toEqual({ state: 'pass', evidence: expect.stringContaining('CLAUDE.md shows how to') })
})

test('prose is not a command', async () => {
  const outcome = await run({ 'package.json': manifest, 'AGENTS.md': 'We use npm to install, build, test and lint.\n' })
  expect(outcome.evidence).toContain('install (`npm install`)')
})

test('without a package.json, each task needs a command in code', async () => {
  const outcome = await run({ 'AGENTS.md': '```\nuv sync\nmake test\nruff check\nmake build\n```\n' })
  expect(outcome).toEqual({ state: 'fail', evidence: "AGENTS.md doesn't show how to run" })
})
