import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import { ORG_PLUGINS, perPayloadApp, TOOLKIT } from '../../payload.ts'

const registry = () => process.env.STANDARDS_NPM_REGISTRY ?? 'https://registry.npmjs.org'
const latest = new Map<string, Promise<string | undefined>>()

/** A package's latest version on npm, read once per process; undefined when the registry doesn't answer. */
function latestOf(name: string) {
  if (!latest.has(name)) {
    latest.set(
      name,
      get(`${registry()}/${name}/latest`)
        .then(async response => (response.ok ? ((await response.json()) as { version: string }).version : undefined))
        .catch(() => undefined),
    )
  }
  return latest.get(name) as Promise<string | undefined>
}

const minorOf = (version: string) => version.match(/\d+\.\d+/)?.[0]
const exact = (range: string) => range.match(/\d+\.\d+\.\d+/)?.[0]

export default (ctx: Context) =>
  perPayloadApp(
    ctx,
    async app => {
      const problems: string[] = []
      for (const name of [TOOLKIT, ...ORG_PLUGINS].filter(name => app.deps[name])) {
        const newest = await latestOf(name)
        const used = exact(app.deps[name] as string)
        if (!newest || !used) continue
        if (minorOf(used) !== minorOf(newest) && Bun.semver.order(used, newest) < 0) problems.push(`${name} ${app.deps[name]} (latest ${newest})`)
      }
      const payload = exact(app.deps.payload as string)
      const apart = Object.entries(app.deps).filter(([name, range]) => name.startsWith('@payloadcms/') && exact(range) && exact(range) !== payload)
      if (apart.length > 0) problems.push(`${apart.map(([name, range]) => `${name} ${range}`).join(', ')} differ from payload ${app.deps.payload}`)
      if (problems.length > 0) return { fail: `behind or apart: ${problems.join('; ')}` }
      return { pass: `payload ${app.deps.payload} with matching @payloadcms/*, org packages on their latest minor` }
    },
    { remote: true },
  )
