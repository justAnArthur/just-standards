import { dirname, join } from 'node:path'
import type { Context } from '../../core/checks/context.ts'
import { remoteFile, run } from '../../core/checks/github.ts'
import { expandHome } from '../../core/load.ts'
import type { Outcome } from '../../core/schema.ts'

/** The asset's tracked files: its local checkout, else its default branch on GitHub (no grep there: too many requests). */
export interface Checkout {
  where: string
  local: boolean
  files: string[]
  read: (path: string) => Promise<string | undefined>
}

const MAX_BYTES = 1_000_000
const SHOWN = 5

export async function checkout({ asset }: Context): Promise<Checkout | Outcome> {
  if (asset.path) {
    const root = expandHome(asset.path)
    const listed = await run(['git', 'ls-files'], root)
    if (!listed.ok) return { state: 'error', evidence: `${root} is not a git checkout` }
    return {
      where: root,
      local: true,
      files: listed.stdout.split('\n').filter(Boolean),
      read: async path => {
        const file = Bun.file(join(root, path))
        return (await file.exists()) && file.size <= MAX_BYTES ? file.text() : undefined
      },
    }
  }
  if (!asset.repo) return { state: 'error', evidence: `asset ${asset.id} has neither a path nor a repo` }
  const repo = asset.repo
  const tree = await run(['gh', 'api', `repos/${repo}/git/trees/HEAD?recursive=1`, '--jq', '.tree[] | select(.type == "blob") | .path'])
  if (!tree.ok) return { state: 'error', evidence: `can't list github.com/${repo}: ${tree.stderr}` }
  return { where: `github.com/${repo}`, local: false, files: tree.stdout.split('\n').filter(Boolean), read: path => remoteFile(repo, path) }
}

export const isOutcome = (value: Checkout | Outcome): value is Outcome => 'state' in value

export interface NextApp {
  /** '' for the repo root, else the folder: `apps/web` */
  root: string
  /** the `next` version range in its package.json, when it names one */
  next?: string
  /** tracked files under `app/` or `src/app/` */
  appFiles: string[]
  /** tracked files under the app's root */
  files: string[]
}

const under = (root: string, path: string) => root === '' || path.startsWith(`${root}/`)
const CONFIG = /(^|\/)next\.config\.(js|mjs|cjs|ts|mts)$/

/** Every Next.js app in the repo: a package.json that depends on `next`, or a folder with a `next.config.*`. */
export async function nextApps(co: Checkout): Promise<NextApp[]> {
  const roots = new Map<string, string | undefined>()
  for (const path of co.files.filter(path => /(^|\/)package\.json$/.test(path))) {
    const text = await co.read(path)
    let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    try {
      manifest = JSON.parse(text ?? '{}')
    } catch {
      continue
    }
    const next = manifest.dependencies?.next ?? manifest.devDependencies?.next
    if (next) roots.set(dirname(path) === '.' ? '' : dirname(path), next)
  }
  for (const path of co.files.filter(path => CONFIG.test(path))) {
    const root = dirname(path) === '.' ? '' : dirname(path)
    if (!roots.has(root)) roots.set(root, undefined)
  }
  const nested = (root: string, path: string) => [...roots.keys()].some(other => other !== root && under(root, other) && under(other, path))
  return [...roots].map(([root, next]) => {
    // a monorepo's root app doesn't own the files of the apps inside it
    const files = co.files.filter(path => under(root, path) && !nested(root, path))
    const prefix = root ? `${root}/` : ''
    return {
      root,
      next,
      appFiles: files.filter(path => path.startsWith(`${prefix}app/`) || path.startsWith(`${prefix}src/app/`)),
      files,
    }
  })
}

