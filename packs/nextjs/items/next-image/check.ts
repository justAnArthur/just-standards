import type { Context } from '../../../../core/checks/context.ts'
import { grep, listed, perApp, source } from '../../next.ts'

const IMG = /<img(\s|>|\/|$)/
/** The linters' own escape hatches, on the line or just above: a raw `<img>` someone decided on. */
const ALLOWED = /@next\/next\/no-img-element|lint\/performance\/noImgElement/
/** Files where `<img>` is the only option: generated images (`next/og`) and emails. */
const GENERATED = /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)\.(tsx|jsx|js)$|(^|\/)emails?\//
const RENDERS_ELSEWHERE = /from\s+['"](next\/og|@vercel\/og|@react-email\/[\w-]+|react-email)['"]/

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const files: string[] = []
    for (const path of source(app.files).filter(path => !GENERATED.test(path))) {
      const text = (await co.read(path)) ?? ''
      if (IMG.test(text) && !RENDERS_ELSEWHERE.test(text)) files.push(path)
    }
    const hits = await grep(co, files, IMG, ALLOWED)
    if (hits.length > 0) return { fail: `raw <img> instead of next/image: ${listed(hits)}` }
    return { pass: `no raw <img> in ${source(app.files).length} components` }
  })
