import { existsSync } from 'node:fs'
import { appendFile, mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { run } from './checks/github.ts'
import { checkRefs, ConfigError, expandHome, parseWith, type Workspace } from './load.ts'
import { ghBin, RunError } from './runs.ts'
import { Business, Worker } from './schema.ts'

const PRESETS = Worker.array().parse([
  {
    id: 'sonnet-fixer',
    runtime: 'claude-code',
    model: 'sonnet',
    effort: 'medium',
    allow: ['Bash(git *)', 'Bash(gh pr *)', 'Bash(gh repo edit *)', 'Bash(bun *)', 'Bash(npm *)'],
  },
  {
    id: 'opus-fixer',
    runtime: 'claude-code',
    model: 'opus',
    effort: 'high',
    allow: ['Bash(git *)', 'Bash(gh pr *)', 'Bash(gh repo edit *)', 'Bash(bun *)', 'Bash(npm *)'],
  },
  { id: 'opus-reviewer', runtime: 'claude-code', model: 'opus', effort: 'high', permission_mode: 'plan' },
])

const yaml = (value: unknown) => Bun.YAML.stringify(value, null, 2)

function fromJson(text: string | undefined, what: string) {
  if (!text) throw new ConfigError(`usage: --json '<${what}>'`)
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new ConfigError(`--json: ${(error as Error).message}`)
  }
}

const writeWorkers = (ws: Workspace, workers: Worker[]) => Bun.write(join(ws.dir, 'workers.yml'), yaml(workers))

/** The loader also reads `.yaml`; an existing one keeps its name, so a business never ends up in two files. */
function businessFile(ws: Workspace, id: string) {
  const yamlFile = join(ws.dir, 'businesses', `${id}.yaml`)
  return existsSync(yamlFile) ? yamlFile : join(ws.dir, 'businesses', `${id}.yml`)
}

const writeBusiness = (ws: Workspace, business: Business) => Bun.write(businessFile(ws, business.id), yaml(business))

function findWorker(ws: Workspace, id: string) {
  const worker = ws.workers.find(w => w.id === id)
  if (!worker) throw new ConfigError(`no worker ${id} in workers.yml`)
  return worker
}

function findBusiness(ws: Workspace, id: string) {
  const business = ws.businesses.find(b => b.id === id)
  if (!business) throw new ConfigError(`no business ${id} in ${ws.dir}/businesses`)
  return business
}

/** Adds the worker, or replaces the one with its id. */
export async function setWorker(ws: Workspace, json: string | undefined) {
  const worker = parseWith(Worker, fromJson(json, 'Worker'), 'worker')
  const at = ws.workers.findIndex(w => w.id === worker.id)
  await writeWorkers(ws, at < 0 ? [...ws.workers, worker] : ws.workers.with(at, worker))
  return worker
}

export async function removeWorker(ws: Workspace, id: string) {
  findWorker(ws, id)
  const user = ws.businesses.find(b => b.worker === id)
  if (user) throw new ConfigError(`${user.id} uses worker ${id} as its default`)
  await writeWorkers(ws, ws.workers.filter(w => w.id !== id))
}

/** Appends a permission rule to the worker's `allow`, once. */
export async function allowWorker(ws: Workspace, id: string, rule: string) {
  const worker = findWorker(ws, id)
  if (!rule.trim()) throw new ConfigError('usage: standards worker allow <id> <rule>')
  if (!worker.allow.includes(rule)) worker.allow.push(rule)
  await writeWorkers(ws, ws.workers)
  return worker
}

export async function setBusiness(ws: Workspace, json: string | undefined) {
  const business = parseWith(Business, fromJson(json, 'Business'), 'business')
  checkRefs(business, ws.packs, ws.workers)
  await mkdir(join(ws.dir, 'businesses'), { recursive: true })
  await writeBusiness(ws, business)
  return business
}

export async function removeBusiness(ws: Workspace, id: string) {
  findBusiness(ws, id)
  await unlink(businessFile(ws, id))
}

/** Run state, and the secrets checks use (a preview's protection bypass): neither belongs in git. */
const IGNORED = ['.state/', 'secrets.yml']

/** Makes `dir` a workspace, keeping whatever is already there. */
export async function initWorkspace(dir: string) {
  const root = resolve(expandHome(dir))
  await mkdir(join(root, 'businesses'), { recursive: true })
  const workers = Bun.file(join(root, 'workers.yml'))
  if (!(await workers.exists())) await Bun.write(workers, yaml(PRESETS))
  const gitignore = join(root, '.gitignore')
  const ignored = existsSync(gitignore) ? await Bun.file(gitignore).text() : ''
  const missing = IGNORED.filter(entry => !ignored.split('\n').some(line => line.trim() === entry))
  if (missing.length > 0) {
    await appendFile(gitignore, `${ignored && !ignored.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`)
  }
  return root
}

/** `owner/name` of a GitHub remote URL, lower-cased: GitHub ignores case. */
const repoOf = (url: string) => url.trim().match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i)?.[1]?.toLowerCase()

const tilde = (path: string) => (path.startsWith(homedir() + sep) ? `~${path.slice(homedir().length)}` : path)

/** Clones the asset's repo, or reuses a checkout of it already there, and sets the asset's `path`. */
export async function clone(ws: Workspace, businessId: string, assetId: string, into?: string) {
  const business = findBusiness(ws, businessId)
  const asset = business.assets.find(a => a.id === assetId)
  if (!asset) throw new ConfigError(`${businessId} has no asset ${assetId}`)
  if (!asset.repo) throw new ConfigError(`${businessId}/${assetId} has no repo`)
  if (asset.path) throw new ConfigError(`${businessId}/${assetId} already has a path: ${asset.path}`)

  const [owner, name] = asset.repo.split('/') as [string, string]
  // ~/Projects keeps owners lower-case, like the workspace's existing paths.
  const dir = resolve(expandHome(into ?? join('~/Projects', owner.toLowerCase(), name)))
  if (existsSync(join(dir, '.git'))) {
    const origin = await run(['git', 'remote', 'get-url', 'origin'], dir)
    if (repoOf(origin.stdout) !== asset.repo.toLowerCase()) throw new ConfigError(`${dir} is a checkout of something other than ${asset.repo}`)
  } else {
    const cloned = await run([ghBin(), 'repo', 'clone', asset.repo, dir])
    if (!cloned.ok) throw new RunError(`gh repo clone ${asset.repo} ${dir}: ${cloned.stderr}`)
  }

  asset.path = tilde(dir)
  await writeBusiness(ws, business)
  return asset.path
}
