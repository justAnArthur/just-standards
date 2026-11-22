import type { Context } from '../../../../core/checks/context.ts'
import { perPayloadApp } from '../../payload.ts'

const FROM_CMS = /@justanarthur\/payload-www\/(render-pages|collections|metadata)|getPayload\s*\(|queryDoc|static-pages|notFound\s*:\s*\{|RenderBlocks/

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    const pages = app.appFiles.filter(path => /not-found\.(tsx|jsx|js)$/.test(path) && !/\(payload\)/.test(path))
    if (pages.length === 0) return { fail: "no not-found page in the frontend: Next.js shows its own English 404" }
    for (const path of pages) {
      const text = (await co.read(path)) ?? ''
      if (FROM_CMS.test(text)) return { pass: `${path} renders content from the CMS` }
      // one level deep: a component the page imports from the app
      for (const [, local] of text.matchAll(/from\s+['"](@\/[^'"]+)['"]/g)) {
        const base = (local as string).replace(/^@\//, app.src ? `${app.src}/` : '')
        const file = app.files.find(file => file.startsWith(base) && /\.(tsx|ts|jsx|js)$/.test(file))
        if (file && FROM_CMS.test((await co.read(file)) ?? '')) return { pass: `${path} renders content from the CMS through ${file}` }
      }
    }
    return { fail: `${pages.join(', ')} is hard-coded: editors can't write it and it isn't localized` }
  })
