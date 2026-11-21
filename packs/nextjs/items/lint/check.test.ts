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

test('a flat config spreading eslint-config-next passes', async () => {
  const outcome = await run({ 'eslint.config.mjs': "import nextVitals from 'eslint-config-next/core-web-vitals'\nexport default [...nextVitals]\n" })
  expect(outcome).toEqual({ state: 'pass', evidence: 'eslint.config.mjs uses eslint-config-next' })
  expect((await run({ '.eslintrc.json': '{ "extends": "next/core-web-vitals" }' })).state).toBe('pass')
})

test('Biome passes unless its linter is off', async () => {
  expect((await run({ 'biome.json': '{ "linter": { "enabled": true } }' })).state).toBe('pass')
  expect((await run({ 'biome.jsonc': '{ "linter": { "enabled": false } }' })).state).toBe('fail')
})

test('an ESLint config without Next rules, or none, fails', async () => {
  expect(await run({ 'eslint.config.js': "import js from '@eslint/js'\nexport default [js.configs.recommended]\n" })).toEqual({
    state: 'fail',
    evidence: expect.stringContaining("doesn't use eslint-config-next"),
  })
  expect((await run({})).evidence).toContain('no ESLint or Biome config')
})

test('a monorepo app finds the root config and a shared workspace config', async () => {
  const dir = await gitRepo({
    'package.json': '{"private":true,"workspaces":["apps/*","packages/*"]}',
    'eslint.config.mjs': "import shared from '@acme/eslint-config/next'\nexport default shared\n",
    'packages/eslint-config/package.json': '{"name": "@acme/eslint-config", "dependencies": {"eslint-config-next": "16.0.0"}}',
    'apps/web/package.json': '{"dependencies":{"next":"16.0.0"}}',
  })
  dirs.push(dir)
  expect(await check(contextOf({ path: dir }))).toEqual({ state: 'pass', evidence: 'eslint.config.mjs uses @acme/eslint-config, which builds on eslint-config-next' })
})
