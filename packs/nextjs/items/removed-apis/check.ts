import type { Context } from '../../../../core/checks/context.ts'
import { atLeast, codeLines, configFiles, importsFrom, listed, perApp, scriptsOf, source, versionOf } from '../../next.ts'

/** Where a rule looks: the Next config, any source file, files under app/, or package.json scripts. */
type Where = 'config' | 'source' | 'app' | 'scripts'

interface Rule {
  /** the Next version that removed it */
  since: string
  where: Where
  pattern: RegExp
  what: string
  /** only in files importing this name from next/cache */
  imports?: string
}

/** What the version 15 and 16 upgrade guides list as removed, or as an error now. */
export const RULES: Rule[] = [
  { since: '15.0.0', where: 'source', pattern: /from\s+['"]@next\/font\b/, what: '@next/font is removed: import from next/font' },
  { since: '15.0.0', where: 'app', pattern: /^\s*export\s+const\s+runtime\s*=\s*['"]experimental-edge['"]/, what: "runtime 'experimental-edge' is an error" },
  { since: '16.0.0', where: 'scripts', pattern: /\bnext\s+lint\b/, what: '`next lint` is removed' },
  { since: '16.0.0', where: 'config', pattern: /(^|[{,\s])eslint\s*:/, what: 'the eslint option is removed' },
  { since: '16.0.0', where: 'config', pattern: /\b(serverRuntimeConfig|publicRuntimeConfig)\b/, what: 'runtime config is removed' },
  { since: '16.0.0', where: 'source', pattern: /from\s+['"]next\/config['"]/, what: 'next/config (getConfig) is removed' },
  { since: '16.0.0', where: 'config', pattern: /(^|[{,\s])amp\s*:/, what: 'AMP is removed' },
  { since: '16.0.0', where: 'source', pattern: /from\s+['"]next\/amp['"]|export\s+const\s+config\s*=\s*\{[^}]*\bamp\s*:/, what: 'AMP is removed' },
  { since: '16.0.0', where: 'config', pattern: /(^|[{,\s])(ppr|dynamicIO|useCache)\s*:/, what: 'experimental ppr, dynamicIO and useCache are removed (cacheComponents replaces them)' },
  { since: '16.0.0', where: 'app', pattern: /^\s*export\s+const\s+experimental_ppr\b/, what: 'experimental_ppr is removed' },
  { since: '16.0.0', where: 'source', pattern: /\bunstable_rootParams\b/, what: 'unstable_rootParams is removed (next/root-params)' },
  { since: '16.0.0', where: 'config', pattern: /(^|[{,\s])(appIsrStatus|buildActivity|buildActivityPosition)\s*:/, what: 'these devIndicators options are removed' },
  { since: '16.3.0', where: 'config', pattern: /(^|[{,\s])viewTransition\s*:/, what: 'experimental.viewTransition is removed' },
  { since: '16.4.0', where: 'config', pattern: /(^|[{,\s])appNewScrollHandler\s*:/, what: 'experimental.appNewScrollHandler is removed' },
  {
    since: '16.0.0',
    where: 'source',
    pattern: /\brevalidateTag\(\s*[^,()]*\)/,
    imports: 'revalidateTag',
    what: 'revalidateTag needs a cacheLife profile as its second argument',
  },
]

const SLOT = /^(.*\/@[^/]+)\//
const DEFAULT = /\/default\.(tsx|jsx|ts|js)$/

/** Parallel route slots (`app/@modal/`) without a `default.*`: the build fails since 16. */
function slotsWithoutDefault(appFiles: string[]) {
  const slots = new Set(appFiles.flatMap(path => path.match(SLOT)?.[1] ?? []))
  return [...slots].filter(slot => !appFiles.some(path => path.startsWith(`${slot}/`) && DEFAULT.test(path.slice(slot.length))))
}

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const version = await versionOf(app, co)
    const rules = RULES.filter(rule => atLeast(version, rule.since))
    const hits: string[] = []
    const scan = (path: string, text: string, where: Where[]) => {
      for (const rule of rules.filter(rule => where.includes(rule.where))) {
        if (rule.imports && !importsFrom(text, 'next/cache').has(rule.imports)) continue
        for (const line of codeLines(text, rule.pattern)) hits.push(`${path}:${line} (${rule.what})`)
      }
    }
    const config = await configFiles(app, co)
    for (const file of config) scan(file.path, file.text, ['config'])
    for (const path of source(app.files, /\.(tsx|jsx|ts|js|mjs)$/)) {
      if (config.some(file => file.path === path)) continue
      scan(path, (await co.read(path)) ?? '', app.appFiles.includes(path) ? ['source', 'app'] : ['source'])
    }
    const scripts = await scriptsOf(app, co)
    for (const [name, script] of Object.entries(scripts)) {
      for (const rule of rules.filter(rule => rule.where === 'scripts' && rule.pattern.test(script))) hits.push(`script "${name}" (${rule.what})`)
    }
    if (atLeast(version, '16.0.0')) {
      for (const slot of slotsWithoutDefault(app.appFiles)) hits.push(`${slot}/ has no default.js (parallel route slots need one)`)
      // next build runs Turbopack, which fails on a webpack config unless the build opts out or configures Turbopack
      const text = config.map(file => file.text).join('\n')
      const webpack = codeLines(text, /^\s*(webpack\s*[:(]|webpack\s*,|async\s+webpack\s*\()/).length > 0
      const turbopack = codeLines(text, /^\s*turbopack\s*:/).length > 0
      const build = Object.values(scripts).find(script => /\bnext\s+build\b/.test(script))
      if (webpack && !turbopack && build && !/--(webpack|turbopack|turbo)\b/.test(build)) {
        hits.push('next.config has a webpack config, and `next build` now runs Turbopack, which fails on it')
      }
    }
    if (hits.length > 0) return { fail: `uses what next ${version ?? '(latest)'} removed: ${listed(hits)}` }
    return { pass: `nothing next ${version ?? '(latest)'} removed is in use` }
  })
