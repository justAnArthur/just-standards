import type { Context } from '../../../../core/checks/context.ts'
import { closing, functionSpan, importsFrom, lineAt, listed, perApp, source, withoutComments } from '../../next.ts'

/** The files Next passes `params` (and `searchParams`) to as a Promise since 15. */
const SPECIAL = /(^|\/)(page|layout|route|default|opengraph-image|twitter-image|icon|apple-icon)\.(tsx|jsx|ts|js|mjs)$/
/** Functions that still get plain params: a nested `generateStaticParams` gets its parent's, `generateImageMetadata` its own. */
const SYNC_PARAMS = /\b(generateStaticParams|generateImageMetadata|generateSitemaps)\b/g
const REQUEST_APIS = new Set(['cookies', 'headers', 'draftMode'])
/** The temporary casts the 15 codemod leaves: the docs say to resolve them, not keep them. */
const UNWRAPPED = /\bUnsafeUnwrapped(Cookies|Headers|DraftMode|Params|SearchParams)\b/

/** Lines of the functions in `code` that still get sync params. */
function syncLines(code: string) {
  const skip = new Set<number>()
  for (const match of code.matchAll(SYNC_PARAMS)) {
    const span = functionSpan(code, match.index)
    if (span) for (let line = span[0]; line <= span[1]; line++) skip.add(line)
  }
  return skip
}

/** `cookies()`, `headers()` and `draftMode()` from next/headers, used without `await` (or React's `use`). */
function syncRequestApis(code: string) {
  const names = [...importsFrom(code, 'next/headers')].filter(([, imported]) => REQUEST_APIS.has(imported)).map(([local]) => local)
  if (names.length === 0) return []
  const call = `\\b(?:${names.join('|')})\\(\\)`
  const hits: number[] = []
  // a property read straight off the call (`cookies().get('x')`, even after `await`, reads the Promise)
  for (const match of code.matchAll(new RegExp(`${call}\\s*\\.\\s*\\w`, 'g'))) hits.push(lineAt(code, match.index))
  // the call kept in a variable, or destructured, without await
  for (const match of code.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(?:\\w+|\\{[^}]*\\})\\s*(?::[^=]+)?=\\s*${call}`, 'g'))) hits.push(lineAt(code, match.index))
  return hits
}

/** The type annotations in `code`: `type X = {…}`, `interface X {…}`, and a parameter's `}: {…}` or `(props: {…})`. */
function typeBlocks(code: string) {
  const blocks: { index: number; text: string }[] = []
  for (const match of code.matchAll(/\btype\s+\w+(?:<[^>]*>)?\s*=\s*\{|\binterface\s+\w+[^{]*\{|\}\s*:\s*\{|\(\s*\w+\s*:\s*\{/g)) {
    const open = match.index + match[0].length - 1
    const close = closing(code, open)
    if (close > 0) blocks.push({ index: match.index, text: code.slice(match.index, close + 1) })
  }
  return blocks
}

/** `params` and `searchParams` read as plain objects in a file Next gives Promises to. */
function syncParams(code: string) {
  const skip = syncLines(code)
  const hits: number[] = []
  const add = (index: number) => {
    const line = lineAt(code, index)
    if (!skip.has(line)) hits.push(line)
  }
  // typed as an object, not a Promise: `{ params }: { params: { slug: string } }`
  for (const block of typeBlocks(code)) {
    const typed = block.text.match(/\b(params|searchParams)\??\s*:\s*\{/)
    if (typed?.index !== undefined) add(block.index + typed.index)
  }
  for (const name of ['params', 'searchParams']) {
    // bound in the file to something resolved: `const params = await props.params`, `useParams()`, `new URL(…).searchParams`
    const bound = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b|\\b(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=`).test(code)
    const prop = `(?:props|segmentData|context|ctx)\\.${name}`
    const read = bound ? prop : `(?<![\\w$.])(?:${prop}|${name})`
    // destructured without await: `const { slug } = params`
    for (const match of code.matchAll(new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\}\\s*=\\s*${read}\\s*(?:[;\\n]|$)`, 'g'))) add(match.index)
    // a property read off it: `params.slug`
    for (const match of code.matchAll(new RegExp(`${read}\\.(?!then\\b)\\w`, 'g'))) add(match.index)
  }
  return hits
}

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const hits: string[] = []
    for (const path of source(app.files, /\.(tsx|jsx|ts|js|mjs)$/)) {
      const text = await co.read(path)
      if (!text) continue
      const code = withoutComments(text)
      const lines = new Set(syncRequestApis(code))
      if (SPECIAL.test(path) && app.appFiles.includes(path)) for (const line of syncParams(code)) lines.add(line)
      code.split('\n').forEach((line, index) => UNWRAPPED.test(line) && lines.add(index + 1))
      for (const line of [...lines].sort((a, b) => a - b)) hits.push(`${path}:${line}`)
    }
    if (hits.length > 0) return { fail: `request APIs read synchronously (await params, searchParams, cookies(), headers(), draftMode()): ${listed(hits)}` }
    return { pass: 'params, searchParams, cookies(), headers() and draftMode() are awaited' }
  })
