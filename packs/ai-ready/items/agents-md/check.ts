import { dirname, join, normalize } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { type Checkout, checkout, isOutcome } from '../../checkout.ts'

const DOCS = ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md']
const PM = '(?:npm|pnpm|yarn|bun|npx|bunx|pnpx)'

/** What an agent must be told how to do, and the package.json scripts that do it. */
const TASKS: { task: string; scripts: RegExp; words: RegExp }[] = [
  { task: 'run', scripts: /^(dev|start|serve|preview)(:.*)?$/, words: /\b(dev|start|serve|run)\b/ },
  { task: 'build', scripts: /^build(:.*)?$/, words: /\bbuild\b/ },
  { task: 'test', scripts: /^test(:.*)?$/, words: /\btest\b/ },
  { task: 'lint', scripts: /^(lint|check|typecheck|format)(:.*)?$/, words: /\b(lint|check|typecheck|clippy|ruff|eslint|biome)\b/ },
]
const LOCKFILES: [RegExp, string][] = [
  [/^bun\.lockb?$/, 'bun'],
  [/^pnpm-lock\.yaml$/, 'pnpm'],
  [/^yarn\.lock$/, 'yarn'],
]
const INSTALL = new RegExp(`\\b${PM}\\s+(install|i|ci)\\b|\\b(pip|uv|poetry|bundle|cargo|go|composer|mvn|gradle)\\b.*\\b(install|sync|build|mod download|fetch)\\b`)

/** The doc's text with the files it imports (`@AGENTS.md`, Claude Code's import syntax), one level deep. */
async function docText(co: Checkout) {
  const found = DOCS.filter(path => co.files.includes(path))
  const parts: string[] = []
  for (const path of found) {
    const text = (await co.read(path)) ?? ''
    parts.push(text)
    for (const [, target] of text.matchAll(/(?:^|\s)@([\w./-]+\.md)\b/g)) {
      const imported = normalize(join(dirname(path), target as string))
      if (co.files.includes(imported) && !found.includes(imported)) parts.push((await co.read(imported)) ?? '')
    }
  }
  return { found, text: parts.join('\n') }
}

/** Code the doc shows: fenced blocks and inline code spans, one entry per line. */
const codeOf = (markdown: string) => [
  ...[...markdown.matchAll(/^(```|~~~)[^\n]*\n([\s\S]*?)^\1/gm)].flatMap(match => (match[2] as string).split('\n')),
  ...[...markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').matchAll(/`([^`\n]+)`/g)].map(match => match[1] as string),
]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A script's command without its env prefix: `cross-env NODE_OPTIONS=… next build` → `next build`. */
const commandOf = (body: string) => body.split('&&')[0]!.replace(/^\s*(cross-env\s+)?([A-Z_][A-Z0-9_]*=("[^"]*"|\S*)\s+)*/, '').trim()

export default async function agentsMd(ctx: Context): Promise<Outcome> {
  const co = await checkout(ctx)
  if (isOutcome(co)) return co
  const { found, text } = await docText(co)
  if (found.length === 0) return { state: 'fail', evidence: `no AGENTS.md or CLAUDE.md at the root of ${co.where}` }
  const code = codeOf(text)
  const shows = (pattern: RegExp) => code.some(line => pattern.test(line))

  const manifest = co.files.includes('package.json') ? JSON.parse((await co.read('package.json')) ?? '{}') : undefined
  const scripts: Record<string, string> = manifest?.scripts ?? {}
  const pm = LOCKFILES.find(([lockfile]) => co.files.some(path => lockfile.test(path)))?.[1] ?? 'npm'

  // a script is shown when the doc runs it through a package manager, or shows the command it runs
  const showsScript = (name: string) => {
    const command = commandOf(scripts[name] ?? '')
    return shows(new RegExp(`\\b${PM}\\b.*(\\s|^)${escape(name)}(\\s|$)`)) || (command !== '' && shows(new RegExp(escape(command))))
  }
  const missing: string[] = []
  if (!shows(INSTALL)) missing.push(manifest ? `install (\`${pm} install\`)` : 'install')
  for (const { task, scripts: names, words } of TASKS) {
    if (!manifest) {
      if (!shows(words)) missing.push(task)
      continue
    }
    // a task package.json has no script for has nothing to show
    const own = Object.keys(scripts).filter(name => names.test(name))
    if (own.length > 0 && !own.some(showsScript)) missing.push(`${task} (\`${pm} run ${own[0]}\`)`)
  }
  if (missing.length > 0) return { state: 'fail', evidence: `${found.join(' + ')} doesn't show how to ${missing.join(', ')}` }
  return { state: 'pass', evidence: `${found.join(' + ')} shows how to install, run, build, test and lint (the ones package.json has)` }
}
