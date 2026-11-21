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

/** The app's Next config files: `next.config.*`, its siblings (`next.config.shared.js`) and the local files they import. */
export async function configFiles(app: NextApp, co: Checkout) {
  const prefix = app.root ? `${app.root}/` : ''
  const queue = app.files.filter(path => path.startsWith(prefix) && /^next\.config[\w.-]*\.(js|mjs|cjs|ts|mts)$/.test(path.slice(prefix.length)))
  const seen = new Set<string>()
  const files: { path: string; text: string }[] = []
  while (queue.length > 0) {
    const path = queue.shift() as string
    if (seen.has(path)) continue
    seen.add(path)
    const text = (await co.read(path)) ?? ''
    files.push({ path, text })
    for (const [, target] of text.matchAll(RELATIVE_IMPORT)) {
      const base = join(dirname(path), target as string)
      const found = co.files.find(file => file === base || (file.startsWith(base) && /^\.(js|mjs|cjs|ts|mts)$/.test(file.slice(base.length))))
      if (found) queue.push(found)
    }
  }
  return files
}

/** The app's Next config as one text (see configFiles). */
export const configText = async (app: NextApp, co: Checkout) => (await configFiles(app, co)).map(file => file.text).join('\n')

/** The 1-based lines of `text` matching `pattern`, comments left out (block comments too). */
export const codeLines = (text: string, pattern: RegExp) =>
  withoutComments(text)
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []))

/** The `next` range in package.json, or the pnpm catalog entry it points at (`catalog:`, `catalog:<name>`). */
export async function rangeOf(app: NextApp, co: Checkout) {
  const range = app.next
  if (!range?.startsWith('catalog:')) return range
  const workspace = Bun.YAML.parse((await co.read('pnpm-workspace.yaml')) ?? '{}') as {
    catalog?: Record<string, string>
    catalogs?: Record<string, Record<string, string>>
  } | null
  const name = range.slice('catalog:'.length)
  return (name && name !== 'default' ? workspace?.catalogs?.[name] : workspace?.catalog)?.next
}

/** The `next` version the app runs: the installed one in a local checkout, else the lowest its range allows. Undefined for `latest` and the like. */
export async function versionOf(app: NextApp, co: Checkout) {
  if (co.local) {
    const installed = Bun.file(join(co.where, app.root, 'node_modules/next/package.json'))
    if (await installed.exists()) {
      const { version } = (await installed.json()) as { version?: string }
      if (version) return version
    }
  }
  const found = (await rangeOf(app, co))?.match(/\d+(\.\d+){0,2}/)?.[0]
  if (!found) return undefined
  const parts = found.split('.')
  while (parts.length < 3) parts.push('0')
  return parts.join('.')
}

/** Whether `version` is `min` or later; an unknown version counts as the latest. */
export const atLeast = (version: string | undefined, min: string) => version === undefined || Bun.semver.order(version, min) >= 0

/** The app's package.json scripts. */
export async function scriptsOf(app: NextApp, co: Checkout): Promise<Record<string, string>> {
  try {
    return (JSON.parse((await co.read(app.root ? `${app.root}/package.json` : 'package.json')) ?? '{}') as { scripts?: Record<string, string> }).scripts ?? {}
  } catch {
    return {}
  }
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

/** The 1-based line of `index` in `text`. */
export const lineAt = (text: string, index: number) => text.slice(0, index).split('\n').length

/** The end of the quoted string opening at `index`, on the same line; -1 when it doesn't close there (an apostrophe in JSX text). */
function stringEnd(text: string, index: number) {
  const quote = text[index]
  for (let i = index + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === quote) return i
    else if (text[i] === '\n' && quote !== '`') return -1
  }
  return -1
}

/** `text` with its comments blanked out (newlines kept, so lines and indexes stay where they were). */
export function withoutComments(text: string) {
  const out = text.split('')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === "'" || char === '"' || char === '`') {
      const end = stringEnd(text, i)
      if (end > 0) i = end
    } else if (char === '/' && text[i + 1] === '/' && text[i - 1] !== ':') {
      for (; i < text.length && text[i] !== '\n'; i++) out[i] = ' '
    } else if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end < 0 ? text.length : end + 2
      for (; i < stop; i++) if (text[i] !== '\n') out[i] = ' '
      i--
    }
  }
  return out.join('')
}

