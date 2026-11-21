import type { Context } from '../../../../core/checks/context.ts'
import { closing, hasDirective, importsFrom, lineAt, listed, perApp, source, withoutComments } from '../../next.ts'

/** `'use cache'` and `'use cache: remote'`; `'use cache: private'` may read cookies and headers. */
const DIRECTIVE = /^use cache(: ?remote)?$/
const INLINE = /(['"])use cache(?:: ?(remote|private))?\1/g
const REQUEST_APIS = new Set(['cookies', 'headers'])

/** The calls to cookies()/headers() from next/headers in `code`, by index. */
function requestCalls(code: string, text: string) {
  const names = [...importsFrom(text, 'next/headers')].filter(([, imported]) => REQUEST_APIS.has(imported)).map(([local]) => local)
  if (names.length === 0) return []
  return [...code.matchAll(new RegExp(`\\b(?:${names.join('|')})\\(\\)`, 'g'))].map(match => match.index)
}

/** The header of the function whose body opens at `open`: back over its parameters to the end of the statement before. */
function headerOf(code: string, open: number) {
  let depth = 0
  for (let i = open - 1; i >= 0 && i > open - 400; i--) {
    const char = code[i]
    if (char === ')' || char === ']') depth++
    else if (char === '(' || char === '[') depth--
    else if (depth === 0 && (char === ';' || char === '{' || char === '}' || (char === '\n' && code[i - 1] === '\n'))) return code.slice(i + 1, open)
  }
  return code.slice(Math.max(0, open - 400), open)
}

/** The function a directive at `at` opens: the `{` before it, and whether its header says `async`. */
function enclosing(code: string, at: number) {
  const open = code.lastIndexOf('{', at)
  if (open < 0 || code.slice(open + 1, at).trim() !== '') return undefined
  return { open, close: closing(code, open), async: /\basync\b/.test(headerOf(code, open)) }
}

/** Exported functions that aren't async, in a file under a file-level `'use cache'`. */
function syncExports(code: string) {
  const lines: number[] = []
  for (const match of code.matchAll(/^\s*export\s+(default\s+)?(async\s+)?function\b|^\s*export\s+const\s+\w+\s*=\s*(async\b)?/gm)) {
    if (match[2] || match[3]) continue
    // an exported value that isn't a function (a constant, a type) is no cached function
    if (/^\s*export\s+const/.test(match[0]) && !/^\s*(\([^)]*\)|\w+)\s*=>/.test(code.slice(match.index + match[0].length))) continue
    lines.push(lineAt(code, match.index))
  }
  return lines
}

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const hits: string[] = []
    let scopes = 0
    for (const path of source(app.files, /\.(tsx|jsx|ts|js|mjs)$/)) {
      const text = (await co.read(path)) ?? ''
      if (!text.includes('use cache')) continue
      const code = withoutComments(text)
      const calls = requestCalls(code, text)
      if (hasDirective(text, DIRECTIVE)) {
        scopes++
        for (const index of calls) hits.push(`${path}:${lineAt(code, index)} (cookies()/headers() in a 'use cache' file)`)
        for (const line of syncExports(code)) hits.push(`${path}:${line} (an export of a 'use cache' file must be async)`)
        continue
      }
      for (const match of code.matchAll(INLINE)) {
        const scope = enclosing(code, match.index)
        if (!scope) continue
        scopes++
        if (!scope.async) hits.push(`${path}:${lineAt(code, match.index)} (a 'use cache' function must be async)`)
        if (match[2] === 'private') continue
        for (const index of calls.filter(index => index > scope.open && index < scope.close)) {
          hits.push(`${path}:${lineAt(code, index)} (cookies()/headers() inside 'use cache')`)
        }
      }
    }
    if (hits.length > 0) return { fail: `'use cache' scopes that fail at build or request time: ${listed(hits)}` }
    if (scopes === 0) return { pass: "no 'use cache' in the app" }
    return { pass: `${scopes} 'use cache' scopes, all async, none reading cookies() or headers()` }
  })
