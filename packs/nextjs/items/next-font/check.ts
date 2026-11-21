import type { Context } from '../../../../core/checks/context.ts'
import { grep, listed, perApp, source } from '../../next.ts'

/** A font stylesheet from a font CDN, in a component (`<link href>`) or a stylesheet (`@import`). */
const REMOTE_FONTS = /(fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|api\.fontshare\.com)/

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const hits = await grep(co, source(app.files, /\.(tsx|jsx|ts|js|mjs|css|scss|sass|less)$/), REMOTE_FONTS)
    if (hits.length > 0) return { fail: `fonts loaded from a font CDN instead of next/font: ${listed(hits)}` }
    return { pass: 'no font loaded from a font CDN' }
  })
