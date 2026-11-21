import type { Context } from '../../../../core/checks/context.ts'
import { configText, functionSpan, lineAt, lines, listed, perApp, source, withoutComments } from '../../next.ts'

/** The route segment config cacheComponents removes (`preferredRegion` is only deprecated, `maxDuration` stays). */
const SEGMENT = /^\s*export\s+const\s+(dynamic|dynamicParams|revalidate|fetchCache|runtime)\b/
const CACHE_COMPONENTS = /\b(cacheComponents|dynamicIO)\s*:\s*true\b/
const STATIC_PARAMS = /\bgenerateStaticParams\b/g

/** `generateStaticParams` returning `[]`: with cacheComponents it must return at least one param. */
function emptyStaticParams(text: string) {
  const code = withoutComments(text)
  const hits: number[] = []
  for (const match of code.matchAll(STATIC_PARAMS)) {
    const span = functionSpan(code, match.index)
    if (!span) continue
    const body = code.split('\n').slice(span[0] - 1, span[1]).join('\n')
    const empty = body.match(/return\s*\[\s*\]|=>\s*\[\s*\]/)
    if (empty?.index !== undefined) hits.push(span[0] + lineAt(body, empty.index) - 1)
  }
  return hits
}

/** With `cacheComponents`, route segment config in `app/` and an empty `generateStaticParams` fail the build; without it, both are allowed. */
export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    if (lines(await configText(app, co), CACHE_COMPONENTS).length === 0) return { pass: 'cacheComponents is off, so route segment config is allowed' }
    const hits: string[] = []
    for (const path of source(app.appFiles, /\.(ts|tsx|js|jsx|mjs)$/)) {
      const text = (await co.read(path)) ?? ''
      for (const line of lines(text, SEGMENT)) hits.push(`${path}:${line}`)
      for (const line of emptyStaticParams(text)) hits.push(`${path}:${line} (generateStaticParams returns [])`)
    }
    if (hits.length > 0) return { fail: `cacheComponents is on, and this breaks the build: ${listed(hits)}` }
    return { pass: `cacheComponents is on, and no file in app/ exports route segment config or returns no static params` }
  })
