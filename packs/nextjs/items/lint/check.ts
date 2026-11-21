import { dirname } from 'node:path'
import type { Context } from '../../../../core/checks/context.ts'
import { perApp, withoutComments } from '../../next.ts'

const ESLINT = /(^|\/)(eslint\.config\.(js|mjs|cjs|ts|mts|cts)|\.eslintrc(\.(js|cjs|json|yml|yaml))?)$/
const BIOME = /(^|\/)biome\.jsonc?$/
/** What says the Next.js rules are on: the shared config or the plugin, in flat or legacy form. */
const NEXT_RULES = /eslint-config-next|@next\/eslint-plugin-next|plugin:@next\/next|["']next(\/core-web-vitals|\/typescript)?["']/
const PACKAGE_IMPORT = /(?:from\s+|require\(\s*|extends\s*:\s*\[?\s*)['"]((?:@[\w.-]+\/)?[\w.-]+)[^'"]*['"]/g

/** The folders from the app up to the repo root: lint configs live in either. */
const upFrom = (root: string) => {
  const dirs = ['']
  for (let dir = root; dir && dir !== '.'; dir = dirname(dir)) dirs.push(dir)
  return dirs
}

export default (ctx: Context) =>
  perApp(ctx, async (app, co) => {
    const dirs = new Set(upFrom(app.root))
    const inScope = (path: string) => dirs.has(dirname(path) === '.' ? '' : dirname(path))
    const biome = co.files.filter(path => BIOME.test(path) && inScope(path))
    for (const path of biome) {
      const config = withoutComments((await co.read(path)) ?? '')
      if (/"linter"\s*:\s*\{[^}]*"enabled"\s*:\s*false/.test(config)) return { fail: `${path} turns Biome's linter off, and no other linter runs Next's rules` }
      return { pass: `${path}: Biome lints, with its Next.js rules on wherever next is a dependency` }
    }
    const eslint = co.files.filter(path => ESLINT.test(path) && inScope(path))
    const manifests = new Map<string, string>()
    for (const path of co.files.filter(path => /(^|\/)package\.json$/.test(path))) manifests.set(path, (await co.read(path)) ?? '')
    for (const path of eslint) {
      const text = withoutComments((await co.read(path)) ?? '')
      if (NEXT_RULES.test(text)) return { pass: `${path} uses eslint-config-next` }
      // a shared config from a workspace package that itself builds on eslint-config-next
      for (const [, name] of text.matchAll(PACKAGE_IMPORT)) {
        const shared = [...manifests.values()].find(manifest => manifest.includes(`"name": "${name}"`) || manifest.includes(`"name":"${name}"`))
        if (shared && /eslint-config-next|@next\/eslint-plugin-next/.test(shared)) return { pass: `${path} uses ${name}, which builds on eslint-config-next` }
      }
    }
    const manifest = manifests.get(app.root ? `${app.root}/package.json` : 'package.json') ?? ''
    if (/"eslintConfig"\s*:/.test(manifest) && NEXT_RULES.test(manifest)) return { pass: 'package.json eslintConfig uses eslint-config-next' }
    if (eslint.length > 0) return { fail: `${eslint.join(', ')} doesn't use eslint-config-next, so Next's own rules (no-img-element, no-sync-scripts, the hooks rules) don't run` }
    return { fail: 'no ESLint or Biome config: Next 16 no longer lints during the build, and no linter runs its rules' }
  })
