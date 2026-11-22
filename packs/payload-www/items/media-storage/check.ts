import type { Context } from '../../../../core/checks/context.ts'
import { codeOf, perPayloadApp } from '../../payload.ts'

/** Payload's adapters, and the org's adapter for its self-hosted Openinary. */
const ADAPTER = /^(@payloadcms\/(storage-[\w-]+|payload-cloud)|@justanarthur\/payload-storage-openinary)$/

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    const adapters = Object.keys(app.deps).filter(name => ADAPTER.test(name))
    let uploads = false
    let used = false
    for (const path of codeOf(app)) {
      const text = (await co.read(path)) ?? ''
      if (/\bupload\s*:\s*(true|\{)/.test(text)) uploads = true
      if (/\b\w+Storage\s*\(|payloadCloudPlugin\s*\(|openinary\w*\s*\(/i.test(text)) used = true
    }
    if (!uploads) return { pass: 'no upload collection' }
    if (adapters.length === 0) return { fail: 'an upload collection stores files on the server disk: no storage adapter (Openinary for org sites, or @payloadcms/storage-*)' }
    if (!used) return { fail: `${adapters.join(', ')} is installed but no code sets it up` }
    return { pass: `uploads go through ${adapters.join(', ')}` }
  })
