import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { type Checkout, type NextApp, perApp } from '../../next.ts'

const registry = () => process.env.STANDARDS_NPM_REGISTRY ?? 'https://registry.npmjs.org'

let latest: Promise<string> | undefined

/** `next`'s latest release on npm, read once per process. */
function latestNext() {
  latest ??= get(`${registry()}/next/latest`).then(async response => {
    if (!response.ok) throw new Error(`the npm registry answered ${response.status} for next/latest`)
    return ((await response.json()) as { version: string }).version
  })
  return latest
}

/** The range in package.json, or the pnpm catalog entry it points at (`catalog:`, `catalog:<name>`). */
async function rangeOf(app: NextApp, co: Checkout) {
  const range = app.next
  if (!range?.startsWith('catalog:')) return range
  const workspace = Bun.YAML.parse((await co.read('pnpm-workspace.yaml')) ?? '{}') as {
    catalog?: Record<string, string>
    catalogs?: Record<string, Record<string, string>>
  } | null
  const name = range.slice('catalog:'.length)
  return (name && name !== 'default' ? workspace?.catalogs?.[name] : workspace?.catalog)?.next
}

const major = (range: string) => Number(range.match(/\d+/)?.[0])

export default async function frameworkCurrent(ctx: Context): Promise<Outcome> {
  let newest: string
  try {
    newest = await latestNext()
  } catch (error) {
    latest = undefined
    return { state: 'error', evidence: `can't read the latest next from the npm registry: ${(error as Error).message}` }
  }
  return perApp(
    ctx,
    async (app, co) => {
      const range = await rangeOf(app, co)
      if (!range) return { fail: `${app.root ? `${app.root}/` : ''}package.json doesn't name a next version` }
      if (/^(latest|canary|rc|beta)$/.test(range)) return { pass: `next@${range}, latest ${newest}` }
      if (Number.isNaN(major(range))) return { fail: `can't read a version from next "${range}"` }
      const behind = major(newest) - major(range)
      if (behind > 1) return { fail: `next ${range} is ${behind} majors behind the latest ${newest}` }
      return { pass: `next ${range}, latest ${newest}` }
    },
    { remote: true },
  )
}
