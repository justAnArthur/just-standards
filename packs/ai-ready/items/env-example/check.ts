import { basename } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { checkout, isOutcome } from '../../checkout.ts'

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|astro)$/
const NOT_RUNTIME = /(\.(test|spec|stories)\.|(^|\/)(playwright|vitest|jest|cypress)\.config\.|\.d\.ts$|(^|\/)(__tests__|tests?|e2e|fixtures?|node_modules|dist|vendor|public)\/|(^|\/)\.)/
const EXAMPLE = /^(\.env(\.[\w-]+)*\.(example|sample|template|dist)|\.env\.(example|sample|template)(\.[\w-]+)*|(example|sample)\.env)$/

const READS = [
  /\b(?:process\.env|import\.meta\.env|Bun\.env)\.([A-Za-z_]\w*)/g,
  /\b(?:process\.env|import\.meta\.env|Bun\.env)\[\s*['"`]([A-Za-z_]\w*)['"`]\s*\]/g,
  /\bDeno\.env\.get\(\s*['"`]([A-Za-z_]\w*)['"`]/g,
]
const DESTRUCTURED = /\{([^{}]+)\}\s*=\s*(?:process\.env|import\.meta\.env|Bun\.env)\b/g
const WRITES = /\b(?:process\.env|Bun\.env)\.([A-Za-z_]\w*)\s*(?:=(?!=)|\?\?=|\|\|=)/g

/** Set by Node, CI, the host or the bundler, never by the repo's own config. */
const PROVIDED =
  /^(NODE_ENV|CI|HOME|PATH|PWD|TMPDIR|SHELL|USER|VERCEL|VERCEL_.*|NEXT_PUBLIC_VERCEL_.*|NEXT_RUNTIME|NEXT_PHASE|NEXT_DEPLOYMENT_ID|__NEXT_.*|GITHUB_.*|RUNNER_.*|npm_.*|NETLIFY|CF_PAGES.*)$/
/** `import.meta.env`'s own fields in Vite and Astro. */
const BUNDLER = /^(MODE|DEV|PROD|SSR|BASE_URL|SITE|ASSETS_PREFIX)$/

export default async function envExample(ctx: Context): Promise<Outcome> {
  const co = await checkout(ctx)
  if (isOutcome(co)) return co
  if (!co.local) return { state: 'error', evidence: `this check reads every source file and needs a local checkout: give the asset a path (${co.where} has none)` }

  const reads = new Map<string, string>()
  const written = new Set<string>()
  for (const path of co.files.filter(path => CODE.test(path) && !NOT_RUNTIME.test(path))) {
    const text = (await co.read(path)) ?? ''
    const at = (index: number) => `${path}:${text.slice(0, index).split('\n').length}`
    const note = (name: string, index: number) => !reads.has(name) && reads.set(name, at(index))
    for (const pattern of READS) for (const match of text.matchAll(pattern)) {
      const name = match[1] as string
      if (!(pattern === READS[0] && match[0].startsWith('import.meta.env') && BUNDLER.test(name))) note(name, match.index)
    }
    for (const match of text.matchAll(DESTRUCTURED)) {
      for (const part of (match[1] as string).split(',')) {
        const name = part.split(/[:=]/)[0]?.trim().replace(/^\.\.\./, '')
        if (name && /^[A-Za-z_]\w*$/.test(name)) note(name, match.index)
      }
    }
    for (const match of text.matchAll(WRITES)) written.add(match[1] as string)
  }
  const needed = [...reads].filter(([name]) => !PROVIDED.test(name) && !written.has(name))
  if (needed.length === 0) return { state: 'pass', evidence: 'the code reads no environment variables of its own' }

  const examples = co.files.filter(path => EXAMPLE.test(basename(path)))
  const shown = (list: [string, string][]) => list.slice(0, 8).map(([name, at]) => `${name} (${at})`).join(', ') + (list.length > 8 ? ` and ${list.length - 8} more` : '')
  if (examples.length === 0) return { state: 'fail', evidence: `no .env.example; the code reads ${shown(needed)}` }

  const listed = new Set<string>()
  for (const path of examples) {
    for (const [, name] of ((await co.read(path)) ?? '').matchAll(/^\s*#?\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/gm)) listed.add(name as string)
  }
  const missing = needed.filter(([name]) => !listed.has(name))
  if (missing.length > 0) return { state: 'fail', evidence: `${examples.join(', ')} misses ${shown(missing)}` }
  return { state: 'pass', evidence: `${examples.join(', ')} lists all ${needed.length} variables the code reads` }
}
