import type { Context } from '../../../../core/checks/context.ts'
import { closing, codeLines, configText, hasDirective, lineAt, listed, perApp, source, withoutComments } from '../../next.ts'

/** A NEXT_PUBLIC_ name that says secret. Publishable keys, Mapbox's public tokens and site keys are public by design. */
const SECRET_NAME = /\bNEXT_PUBLIC_(?![A-Z0-9_]*(PUBLISHABLE|MAPBOX|PUBLIC_TOKEN|SITE_KEY))[A-Z0-9_]*(SECRET|PASSWORD|PASSWD|PRIVATE|SERVICE_ROLE|TOKEN)[A-Z0-9_]*\b/
/** Tracked env templates and the files that set env vars for a build. */
const ENV_FILE = /(^|\/)(\.env[\w.-]*|[\w.-]*\.env|Dockerfile|docker-compose[\w.-]*\.ya?ml|vercel\.json)$/
/** Set by Next for every bundle. */
const BUILT_IN = new Set(['NODE_ENV', 'NEXT_RUNTIME', '__NEXT_ROUTER_BASEPATH'])
const ENV_READ = /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g

/** The names next.config's `env` option inlines into every bundle. */
function inlined(config: string) {
  const code = withoutComments(config)
  const names = new Set<string>()
  for (const match of code.matchAll(/(^|[\s,{])env\s*:\s*\{/g)) {
    const open = match.index + match[0].length - 1
    const block = code.slice(open + 1, closing(code, open))
    for (const [, name] of block.matchAll(/(?:^|[\s,{])['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*:/g)) names.add(name as string)
  }
  return names
}

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const hits: string[] = []
    const env = inlined(await configText(app, co))
    const code = source(app.files, /\.(tsx|jsx|ts|js|mjs|cjs|mts)$/)
    for (const path of [...code, ...app.files.filter(path => ENV_FILE.test(path))]) {
      const text = (await co.read(path)) ?? ''
      // in env files a `#` starts the comment
      const lines = ENV_FILE.test(path) ? text.split('\n').flatMap((line, i) => (SECRET_NAME.test(line.replace(/#.*/, '')) ? [i + 1] : [])) : codeLines(text, SECRET_NAME)
      for (const line of lines) hits.push(`${path}:${line} (${text.split('\n')[line - 1]?.match(SECRET_NAME)?.[0]} is a secret in the browser bundle)`)
    }
    for (const path of code.filter(path => /\.(tsx|jsx|js|ts)$/.test(path))) {
      const text = (await co.read(path)) ?? ''
      if (!text.includes('process.env') || !hasDirective(text, /^use client$/)) continue
      const stripped = withoutComments(text)
      for (const match of stripped.matchAll(ENV_READ)) {
        const name = match[1] as string
        if (name.startsWith('NEXT_PUBLIC_') || BUILT_IN.has(name) || env.has(name)) continue
        hits.push(`${path}:${lineAt(stripped, match.index)} (${name} is empty in a Client Component)`)
      }
    }
    if (hits.length > 0) return { fail: `environment variables on the wrong side: ${listed(hits)}` }
    return { pass: 'no secret is NEXT_PUBLIC_, and Client Components read only NEXT_PUBLIC_ variables' }
  })
