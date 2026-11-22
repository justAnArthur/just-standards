import type { Context } from '../../../../core/checks/context.ts'
import { perPayloadApp, TOOLKIT, withoutComments } from '../../payload.ts'

export default (ctx: Context) =>
  perPayloadApp(ctx, async app => {
    if (!app.deps[TOOLKIT]) return { fail: `depends on payload but not on ${TOOLKIT}` }
    if (!app.config) return { fail: 'no payload.config.* is tracked' }
    const text = withoutComments(app.config.text)
    if (!/createWWWConfig\s*\(/.test(text) || !/withWWWConfig\s*\(/.test(text)) {
      return { fail: `${app.config.path} doesn't compose its config with createWWWConfig() and withWWWConfig()` }
    }
    return { pass: `${app.config.path} is composed with withWWWConfig, ${TOOLKIT} ${app.deps[TOOLKIT]}` }
  })
