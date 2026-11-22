import type { Context } from '../../../../core/checks/context.ts'
import { codeOf, perPayloadApp } from '../../payload.ts'

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    for (const path of codeOf(app)) if (/\blivePreview\s*:\s*\{/.test((await co.read(path)) ?? '')) return { pass: `live preview is configured (${path})` }
    return { fail: 'no livePreview in the admin or collection config' }
  })
