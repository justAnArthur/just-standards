import type { Context } from '../../../../core/checks/context.ts'
import { codeOf, perPayloadApp } from '../../payload.ts'

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    if (!app.deps['@payloadcms/plugin-redirects']) return { fail: 'no redirects collection: @payloadcms/plugin-redirects is not set up' }
    for (const path of codeOf(app)) {
      const text = (await co.read(path)) ?? ''
      if (/redirectsPlugin\s*\(/.test(text)) continue
      if (/collection\s*:\s*(['"]redirects['"]|\w*REDIRECT\w*)|PayloadRedirects|getRedirects/.test(text)) return { pass: `the redirects collection is read by the frontend (${path})` }
    }
    return { fail: 'a redirects collection exists, but no frontend code reads it, so its redirects never happen' }
  })
