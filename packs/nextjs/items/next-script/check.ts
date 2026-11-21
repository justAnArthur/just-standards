import type { Context } from '../../../../core/checks/context.ts'
import { elements, listed, perApp, source, withoutComments } from '../../next.ts'

/** Script types that are data, not code: JSON-LD, import maps, speculation rules. */
const DATA = /\btype\s*=\s*\{?\s*['"](application\/(ld\+)?json|importmap|speculationrules)['"]/
/** Inline snippets of third-party tags that next/script (or @next/third-parties) should load. */
const THIRD_PARTY = /googletagmanager|gtag\(|google-analytics|\bfbq\(|connect\.facebook\.net|hotjar|clarity\.ms|plausible|cookiebot|hs-scripts|intercom/i
const RENDERS_ELSEWHERE = /from\s+['"](next\/og|@vercel\/og|@react-email\/[\w-]+|react-email|next\/document)['"]/
const GENERATED = /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)\.(tsx|jsx|js)$|(^|\/)emails?\/|(^|\/)pages\/_document\./

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const hits: string[] = []
    for (const path of source(app.files).filter(path => !GENERATED.test(path))) {
      const text = (await co.read(path)) ?? ''
      if (!text.includes('<script') || RENDERS_ELSEWHERE.test(text)) continue
      const code = withoutComments(text)
      for (const element of elements(code, 'script')) {
        if (DATA.test(element.open)) continue
        const end = code.indexOf('</script>', element.index)
        const body = element.open.endsWith('/>') || end < 0 ? element.open : code.slice(element.index, end)
        if (/\ssrc\s*=/.test(element.open)) hits.push(`${path}:${element.line} (<script src>)`)
        else if (THIRD_PARTY.test(body)) hits.push(`${path}:${element.line} (inline third-party tag)`)
      }
    }
    if (hits.length > 0) return { fail: `third-party scripts in a raw <script> instead of next/script: ${listed(hits)}` }
    return { pass: 'no raw <script> loads a third-party script' }
  })
