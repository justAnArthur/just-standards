import type { Context } from '../../../../core/checks/context.ts'
import { codeOf, listed, perPayloadApp, TOOLKIT } from '../../payload.ts'

/** payload-www's exports when the checkout has no node_modules: `npm view @justanarthur/payload-www exports` at 2.9.0. */
const KNOWN = ['access', 'blocks', 'collections', 'config', 'fields', 'fields-client', 'imagehash', 'import-map-provider', 'mcp', 'metadata', 'package.json', 'pages', 'render-pages', 'sitemap', 'translator', 'utils']

const IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]@justanarthur\/payload-www(\/[^'"]*)?['"]/g
const REMOVED: [RegExp, string][] = [
  [/createWWWConfig\s*\(\s*[^)\s]/, 'createWWWConfig takes no arguments'],
  [/\bdefaultPlugins\s*:/, 'defaultPlugins was replaced by defaultPluginsConfigs'],
]

async function exportsOf(co: { read: (path: string) => Promise<string | undefined> }, root: string) {
  const text = await co.read(`${root ? `${root}/` : ''}node_modules/${TOOLKIT}/package.json`)
  try {
    const keys = Object.keys((JSON.parse(text ?? '') as { exports?: Record<string, unknown> }).exports ?? {})
    if (keys.length > 0) return keys.map(key => key.replace(/^\.\/?/, ''))
  } catch {}
  return KNOWN
}

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    const allowed = new Set(await exportsOf(co, app.root))
    const hits: string[] = []
    for (const path of codeOf(app)) {
      const text = await co.read(path)
      if (!text) continue
      for (const match of text.matchAll(IMPORT)) {
        const sub = (match[1] ?? '').replace(/^\//, '')
        if (!allowed.has(sub)) hits.push(`${path}: ${TOOLKIT}${sub ? `/${sub}` : ''} is not exported`)
      }
      for (const [pattern, why] of REMOVED) if (pattern.test(text)) hits.push(`${path}: ${why}`)
    }
    if (hits.length > 0) return { fail: listed(hits) }
    return { pass: `every ${TOOLKIT} import is an exported subpath` }
  })
