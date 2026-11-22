import type { Context } from '../../../../core/checks/context.ts'
import { grep, listed, perPayloadApp } from '../../payload.ts'

/** A colour literal: `#abc`, `#aabbcc`, `#aabbccdd` as a value, or a Tailwind arbitrary `[#…]`. */
const COLOUR = /(\[#[0-9a-fA-F]{3,8}\]|['"`]#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?['"`]|:\s*#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl)a?\(\s*\d)/
const STYLED = /(^|\/)(blocks|components|ui|sections)\//
const THEME = /(theme|tokens?|globals?)\b|\.config\.|(^|\/)(admin|\(payload\)|og|opengraph-image|icon|apple-icon)[/.]|email/i

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    const files = app.files.filter(path => /\.(tsx|jsx|css|scss)$/.test(path) && STYLED.test(path) && !THEME.test(path) && !/\.(test|stories)\./.test(path))
    const hits = await grep(co, files, COLOUR, /standards-allow/)
    if (hits.length > 0) return { fail: `${hits.length} colour literals in blocks and components: ${listed(hits)}` }
    return { pass: `${files.length} block and component files use theme tokens only` }
  })
