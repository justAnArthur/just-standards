import { afterAll, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../../ai-ready/fixture.ts'
import dependencyVulns, { byPackage, cvss3, fixedIn, severityOf, type Vuln } from './check.ts'
import { parseLockfile } from './lockfiles.ts'

describe('lockfiles', () => {
  test('package-lock.json v3, with an alias, a nested copy, a workspace link and dev flags', () => {
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': { name: 'app' },
        'node_modules/next': { version: '15.1.0' },
        'node_modules/@scope/a': { version: '1.0.0', dev: true },
        'node_modules/@scope/a/node_modules/semver': { version: '5.7.1', dev: true },
        'node_modules/old': { name: 'real', version: '2.0.0' },
        'node_modules/local': { resolved: 'packages/local', link: true },
        'packages/local': { version: '0.0.1' },
      },
    }
    expect(parseLockfile('package-lock.json', JSON.stringify(lock))).toEqual([
      { name: 'next', version: '15.1.0', dev: undefined },
      { name: '@scope/a', version: '1.0.0', dev: true },
      { name: 'semver', version: '5.7.1', dev: true },
      { name: 'real', version: '2.0.0', dev: undefined },
    ])
  })
  test('package-lock.json v1, nested dependencies and an npm: alias', () => {
    const lock = { lockfileVersion: 1, dependencies: { a: { version: '1.0.0', dependencies: { b: { version: '2.0.0', dev: true } } }, c: { version: 'npm:d@3.0.0' } } }
    expect(parseLockfile('package-lock.json', JSON.stringify(lock)).map(p => `${p.name}@${p.version}`)).toEqual(['a@1.0.0', 'b@2.0.0', 'd@3.0.0'])
  })
  test('pnpm-lock.yaml v9, v6 and v5 keys', () => {
    const v9 = "lockfileVersion: '9.0'\npackages:\n  '@acemir/cssom@0.9.31':\n    resolution: {integrity: sha512-x}\n  next@16.2.6:\n    resolution: {integrity: sha512-y}\n  tarball@https://x.dev/t.tgz:\n    resolution: {tarball: https://x.dev/t.tgz}\n"
    expect(parseLockfile('pnpm-lock.yaml', v9).map(p => `${p.name}@${p.version}`)).toEqual(['@acemir/cssom@0.9.31', 'next@16.2.6'])
    const v6 = "lockfileVersion: '6.0'\npackages:\n  /@babel/core@7.24.0(supports-color@7.2.0):\n    resolution: {integrity: sha512-x}\n  /react@18.2.0:\n    dev: false\n"
    expect(parseLockfile('pnpm-lock.yaml', v6).map(p => `${p.name}@${p.version}`)).toEqual(['@babel/core@7.24.0', 'react@18.2.0'])
    const v5 = 'lockfileVersion: 5.4\npackages:\n  /@types/node/18.0.0:\n    dev: true\n  /ws/8.0.0_bufferutil@4.0.0:\n    dev: false\n'
    expect(parseLockfile('pnpm-lock.yaml', v5).map(p => `${p.name}@${p.version}`)).toEqual(['@types/node@18.0.0', 'ws@8.0.0'])
  })
  test('bun.lock: trailing commas, workspaces and git dependencies skipped', () => {
    const lock = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "app", }, },
  "packages": {
    "@modo/ui": ["@modo/ui@workspace:ui"],
    "next": ["next@16.4.6", "", { "dependencies": { "react": "19.3.0", }, }, "sha512-x"],
    "aliased": ["real-name@1.2.3", "", {}, "sha512-y"],
    "gitdep": ["gitdep@github:o/r#abc", {}, "abc"],
  },
}`
    expect(parseLockfile('bun.lock', lock).map(p => `${p.name}@${p.version}`)).toEqual(['next@16.4.6', 'real-name@1.2.3'])
  })
  test('yarn.lock classic and Berry', () => {
    const classic = `# yarn lockfile v1\n\n"@babel/code-frame@^7.0.0", "@babel/code-frame@^7.10.4":\n  version "7.12.13"\n  resolved "https://registry.yarnpkg.com/x"\n\nalias@npm:lodash@^4:\n  version "4.17.20"\n`
    expect(parseLockfile('yarn.lock', classic).map(p => `${p.name}@${p.version}`)).toEqual(['@babel/code-frame@7.12.13', 'lodash@4.17.20'])
    const berry = `__metadata:\n  version: 8\n\n"@babel/code-frame@npm:^7.0.0, @babel/code-frame@npm:^7.10.4":\n  version: 7.12.13\n  resolution: "@babel/code-frame@npm:7.12.13"\n\n"app@workspace:.":\n  version: 0.0.0-use.local\n  resolution: "app@workspace:."\n`
    expect(parseLockfile('yarn.lock', berry).map(p => `${p.name}@${p.version}`)).toEqual(['@babel/code-frame@7.12.13'])
  })
})

describe('severity', () => {
  test('CVSS v3 base scores', () => {
    expect(cvss3('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe(9.8)
    expect(cvss3('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H')).toBe(10)
    expect(cvss3('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N')).toBe(5.3)
    expect(cvss3('CVSS:3.0/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N')).toBe(5.3)
    expect(cvss3('CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H')).toBe(8.8)
    expect(cvss3('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N')).toBeUndefined()
  })
  test("GitHub's label first, then CVSS; a malicious package is critical", () => {
    expect(severityOf({ id: 'GHSA-1', database_specific: { severity: 'MODERATE' }, severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }] })).toBe('medium')
    expect(severityOf({ id: 'CVE-1', severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }] })).toBe('critical')
    expect(severityOf({ id: 'MAL-2025-1' })).toBe('critical')
    expect(severityOf({ id: 'OSV-1' })).toBe('unknown')
  })
  test('the lowest fixed version above the locked one', () => {
    const vuln: Vuln = {
      id: 'GHSA-x',
      affected: [
        { package: { ecosystem: 'npm', name: 'next' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '14.2.25' }] }] },
        { package: { ecosystem: 'npm', name: 'next' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '15.0.0' }, { fixed: '15.2.3' }] }] },
      ],
    }
    expect(fixedIn(vuln, 'next', '15.1.0')).toBe('15.2.3')
    expect(fixedIn(vuln, 'other', '15.1.0')).toBeUndefined()
  })
})

