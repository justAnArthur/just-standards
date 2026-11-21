import type { Context } from '../../../../core/checks/context.ts'
import { atLeast, closing, codeLines, configFiles, elements, importsFrom, lineAt, listed, perApp, source, versionOf, withoutComments } from '../../next.ts'

type Where = 'config' | 'source' | 'app'

interface Rule {
  /** the Next version that deprecated it */
  since: string
  where: Where
  pattern: RegExp
  what: string
  /** only in files importing this name from this module */
  imports?: [module: string, name: string]
}

/** What the Next docs mark deprecated, with what replaces it. middleware → proxy and images.domains have their own items. */
const RULES: Rule[] = [
  { since: '14.0.0', where: 'source', pattern: /\bonLoadingComplete\s*=/, what: 'Image onLoadingComplete → onLoad' },
  {
    since: '15.0.0',
    where: 'config',
    pattern: /(^|[{,\s])(serverComponentsExternalPackages|bundlePagesExternals)\s*:/,
    what: 'experimental.serverComponentsExternalPackages → serverExternalPackages, bundlePagesExternals → bundlePagesRouterDependencies',
  },
  { since: '15.0.0', where: 'source', pattern: /\buseFormState\b/, imports: ['react-dom', 'useFormState'], what: "useFormState → React's useActionState" },
  { since: '16.0.0', where: 'source', pattern: /from\s+['"]next\/legacy\/image['"]/, what: 'next/legacy/image → next/image' },
  { since: '16.0.0', where: 'source', pattern: /\bunstable_(cacheLife|cacheTag)\b/, what: 'unstable_cacheLife / unstable_cacheTag → cacheLife / cacheTag' },
  { since: '16.0.0', where: 'app', pattern: /^\s*export\s+const\s+runtime\s*=\s*['"]edge['"]/, what: "runtime 'edge' is deprecated" },
  { since: '16.0.0', where: 'app', pattern: /^\s*export\s+const\s+preferredRegion\b/, what: 'preferredRegion is deprecated' },
]

const IMAGE_IMPORT = /import\s+(\w+)\s*(?:,\s*\{[^}]*\}\s*)?from\s*['"]next\/image['"]/

/** `<Image priority>`: deprecated in 16 for `preload` (or `loading="eager"`). */
function priorityProps(text: string) {
  const name = text.match(IMAGE_IMPORT)?.[1]
  if (!name) return []
  return elements(withoutComments(text), name)
    .filter(element => /\spriority(?=[\s=/>])(?!\s*=\s*\{\s*false\s*\})/.test(element.open))
    .map(element => element.line)
}

/** `experimental.turbopack`: moved to the top-level `turbopack` in 16. */
function experimentalTurbopack(text: string) {
  const code = withoutComments(text)
  const hits: number[] = []
  for (const match of code.matchAll(/\bexperimental\s*:\s*\{/g)) {
    const open = match.index + match[0].length - 1
    const block = code.slice(open, closing(code, open) + 1)
    const found = block.match(/[{,\s]turbopack\s*:/)
    if (found?.index !== undefined) hits.push(lineAt(code, open + found.index + 1))
  }
  return hits
}

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const version = await versionOf(app, co)
    const rules = RULES.filter(rule => atLeast(version, rule.since))
    const v16 = atLeast(version, '16.0.0')
    const hits: string[] = []
    const scan = (path: string, text: string, where: Where[]) => {
      for (const rule of rules.filter(rule => where.includes(rule.where))) {
        if (rule.imports && !importsFrom(text, rule.imports[0]).has(rule.imports[1])) continue
        for (const line of codeLines(text, rule.pattern)) hits.push(`${path}:${line} (${rule.what})`)
      }
    }
    const config = await configFiles(app, co)
    for (const file of config) {
      scan(file.path, file.text, ['config'])
      if (v16) for (const line of experimentalTurbopack(file.text)) hits.push(`${file.path}:${line} (experimental.turbopack → turbopack)`)
    }
    for (const path of source(app.files, /\.(tsx|jsx|ts|js|mjs)$/)) {
      if (config.some(file => file.path === path)) continue
      const text = (await co.read(path)) ?? ''
      scan(path, text, app.appFiles.includes(path) ? ['source', 'app'] : ['source'])
      if (v16) for (const line of priorityProps(text)) hits.push(`${path}:${line} (Image priority → preload)`)
    }
    if (hits.length > 0) return { fail: `uses what next ${version ?? '(latest)'} deprecated: ${listed(hits)}` }
    return { pass: `nothing next ${version ?? '(latest)'} deprecated is in use` }
  })
