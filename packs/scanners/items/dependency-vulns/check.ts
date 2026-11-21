import { join } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { checkout, isOutcome } from '../../../ai-ready/checkout.ts'
import { exec, listed } from '../../shared.ts'
import { LOCKFILES, type Locked, parseLockfile } from './lockfiles.ts'

/** OSV's own limit on queries in one `querybatch` request. */
const BATCH = 1000
/** Pages of one batch to follow when OSV splits a large answer (`next_page_token`). */
const MAX_PAGES = 10
const SHOWN = 8
const FAILING = new Set<Severity>(['critical', 'high'])
const osv = () => (process.env.STANDARDS_OSV_URL ?? 'https://api.osv.dev').replace(/\/$/, '')

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown'
const ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'unknown']

/** The parts of an OSV record this check reads (https://ossf.github.io/osv-schema/). */
export interface Vuln {
  id: string
  aliases?: string[]
  withdrawn?: string
  summary?: string
  severity?: { type: string; score: string }[]
  database_specific?: { severity?: string }
  affected?: {
    package?: { ecosystem?: string; name?: string }
    ranges?: { type: string; events: Record<string, string>[] }[]
    ecosystem_specific?: { severity?: string }
    database_specific?: { severity?: string }
  }[]
}

const WEIGHTS: Record<string, Record<string, number>> = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  C: { H: 0.56, L: 0.22, N: 0 },
  I: { H: 0.56, L: 0.22, N: 0 },
  A: { H: 0.56, L: 0.22, N: 0 },
}

/** CVSS v3.x round-up to one decimal, as the 3.1 specification defines it. */
const roundUp = (value: number) => {
  const int = Math.round(value * 100_000)
  return int % 10_000 === 0 ? int / 100_000 : (Math.floor(int / 10_000) + 1) / 10
}