// A fake OSV: next@15.1.0 has a high advisory (and its CVE alias), lodash a moderate one, left-pad a withdrawn critical.
const VULNS: Record<string, Vuln> = {
  'GHSA-next-high': {
    id: 'GHSA-next-high',
    aliases: ['CVE-2025-1'],
    database_specific: { severity: 'HIGH' },
    affected: [{ package: { ecosystem: 'npm', name: 'next' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '15.0.0' }, { fixed: '15.2.3' }] }] }],
  },
  'CVE-2025-1': { id: 'CVE-2025-1', aliases: ['GHSA-next-high'], severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }] },
  'GHSA-lodash-mod': { id: 'GHSA-lodash-mod', database_specific: { severity: 'MODERATE' } },
  'GHSA-pad-gone': { id: 'GHSA-pad-gone', withdrawn: '2025-01-01T00:00:00Z', database_specific: { severity: 'CRITICAL' } },
}
const AFFECTED: Record<string, string[]> = { 'next@15.1.0': ['CVE-2025-1', 'GHSA-next-high'], 'lodash@4.17.20': ['GHSA-lodash-mod'], 'left-pad@1.3.0': ['GHSA-pad-gone'] }
const batches: number[] = []
const osv = Bun.serve({
  port: 0,
  async fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/v1/querybatch') {
      const { queries } = (await request.json()) as { queries: { package: { name: string; ecosystem: string }; version: string }[] }
      batches.push(queries.length)
      if (queries.length > 1000) return Response.json({ code: 3, message: 'too many queries' }, { status: 400 })
      return Response.json({ results: queries.map(q => (AFFECTED[`${q.package.name}@${q.version}`] ? { vulns: AFFECTED[`${q.package.name}@${q.version}`]!.map(id => ({ id, modified: '2025-01-01T00:00:00Z' })) } : {})) })
    }
    const id = decodeURIComponent(pathname.replace('/v1/vulns/', ''))
    return VULNS[id] ? Response.json(VULNS[id]) : Response.json({ code: 5, message: 'Bug not found.' }, { status: 404 })
  },
})
process.env.STANDARDS_OSV_URL = osv.url.origin
const dirs: string[] = []
afterAll(async () => {
  osv.stop(true)
  delete process.env.STANDARDS_OSV_URL
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })))
})
const check = async (files: Record<string, string>) => {
  const dir = await gitRepo(files)
  dirs.push(dir)
  return dependencyVulns(contextOf({ path: dir }))
}
const lockOf = (packages: Record<string, string>) =>
  JSON.stringify({ lockfileVersion: 3, packages: { '': { name: 'app' }, ...Object.fromEntries(Object.entries(packages).map(([name, version]) => [`node_modules/${name}`, { version }])) } })

test('a high advisory fails, with its fixed version; the alias is not counted twice; moderate is only counted', async () => {
  const outcome = await check({ 'package.json': '{}', 'package-lock.json': lockOf({ next: '15.1.0', lodash: '4.17.20', 'left-pad': '1.3.0', react: '19.0.0' }) })
  expect(outcome).toEqual({
    state: 'fail',
    evidence: '1 critical or high advisories on 1 of 4 package versions in package-lock.json: next@15.1.0 → GHSA-next-high high, fixed in 15.2.3; also 1 medium',
  })
})

test('several advisories on one package are one line, with the version that fixes them all', () => {
  const pkg = { name: 'next', version: '16.2.6' }
  const f = (id: string, severity: 'critical' | 'high', fixed?: string) => ({ pkg, id, severity, fixed })
  expect(byPackage([f('GHSA-a', 'critical', '16.3.3'), f('GHSA-b', 'critical', '16.4.1'), f('GHSA-c', 'high', '16.2.9'), f('GHSA-d', 'high')])).toEqual([
    'next@16.2.6 → GHSA-a critical, GHSA-b critical, GHSA-c high, and 1 more; 16.4.1 fixes all but 1',
  ])
})

test('no advisories pass; batches stay within OSV’s 1000 queries', async () => {
  batches.length = 0
  const many = Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [`pkg-${i}`, '1.0.0']))
  const outcome = await check({ 'package.json': '{}', 'package-lock.json': lockOf(many) })
  expect(outcome).toEqual({ state: 'pass', evidence: 'no critical or high advisories in 1500 package versions in package-lock.json (OSV)' })
  expect(batches).toEqual([1000, 500])
})

test('no lockfile fails when there is a package.json, passes without one; OSV down is an error', async () => {
  expect((await check({ 'package.json': '{}' })).state).toBe('fail')
  expect((await check({ 'README.md': '# hi' })).state).toBe('pass')
  process.env.STANDARDS_OSV_URL = 'http://127.0.0.1:1'
  const down = await check({ 'package.json': '{}', 'package-lock.json': lockOf({ react: '19.0.1' }) })
  expect(down.state).toBe('error')
  expect(down.evidence).toEndWith('nothing was audited')
  process.env.STANDARDS_OSV_URL = osv.url.origin
})
