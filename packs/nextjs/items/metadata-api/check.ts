import type { Context } from '../../../../core/checks/context.ts'
import { grep, listed, perApp, source } from '../../next.ts'

/** Head tags written by hand: `<head>`, `next/head`, `<meta name|property|…>` in JSX (`itemProp` microdata is fine), and `<title>` outside an SVG. */
const HAND_WRITTEN = /<head(\s|>)|from\s+['"]next\/head['"]|<meta\s+(name|property|httpEquiv|charSet)=/
const TITLE = /<title(\s|>)/
const METADATA = /export\s+(const\s+metadata\b|(async\s+)?function\s+generateMetadata\b|const\s+generateMetadata\b)/

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const files = source(app.appFiles, /\.(tsx|jsx|ts|js)$/)
    if (files.length === 0) return { pass: 'no app/ router: pages/ uses next/head, which is its metadata API' }
    const components = files.filter(path => /\.(tsx|jsx|js)$/.test(path))
    const withoutSvg: string[] = []
    for (const path of components) if (!((await co.read(path)) ?? '').includes('<svg')) withoutSvg.push(path)
    const hits = [...(await grep(co, components, HAND_WRITTEN)), ...(await grep(co, withoutSvg, TITLE))]
    if (hits.length > 0) return { fail: `head tags written by hand instead of metadata / generateMetadata: ${listed(hits)}` }
    const exporting = (await grep(co, files.filter(path => /(^|\/)(layout|page)\.(tsx|jsx|ts|js)$/.test(path)), METADATA)).length
    if (exporting === 0) return { fail: 'no layout or page in app/ exports metadata or generateMetadata' }
    return { pass: `metadata from ${exporting} metadata / generateMetadata exports, no head tags by hand` }
  })
