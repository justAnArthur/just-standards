import { join } from 'node:path'
import { cellsOf, checkBusiness } from './cells.ts'
import { run } from './checks/github.ts'
import type { Workspace } from './load.ts'
import { ghBin } from './runs.ts'
import type { Result } from './schema.ts'

/** A PR label naming a standard it touches: `std:website/og-video`. */
export const LABEL_PREFIX = 'std:'
export const labelOf = (key: string) => `${LABEL_PREFIX}${key}`

const LABEL_COLOR = 'c5def5'
/** A merged PR with no production deployment reported this long is checked anyway: not every host reports one. */
const UNREPORTED_AFTER_MS = 15 * 60_000
/** A merge whose deployment didn't succeed by then is checked anyway: the check then shows what is live. */
const GIVE_UP_AFTER_MS = 2 * 60 * 60_000
/** A first sync looks back this far. */
const FIRST_LOOK_BACK_MS = 24 * 60 * 60_000

async function gh<T>(args: string[], cwd?: string): Promise<T | undefined> {
  const answered = await run([ghBin(), ...args], cwd)
  if (!answered.ok) return undefined
  try {
    return JSON.parse(answered.stdout) as T
  } catch {
    return undefined
  }
}

/** Puts a `std:` label for each item on the PR, creating the labels in the repo first. Best effort: a run doesn't fail over a label. */
export async function labelPr(url: string, ws: Workspace, items: string[], cwd: string) {
  const labels = items.map(labelOf)
  for (const key of items) {
    const title = ws.packs.get(key.split('/')[0]!)?.entries.find(item => item.key === key)?.title ?? key
    await run([ghBin(), 'label', 'create', labelOf(key), '--color', LABEL_COLOR, '--description', `just-standards: ${title}`.slice(0, 100), '--force'], cwd)
  }
  const edited = await run([ghBin(), 'pr', 'edit', url, '--add-label', labels.join(',')], cwd)
  if (!edited.ok) console.error(`couldn't label ${url}: ${edited.stderr}`)
}

interface MergedPr {
  number: number
  url: string
  mergedAt: string
  mergeCommit?: { oid: string }
  labels: { name: string }[]
}

interface Deployment {
  id: number
  environment: string
  production_environment?: boolean
}

/** Whether the merge commit is live: a production deployment of it succeeded, or none was reported for a while. */
export async function isDeployed(repo: string, sha: string, mergedAt: string, now = Date.now()) {
  const deployments = (await gh<Deployment[]>(['api', `repos/${repo}/deployments?sha=${sha}`])) ?? []
  const production = deployments.filter(d => d.production_environment || /production|github-pages/i.test(d.environment))
  for (const deployment of production) {
    const statuses = (await gh<{ state: string }[]>(['api', `repos/${repo}/deployments/${deployment.id}/statuses`])) ?? []
    if (statuses.some(status => status.state === 'success')) return true
  }
  const age = now - Date.parse(mergedAt)
  return (production.length === 0 && age > UNREPORTED_AFTER_MS) || age > GIVE_UP_AFTER_MS
}

/** Per repo: merged PRs up to this time are handled, except `pending` ones still waiting on their deployment. */
type Cursors = Record<string, { since: string; pending: number[] }>

const cursorsFile = (ws: Workspace) => join(ws.dir, '.state', 'labels.json')

export interface Recheck {
  type: 'recheck'
  repo: string
  pr: number
  url: string
  items: string[]
  /** `business/asset` */
  cells: { business: string; asset: string; item: string }[]
}

/**
 * Finds PRs merged since the last sync that carry `std:` labels, and once each is deployed, checks those items again on
 * every asset of that repo, in every business. Nothing else is checked.
 */
export async function recheckLabeled(ws: Workspace, onResult: (result: Result) => void = () => {}, now = Date.now()) {
  const file = Bun.file(cursorsFile(ws))
  const cursors: Cursors = (await file.exists()) ? await file.json() : {}
  const repos = [...new Set(ws.businesses.flatMap(b => b.assets.flatMap(a => (a.repo ? [a.repo.toLowerCase()] : []))))]
  const done: Recheck[] = []

  for (const repo of repos) {
    const cursor = cursors[repo] ?? { since: new Date(now - FIRST_LOOK_BACK_MS).toISOString(), pending: [] }
    const merged = await gh<MergedPr[]>(['pr', 'list', '--repo', repo, '--state', 'merged', '--limit', '30', '--json', 'number,url,mergedAt,mergeCommit,labels'])
    if (!merged) continue
    const labeled = merged
      .filter(pr => pr.labels.some(label => label.name.startsWith(LABEL_PREFIX)))
      .filter(pr => pr.mergedAt > cursor.since || cursor.pending.includes(pr.number))
      .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))

    const pending: number[] = []
    for (const pr of labeled) {
      if (!pr.mergeCommit || !(await isDeployed(repo, pr.mergeCommit.oid, pr.mergedAt, now))) {
        pending.push(pr.number)
        continue
      }
      const items = pr.labels.flatMap(label => (label.name.startsWith(LABEL_PREFIX) ? [label.name.slice(LABEL_PREFIX.length)] : []))
      const recheck: Recheck = { type: 'recheck', repo, pr: pr.number, url: pr.url, items, cells: [] }
      for (const business of ws.businesses) {
        const cells = cellsOf(business, ws).filter(cell => cell.asset.repo?.toLowerCase() === repo && items.includes(cell.item.key))
        if (cells.length === 0) continue
        await checkBusiness(ws, business, cells, onResult)
        recheck.cells.push(...cells.map(cell => ({ business: business.id, asset: cell.asset.id, item: cell.item.key })))
      }
      done.push(recheck)
    }
    const newest = merged.reduce((latest, pr) => (pr.mergedAt > latest ? pr.mergedAt : latest), cursor.since)
    cursors[repo] = { since: newest, pending }
  }
  await Bun.write(cursorsFile(ws), `${JSON.stringify(cursors, null, 2)}\n`)
  return done
}
