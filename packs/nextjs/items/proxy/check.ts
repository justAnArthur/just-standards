import type { Context } from '../../../../core/checks/context.ts'
import { codeLines, configFiles, listed, perApp } from '../../next.ts'

const FILE = /^(src\/)?(middleware|proxy)\.(ts|js|mjs|tsx|jsx)$/
/** The middleware stays when it keeps the edge runtime on purpose: proxy is Node.js only. */
const EDGE = /\bruntime\s*:\s*['"](experimental-)?edge['"]/
const MIDDLEWARE_EXPORT = /export\s+(async\s+)?function\s+middleware\b|export\s+const\s+middleware\b|\bas\s+middleware\b/
const RUNTIME = /\bruntime\s*:/

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const prefix = app.root ? `${app.root}/` : ''
    const files = app.files.filter(path => path.startsWith(prefix) && FILE.test(path.slice(prefix.length)))
    const hits: string[] = []
    let edge = ''
    for (const path of files) {
      const text = (await co.read(path)) ?? ''
      if (/(^|\/)middleware\.\w+$/.test(path)) {
        if (codeLines(text, EDGE).length > 0) edge = `; ${path} keeps the edge runtime on purpose`
        else hits.push(`${path} (rename to proxy)`)
        continue
      }
      for (const line of codeLines(text, MIDDLEWARE_EXPORT)) hits.push(`${path}:${line} (export proxy, not middleware)`)
      for (const line of codeLines(text, RUNTIME)) hits.push(`${path}:${line} (proxy has no runtime option: setting one throws)`)
    }
    for (const file of await configFiles(app, co)) {
      for (const line of codeLines(file.text, /\bskipMiddlewareUrlNormalize\b/)) hits.push(`${file.path}:${line} (skipMiddlewareUrlNormalize → skipProxyUrlNormalize)`)
    }
    if (hits.length > 0) return { fail: `the middleware convention is deprecated for proxy: ${listed(hits)}` }
    if (files.length === 0) return { pass: `no middleware or proxy${edge}` }
    return { pass: `${files.join(', ')} follows the proxy convention${edge}` }
  })
