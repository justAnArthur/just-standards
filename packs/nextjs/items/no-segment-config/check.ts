import type { Context } from '../../../../core/checks/context.ts'
import { configText, grep, lines, listed, perApp, source } from '../../next.ts'

const SEGMENT = /^\s*export\s+const\s+(dynamic|revalidate|fetchCache|runtime|preferredRegion)\b/
const CACHE_COMPONENTS = /\b(cacheComponents|dynamicIO)\s*:\s*true\b/

/** With `cacheComponents`, route segment config in `app/` is a build error; without it, it is allowed. */
export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    if (lines(await configText(app, co), CACHE_COMPONENTS).length === 0) return { pass: 'cacheComponents is off, so route segment config is allowed' }
    const hits = await grep(co, source(app.appFiles, /\.(ts|tsx|js|jsx|mjs)$/), SEGMENT)
    if (hits.length > 0) return { fail: `cacheComponents is on, and route segment config breaks the build: ${listed(hits)}` }
    return { pass: `cacheComponents is on, and no file in app/ exports route segment config` }
  })
