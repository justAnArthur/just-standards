import type { Context } from '../../../../core/checks/context.ts'
import { codeOf, listed, perPayloadApp } from '../../payload.ts'

const RENDER_PATH = /['"]@justanarthur\/payload-www['"]\s*:\s*\{\s*path\s*:\s*['"]([^'"]+)['"]/g

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    const maps = app.files.filter(path => /(^|\/)(async)?[iI]mportMap\.(js|ts)$/.test(path))
    if (maps.length === 0) return { fail: 'no generated importMap is committed: run payload generate:importmap' }
    const text = (await Promise.all(maps.map(path => co.read(path)))).join('\n')
    const missing: string[] = []
    let paths = 0
    for (const path of codeOf(app)) {
      for (const match of ((await co.read(path)) ?? '').matchAll(RENDER_PATH)) {
        paths++
        const target = (match[1] as string).split('#')[0] as string
        if (!text.includes(target)) missing.push(`${target} (${path})`)
      }
    }
    if (missing.length > 0) return { fail: `${missing.length} render paths missing from the import map: ${listed(missing)}` }
    return { pass: `${paths} render paths, all in ${maps.join(', ')}` }
  })
