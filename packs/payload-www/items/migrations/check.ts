import type { Context } from '../../../../core/checks/context.ts'
import { perPayloadApp, withoutComments } from '../../payload.ts'

export default (ctx: Context) =>
  perPayloadApp(ctx, async (app, co) => {
    const config = withoutComments(app.config?.text ?? '')
    if (/\bpush\s*:\s*true\b/.test(config)) return { fail: `${app.config?.path} turns push on` }
    const migrations = app.files.filter(path => /(^|\/)migrations\/(?!index\.)[^/]+\.(ts|js)$/.test(path))
    if (migrations.length === 0) return { fail: 'no migrations folder is committed' }
    let scripts: Record<string, string> = {}
    try {
      scripts = (JSON.parse((await co.read(app.root ? `${app.root}/package.json` : 'package.json')) ?? '{}') as { scripts?: Record<string, string> }).scripts ?? {}
    } catch {}
    const runs = /\bprodMigrations\b/.test(config) || Object.values(scripts).some(script => /payload\s+migrate(\s|$|&|;)/.test(script))
    if (!runs) return { fail: `${migrations.length} migrations committed, but neither prodMigrations nor a script runs payload migrate before the build` }
    return { pass: `${migrations.length} committed migrations, run on deploy` }
  })
