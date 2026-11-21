import type { Context } from '../../../../core/checks/context.ts'
import { hasDirective, perApp, withoutComments } from '../../next.ts'

const EXT = '(tsx|jsx|ts|js)'
const BOUNDARY = new RegExp(`(^|/)(error|global-error)\\.${EXT}$`)

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const prefix = app.root ? `${app.root}/` : ''
    const dir = [`${prefix}src/app/`, `${prefix}app/`].find(dir => app.appFiles.some(path => path.startsWith(dir)))
    if (!dir) return { pass: 'no app/ router' }
    const at = (name: string) => app.appFiles.find(path => new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${name}\\.${EXT}$`).test(path))
    const problems: string[] = []
    const notFound = at('not-found') ?? at('global-not-found')
    if (!notFound) problems.push(`no ${dir}not-found (or global-not-found): unmatched URLs get the default 404`)
    const globalError = at('global-error')
    if (!globalError) problems.push(`no ${dir}global-error: an error in the root layout shows the bare default page`)
    else {
      const text = withoutComments((await co.read(globalError)) ?? '')
      if (!(/<html[\s>]/.test(text) && /<body[\s>]/.test(text))) problems.push(`${globalError} renders no <html> and <body>`)
    }
    for (const path of app.appFiles.filter(path => BOUNDARY.test(path))) {
      if (!hasDirective((await co.read(path)) ?? '', /^use client$/)) problems.push(`${path} isn't a Client Component ('use client')`)
    }
    if (problems.length > 0) return { fail: problems.join('; ') }
    return { pass: `${notFound} and ${globalError}` }
  })