const RELATIVE_IMPORT = /(?:from\s+|require\(\s*|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g

/** The app's Next config as text: `next.config.*`, its siblings (`next.config.shared.js`) and the local files they import. */
export async function configText(app: NextApp, co: Checkout) {
  const prefix = app.root ? `${app.root}/` : ''
  const queue = app.files.filter(path => path.startsWith(prefix) && /^next\.config[\w.-]*\.(js|mjs|cjs|ts|mts)$/.test(path.slice(prefix.length)))
  const seen = new Set<string>()
  const texts: string[] = []
  while (queue.length > 0) {
    const path = queue.shift() as string
    if (seen.has(path)) continue
    seen.add(path)
    const text = (await co.read(path)) ?? ''
    texts.push(text)
    for (const [, target] of text.matchAll(RELATIVE_IMPORT)) {
      const base = join(dirname(path), target as string)
      const found = co.files.find(file => file === base || (file.startsWith(base) && /^\.(js|mjs|cjs|ts|mts)$/.test(file.slice(base.length))))
      if (found) queue.push(found)
    }
  }
  return texts.join('\n')
}

export const notNext = (co: Checkout): Outcome => ({
  state: 'error',
  evidence: `not a Next.js repo: no package.json in ${co.where} depends on next, and there is no next.config.*`,
})

/** Lines that are only a comment: `//`, `/*`, ` *`, `{/*` or `<!--` first. */
const COMMENT = /^\s*(\/\/|\/\*|\*|\{\s*\/\*|<!--)/

/** The 1-based lines of `text` matching `pattern`, outside comment lines, unless `allowed` matches that line or one of the two before it. */
export function lines(text: string, pattern: RegExp, allowed?: RegExp) {
  const all = text.split('\n')
  return all.flatMap((line, index) => {
    if (COMMENT.test(line) || !pattern.test(line)) return []
    if (allowed && all.slice(Math.max(0, index - 2), index + 1).some(near => allowed.test(near))) return []
    return [index + 1]
  })
}

/** `path:line` hits of `pattern` in `files`, read from the checkout. */
export async function grep(co: Checkout, files: string[], pattern: RegExp, allowed?: RegExp) {
  const hits: string[] = []
  for (const path of files) {
    const text = await co.read(path)
    if (text) for (const line of lines(text, pattern, allowed)) hits.push(`${path}:${line}`)
  }
  return hits
}

export const listed = (hits: string[]) => `${hits.slice(0, SHOWN).join(', ')}${hits.length > SHOWN ? ` and ${hits.length - SHOWN} more` : ''}`

export const needsLocal = (co: Checkout): Outcome => ({
  state: 'error',
  evidence: `this check reads every source file and needs a local checkout: give the asset a path (${co.where} has none)`,
})

/** The source files of an app a check reads: no tests, stories or declaration files. */
export const source = (files: string[], extensions = /\.(tsx|jsx|js)$/) =>
  files.filter(path => extensions.test(path) && !/(\.(test|spec|stories)\.|\.d\.ts$|(^|\/)(__tests__|tests?|e2e|public)\/)/.test(path))

/** What one app's check found: a failure, or what passed. */
export type Finding = { fail: string } | { pass: string }

/** Runs `each` on every Next app of the checkout, and folds what it found into one outcome. */
export async function perApp(ctx: Context, each: (app: NextApp, co: Checkout) => Promise<Finding>, { remote = false } = {}): Promise<Outcome> {
  const co = await checkout(ctx)
  if (isOutcome(co)) return co
  if (!(co.local || remote)) return needsLocal(co)
  const apps = await nextApps(co)
  if (apps.length === 0) return notNext(co)
  const named = (app: NextApp, text: string) => (apps.length > 1 ? `${app.root || '(root)'}: ${text}` : text)
  const findings = await Promise.all(apps.map(async app => ({ app, found: await each(app, co) })))
  const failures = findings.flatMap(({ app, found }) => ('fail' in found ? [named(app, found.fail)] : []))
  if (failures.length > 0) return { state: 'fail', evidence: failures.join('; ') }
  return { state: 'pass', evidence: findings.map(({ app, found }) => named(app, 'pass' in found ? found.pass : '')).join('; ') }
}