const CLOSE: Record<string, string> = { '{': '}', '(': ')', '[': ']' }

/** The index of the bracket closing the one at `open` (`{`, `(` or `[`), skipping strings; -1 when unclosed. Run it on text without comments. */
export function closing(text: string, open: number) {
  const stack: string[] = []
  for (let i = open; i < text.length; i++) {
    const char = text[i] as string
    if (char === "'" || char === '"' || char === '`') {
      const end = stringEnd(text, i)
      if (end > 0) i = end
    } else if (CLOSE[char]) stack.push(CLOSE[char])
    else if (char === stack[stack.length - 1]) {
      stack.pop()
      if (stack.length === 0) return i
    }
  }
  return -1
}

/**
 * The lines a function spans, from the line naming it to the end of its body: for `name` at `at`, its parameters in
 * `(…)`, an optional return type, then a `{…}` body or an arrow's expression. Undefined when it isn't followed by one.
 */
export function functionSpan(text: string, at: number): [number, number] | undefined {
  const open = text.indexOf('(', at)
  if (open < 0 || /[;}]/.test(text.slice(at, open))) return undefined
  const params = closing(text, open)
  if (params < 0) return undefined
  let depth = 0
  for (let i = params + 1; i < text.length; i++) {
    const char = text[i]
    if (char === '<') depth++
    else if (char === '>' && text[i - 1] !== '=') depth--
    else if (depth === 0 && char === '{') return [lineAt(text, at), lineAt(text, closing(text, i))]
    else if (depth === 0 && char === '=' && text[i + 1] === '>') {
      const rest = text.slice(i + 2).match(/^\s*/)?.[0].length ?? 0
      const start = i + 2 + rest
      if ('{(['.includes(text[start] as string)) return [lineAt(text, at), lineAt(text, closing(text, start))]
      return [lineAt(text, at), lineAt(text, start)]
    } else if (depth === 0 && char === ';') return undefined
  }
  return undefined
}

/** Local names bound to `module`'s exports: `{ cookies as getCookies }` gives getCookies → cookies. */
export function importsFrom(text: string, module: string) {
  const names = new Map<string, string>()
  const pattern = new RegExp(`import\\s*(?:type\\s*)?\\{([^}]*)\\}\\s*from\\s*['"]${module.replace(/[/.]/g, '\\$&')}['"]`, 'g')
  for (const [, list] of text.matchAll(pattern)) {
    for (const part of (list as string).split(',')) {
      const [imported, local] = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)
      if (imported) names.set((local ?? imported).trim(), imported.trim())
    }
  }
  return names
}

/** Whether the file starts with a directive such as `'use client'` (after comments and other directives). */
export function hasDirective(text: string, directive: RegExp) {
  for (const statement of withoutComments(text).split(/[;\n]/)) {
    const trimmed = statement.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(['"])([^'"]*)\1$/)
    if (!match) return false
    if (directive.test(match[2] as string)) return true
  }
  return false
}

/** Each JSX element `<tag …>` in `text` (without comments): where it starts and its whole opening tag, braces and strings included. */
export function elements(text: string, tag: string) {
  const found: { index: number; line: number; open: string }[] = []
  const pattern = new RegExp(`<${tag}(?=[\\s/>])`, 'g')
  for (const match of text.matchAll(pattern)) {
    let i = match.index + match[0].length
    for (let depth = 0; i < text.length && i < match.index + 4000; i++) {
      const char = text[i]
      if (char === '{') depth++
      else if (char === '}') depth--
      else if ((char === '"' || char === "'" || char === '`') && (depth > 0 || char !== '`')) {
        const end = stringEnd(text, i)
        if (end > 0) i = end
      } else if (char === '>' && depth === 0) break
    }
    found.push({ index: match.index, line: lineAt(text, match.index), open: text.slice(match.index, i + 1) })
  }
  return found
}