/** The base score of a CVSS v3.0/3.1 vector (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` → 9.8); undefined for anything else. */
export function cvss3(vector: string) {
  if (!/^CVSS:3\.[01]\//.test(vector)) return undefined
  const m = Object.fromEntries(vector.split('/').slice(1).map(part => part.split(':') as [string, string]))
  const changed = m.S === 'C'
  const pr = { N: 0.85, L: changed ? 0.68 : 0.62, H: changed ? 0.5 : 0.27 }[m.PR as string]
  const [av, ac, ui, c, i, a] = (['AV', 'AC', 'UI', 'C', 'I', 'A'] as const).map(key => WEIGHTS[key]![m[key] as string])
  if ([av, ac, ui, c, i, a, pr].some(weight => weight === undefined) || !['U', 'C'].includes(m.S as string)) return undefined
  const iss = 1 - (1 - c!) * (1 - i!) * (1 - a!)
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss
  const exploitability = 8.22 * av! * ac! * pr! * ui!
  if (impact <= 0) return 0
  return roundUp(Math.min(changed ? 1.08 * (impact + exploitability) : impact + exploitability, 10))
}

const fromScore = (score: number): Severity => (score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : score > 0 ? 'low' : 'unknown')
const fromLabel = (label?: string): Severity | undefined => {
  const value = label?.toLowerCase()
  if (value === 'critical' || value === 'high' || value === 'low') return value
  if (value === 'moderate' || value === 'medium') return 'medium'
}

/** The record's severity: GitHub's label (`database_specific.severity`), else the CVSS v3 vector's score; a malicious package is critical. */
export function severityOf(vuln: Vuln): Severity {
  if (vuln.id.startsWith('MAL-')) return 'critical'
  const label = fromLabel(vuln.database_specific?.severity) ?? vuln.affected?.map(a => fromLabel(a.database_specific?.severity ?? a.ecosystem_specific?.severity)).find(Boolean)
  if (label) return label
  const scores = (vuln.severity ?? []).map(s => cvss3(s.score)).filter((score): score is number => score !== undefined)
  return scores.length ? fromScore(Math.max(...scores)) : 'unknown'
}

/** The lowest version above `version` that fixes the record for this package, if one is known. */
export function fixedIn(vuln: Vuln, name: string, version: string) {
  const fixes = (vuln.affected ?? [])
    .filter(a => a.package?.ecosystem === 'npm' && a.package.name === name)
    .flatMap(a => a.ranges ?? [])
    // GIT ranges name commits, not versions
    .filter(range => range.type !== 'GIT')
    .flatMap(range => range.events.map(event => event.fixed).filter((fixed): fixed is string => !!fixed && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(fixed)))
    .filter(fixed => Bun.semver.order(fixed, version) > 0)
    .sort(Bun.semver.order)
  return fixes[0]
}

/** The vulnerability ids OSV knows for each package version, in order: one `querybatch` per 1000 packages. */
export async function queryBatch(packages: Locked[]): Promise<string[][]> {
  const ids: string[][] = []
  for (let start = 0; start < packages.length; start += BATCH) {
    const chunk = packages.slice(start, start + BATCH)
    const found: string[][] = chunk.map(() => [])
    let pending = chunk.map((pkg, i) => ({ i, query: { package: { name: pkg.name, ecosystem: 'npm' }, version: pkg.version } as Record<string, unknown> }))
    for (let page = 0; pending.length && page < MAX_PAGES; page++) {
      const response = await get(`${osv()}/v1/querybatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queries: pending.map(p => p.query) }),
      })
      if (!response.ok) throw new Error(`OSV querybatch answered ${response.status}: ${(await response.text()).slice(0, 120)}`)
      const { results = [] } = (await response.json()) as { results?: { vulns?: { id: string }[]; next_page_token?: string }[] }
      if (results.length !== pending.length) throw new Error(`OSV answered ${results.length} results for ${pending.length} queries`)
      pending = pending.flatMap((p, j) => {
        const result = results[j]!
        found[p.i]!.push(...(result.vulns ?? []).map(v => v.id))
        return result.next_page_token ? [{ i: p.i, query: { ...p.query, page_token: result.next_page_token } }] : []
      })
    }
    ids.push(...found)
  }
  return ids
}

const records = new Map<string, Promise<Vuln>>()

/** The full record (`GET /v1/vulns/{id}`), once per process. */
export function vulnRecord(id: string) {
  let record = records.get(id)
  if (!record) {
    record = get(`${osv()}/v1/vulns/${encodeURIComponent(id)}`).then(async response => {
      if (!response.ok) throw new Error(`OSV answered ${response.status} for ${id}`)
      return (await response.json()) as Vuln
    })
    record.catch(() => records.delete(id))
    records.set(id, record)
  }
  return record
}

export interface Finding {
  pkg: Locked
  id: string
  severity: Severity
  fixed?: string
}

/** Every advisory on the packages, one per advisory and package version (an alias OSV also returned is dropped). */
export async function findings(packages: Locked[]): Promise<Finding[]> {
  const ids = await queryBatch(packages)
  const out: Finding[] = []
  await Promise.all(
    packages.map(async (pkg, i) => {
      const vulns = (await Promise.all((ids[i] ?? []).map(vulnRecord))).filter(vuln => !vuln.withdrawn)
      const seen = new Set<string>()
      for (const vuln of vulns.sort((a, b) => Number(b.id.startsWith('GHSA-')) - Number(a.id.startsWith('GHSA-')))) {
        if (seen.has(vuln.id)) continue
        for (const alias of [vuln.id, ...(vuln.aliases ?? [])]) seen.add(alias)
        out.push({ pkg, id: vuln.id, severity: severityOf(vuln), fixed: fixedIn(vuln, pkg.name, pkg.version) })
      }
    }),
  )
  return out.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || a.pkg.name.localeCompare(b.pkg.name))
}

/** `next@15.1.0 (dev) → GHSA-xxxx-xxxx-xxxx critical, fixed in 15.1.7` */
export const describe = (f: Finding) =>
  `${f.pkg.name}@${f.pkg.version}${f.pkg.dev ? ' (dev)' : ''} → ${f.id} ${f.severity}, ${f.fixed ? `fixed in ${f.fixed}` : 'no fixed version yet'}`

const IDS_SHOWN = 3

/**
 * One line per package version, worst first: its advisories and the version that fixes them all.
 * `next@16.2.6 → GHSA-a critical, GHSA-b high, and 4 more; 16.4.1 fixes all`
 */
export function byPackage(found: Finding[]) {
  const groups = new Map<string, Finding[]>()
  for (const f of found) groups.set(`${f.pkg.name}@${f.pkg.version}`, [...(groups.get(`${f.pkg.name}@${f.pkg.version}`) ?? []), f])
  return [...groups.values()].map(list => {
    const [first] = list as [Finding]
    if (list.length === 1) return describe(first)
    const ids = list.slice(0, IDS_SHOWN).map(f => `${f.id} ${f.severity}`).join(', ') + (list.length > IDS_SHOWN ? `, and ${list.length - IDS_SHOWN} more` : '')
    const fixes = list.map(f => f.fixed).filter((v): v is string => !!v).sort(Bun.semver.order)
    const unfixed = list.filter(f => !f.fixed).length
    const fix = fixes.length ? `${fixes.at(-1)} fixes ${unfixed ? `all but ${unfixed}` : 'all'}` : 'no fixed version yet'
    return `${first.pkg.name}@${first.pkg.version}${first.pkg.dev ? ' (dev)' : ''} → ${ids}; ${fix}`
  })
}

const NESTED_SKIP = /(^|\/)(node_modules|fixtures?|__fixtures__|test|tests|examples?|vendor)\//

/** No known critical or high vulnerability in the dependency versions the lockfile pins (OSV, npm). */
export default async function dependencyVulns(ctx: Context): Promise<Outcome> {
  const co = await checkout(ctx)
  if (isOutcome(co)) return co
  const tracked = new Set(co.files)
  // The root's lockfile, as the package manager picks it; else every app's own lockfile in a repo without one at the root.
  const root = LOCKFILES.find(name => tracked.has(name))
  const lockfiles = root ? [root] : co.files.filter(path => LOCKFILES.some(name => path.endsWith(`/${name}`)) && !NESTED_SKIP.test(path))
  if (lockfiles.length === 0) {
    if (!tracked.has('package.json')) return { state: 'pass', evidence: `${co.where} has no package.json: no npm dependencies` }
    return { state: 'fail', evidence: `${co.where} has a package.json but no lockfile is committed, so the installed versions can't be known (or audited)` }
  }

  const packages = new Map<string, Locked>()
  for (const file of lockfiles) {
    let text: string | undefined
    if (file.endsWith('.lockb')) {
      if (!co.local) return { state: 'error', evidence: `${file} is binary and needs a local checkout to read: give the asset a path` }
      const printed = await exec(['bun', join(co.where, file)], { cwd: co.where, timeoutMs: 60_000 })
      if (printed.code !== 0) return { state: 'error', evidence: `bun couldn't print ${file}: ${printed.stderr.trim().split('\n').at(-1)}` }
      text = printed.stdout
    } else {
      // a large app's lockfile runs past the checkout reader's 1 MB cap
      const whole = co.local ? Bun.file(join(co.where, file)) : undefined
      text = whole && (await whole.exists()) ? await whole.text() : await co.read(file)
    }
    if (text === undefined) return { state: 'error', evidence: `${file} could not be read from ${co.where}` }
    try {
      for (const pkg of parseLockfile(file.endsWith('.lockb') ? 'yarn.lock' : file, text)) packages.set(`${pkg.name}@${pkg.version}`, pkg)
    } catch (error) {
      return { state: 'error', evidence: `${file} could not be parsed: ${(error as Error).message}` }
    }
  }
  if (packages.size === 0) return { state: 'error', evidence: `${lockfiles.join(', ')} pins no registry packages that could be read` }

  let found: Finding[]
  try {
    found = await findings([...packages.values()])
  } catch (error) {
    return { state: 'error', evidence: `OSV could not be asked (${(error as Error).message}); nothing was audited` }
  }
  const source = `${packages.size} package versions in ${listed(lockfiles, 3, ', ')}`
  const failing = found.filter(f => FAILING.has(f.severity))
  const others = ORDER.filter(s => !FAILING.has(s))
    .map(s => [s, found.filter(f => f.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
  const rest = others.length ? `; also ${others.join(', ')}` : ''
  if (failing.length) {
    const lines = byPackage(failing)
    return { state: 'fail', evidence: `${failing.length} critical or high advisories on ${lines.length} of ${source}: ${listed(lines, SHOWN)}${rest}` }
  }
  return { state: 'pass', evidence: `no critical or high advisories in ${source} (OSV)${rest}` }
}
