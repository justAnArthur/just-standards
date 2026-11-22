import type { Context } from '../../../../core/checks/context.ts'
import { perPayloadApp, withoutComments } from '../../payload.ts'

export default (ctx: Context) =>
  perPayloadApp(ctx, async app => {
    const problems: string[] = []
    if (app.deps['@payloadcms/plugin-seo']) problems.push('@payloadcms/plugin-seo is installed: the org SEO plugin replaces it, with its fields moved')
    const config = app.config ? withoutComments(app.config.text) : ''
    for (const name of ['seo', 'imageHash', 'translator']) {
      if (new RegExp(`\\b${name}\\s*:\\s*(false|null|undefined)\\b`).test(config)) problems.push(`defaultPluginsConfigs.${name} is turned off`)
    }
    if (!app.deps['@justanarthur/payload-imagehash-plugin'] && !app.deps.sharp) problems.push('no sharp for the imagehash plugin to encode placeholders')
    if (problems.length > 0) return { fail: problems.join('; ') }
    return { pass: 'the org SEO, imagehash and translator plugins are on, and no second SEO plugin' }
  })
