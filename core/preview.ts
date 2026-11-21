import { join } from 'node:path'
import { cellsOf, checkCell } from './cells.ts'
import { run } from './checks/github.ts'
import { authorize } from './expect.ts'
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

/** Checks the run's items on the preview deployment of its PR's head commit `sha`. */
export async function checkPreview(ws: Workspace, record: RunRecord, sha: string): Promise<Preview> {
  const checked_at = new Date().toISOString()
  const business = ws.businesses.find(b => b.id === record.business)
  const asset = business?.assets.find(a => a.id === record.asset)
  if (!business || !asset?.repo) return { sha, checked_at, results: [], note: `${record.business}/${record.asset} is gone, or has no repo` }

  const url = await previewUrl(asset.repo, sha)
  if (!url) return { sha, checked_at, results: [], note: `no preview deployment of ${sha.slice(0, 7)} yet` }
  const headers: Record<string, string> = asset.vercel_bypass ? { [BYPASS_HEADER]: await secretOf(ws.dir, asset.vercel_bypass) } : {}
  if (await isProtected(url, headers)) {
    const note = asset.vercel_bypass
      ? `${url} still asks to sign in: check the ${asset.vercel_bypass} secret`
      : `${url} is protected: set vercel_bypass on ${asset.id} to a secret holding the project's Protection Bypass for Automation`
    return { sha, checked_at, url, results: [], note }
  }
  if (asset.vercel_bypass) authorize(url, headers)

  const cells = cellsOf(business, ws).filter(cell => cell.asset.id === asset.id && record.items.includes(cell.item.key))
  const results = await Promise.all(cells.map(cell => checkCell(business, { asset: { ...asset, url }, item: cell.item }, ws.dir)))
  return { sha, checked_at, url, results }
}
