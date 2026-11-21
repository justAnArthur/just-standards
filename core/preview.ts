import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cellsOf, checkCell } from './cells.ts'
import { run } from './checks/github.ts'
import { alias, authorize } from './expect.ts'
import { ConfigError, type Workspace } from './load.ts'
import { ghBin } from './runs.ts'
import type { Preview, RunRecord } from './schema.ts'

const BYPASS_HEADER = 'x-vercel-protection-bypass'

/** A value from the workspace's `secrets.yml` (git-ignored), a flat map of name to value. */
export async function secretOf(wsDir: string, name: string) {
  const file = Bun.file(join(wsDir, 'secrets.yml'))
  const secrets = (await file.exists()) ? (Bun.YAML.parse(await file.text()) as Record<string, unknown> | null) : null
  const value = secrets?.[name]
  if (typeof value !== 'string' || !value) throw new ConfigError(`no secret ${name} in ${join(wsDir, 'secrets.yml')}`)
  return value
}

async function api<T>(path: string): Promise<T | undefined> {
  const answered = await run([ghBin(), 'api', path])
  if (!answered.ok) return undefined
  try {
    return JSON.parse(answered.stdout) as T
  } catch {
    return undefined
  }
}

/** The URL of the newest successful deployment of `sha`, from the GitHub deployments Vercel, Netlify and others report. */
export async function previewUrl(repo: string, sha: string) {
  const deployments = (await api<{ id: number }[]>(`repos/${repo}/deployments?sha=${sha}`)) ?? []
  for (const deployment of deployments) {
    const statuses = (await api<{ state: string; environment_url?: string }[]>(`repos/${repo}/deployments/${deployment.id}/statuses`)) ?? []
    const live = statuses.find(status => status.state === 'success' && status.environment_url)
    if (live) return live.environment_url
  }
  return undefined
}

/** A protected deployment answers 401, or redirects to Vercel's sign-in. */
async function isProtected(url: string, headers: Record<string, string>) {
  try {
    const response = await fetch(url, { redirect: 'manual', headers, signal: AbortSignal.timeout(20_000) })
    await response.body?.cancel()
    const location = response.headers.get('location') ?? ''
    return response.status === 401 || response.status === 403 || /vercel\.com\/(sso-api|login)/.test(location)
  } catch {
    return false
  }
}

/** Whether the repo reports any deployment at all: without, there is no preview to wait for. */
export async function hasDeployments(repo: string) {
  return ((await api<unknown[]>(`repos/${repo}/deployments?per_page=1`)) ?? []).length > 0
}

/**
 * Checks the run's items on its PR's head commit `sha`. A site's items are read from the preview deployment, which
 * stands in for production (see `alias`); a repo's items from the run's worktree, which holds the PR's branch. Items only
 * production can show are skipped.
 */
export async function checkPreview(ws: Workspace, record: RunRecord, sha: string): Promise<Preview> {
  const checked_at = new Date().toISOString()
  const business = ws.businesses.find(b => b.id === record.business)
  const asset = business?.assets.find(a => a.id === record.asset)
  if (!business || !asset?.repo) return { sha, checked_at, results: [], note: `${record.business}/${record.asset} is gone, or has no repo` }

  const all = cellsOf(business, ws).filter(cell => cell.asset.id === asset.id && record.items.includes(cell.item.key))
  const cells = all.filter(cell => cell.item.preview)
  const skipped = all.filter(cell => !cell.item.preview).map(cell => cell.item.key)
  const base = { sha, checked_at, ...(skipped.length ? { skipped } : {}) }
  if (cells.length === 0) return { ...base, results: [], note: 'only production can show these: they are checked after the merge' }
  const path = existsSync(record.worktree) ? record.worktree : asset.path
  const check = (url?: string) => Promise.all(cells.map(cell => checkCell(business, { asset: { ...asset, path, url }, item: cell.item }, ws.dir)))

  if (!asset.url) return { ...base, results: await check() }
  const url = await previewUrl(asset.repo, sha)
  if (!url) return { ...base, results: [], note: `no preview deployment of ${sha.slice(0, 7)} yet` }
  const headers: Record<string, string> = asset.vercel_bypass ? { [BYPASS_HEADER]: await secretOf(ws.dir, asset.vercel_bypass) } : {}
  if (await isProtected(url, headers)) {
    const note = asset.vercel_bypass
      ? `${url} still asks to sign in: check the ${asset.vercel_bypass} secret`
      : `${url} is protected: set vercel_bypass on ${asset.id} to a secret holding the project's Protection Bypass for Automation`
    return { ...base, url, results: [], note }
  }
  if (asset.vercel_bypass) authorize(url, headers)
  // The preview's links, canonicals and sitemap name production URLs: read them from the preview.
  const unalias = alias(asset.url, url)
  try {
    return { ...base, url, results: await check(new URL(new URL(asset.url).pathname, url).href) }
  } finally {
    unalias()
  }
}
