import { lookup } from 'node:dns/promises'
import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

/** Permanent redirects: 308 is what Vercel and Next send, and a crawler reads it like a 301. */
const PERMANENT = [301, 308]

// Second-level labels under which a registrable domain has three labels: example.co.uk, example.com.au.
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'])

/** The host's other name, `www.` added or removed; undefined for a subdomain (`app.example.com`, `me.github.io`), which has none. */
export function otherHost(host: string) {
  if (host.startsWith('www.')) return host.slice(4)
  const labels = host.split('.')
  const apex = labels.length === 2 || (labels.length === 3 && SECOND_LEVEL.has(labels[1] as string))
  return apex ? `www.${host}` : undefined
}

/**
 * How many redirects an alias may take: one when it differs from the canonical origin in the host or the scheme alone; two when
 * it differs in both, since `http://example.com` → `https://example.com` → `https://www.example.com` is what HSTS preloading asks for.
 */
const allowedHops = (alias: URL, canonical: URL) => (alias.protocol !== canonical.protocol && alias.hostname !== canonical.hostname ? 2 : 1)

interface Hop {
  status: number
  location?: string
}

/** The redirects from `url` until one lands on `origin`, stopping after `limit + 1`; `error` when a request gets no answer. */
async function follow(url: string, origin: string, limit: number) {
  const chain: Hop[] = []
  let current = url
  while (chain.length <= limit) {
    let response: Response
    try {
      response = await get(current, { redirect: 'manual' })
    } catch (error) {
      return { chain, reached: false, error: `${current}: ${(error as Error).message}` }
    }
    await response.body?.cancel()
    const location = response.headers.get('location') ?? undefined
    chain.push({ status: response.status, location })
    if (response.status < 300 || response.status >= 400 || !location) return { chain, reached: false }
    current = new URL(location, current).href
    if (new URL(current).origin === origin) return { chain, reached: true }
  }
  return { chain, reached: false }
}

const show = (chain: Hop[]) => chain.map(hop => `${hop.status}${hop.location ? ` → ${hop.location}` : ''}`).join(', ')

/** One problem with an alias, or undefined when it reaches the canonical origin through permanent redirects in its hops. */
async function judgeAlias(alias: string, canonical: URL): Promise<string | { dns: true; problem: string } | undefined> {
  const limit = allowedHops(new URL(alias), canonical)
  const { chain, reached, error } = await follow(alias, canonical.origin, limit)
  const first = chain[0]
  if (!first) {
    const host = new URL(alias).hostname
    const resolves = await lookup(host).then(() => true, () => false)
    if (!resolves) return { dns: true, problem: `${host} does not resolve: add a DNS record for it and redirect it to ${canonical.origin}` }
    return `${alias} does not answer (${error?.replace(`${alias}: `, '')}): it should redirect to ${canonical.origin}`
  }
  if (first.status === 200) return `${alias} answers 200 as well as ${canonical.origin}: the same site on two hosts`
  if (!reached) return `${alias} does not reach ${canonical.origin}${error ? ` (${error})` : ''}: ${show(chain)}`
  if (chain.length > limit) return `${alias} takes ${chain.length} redirects to reach ${canonical.origin}, at most ${limit}: ${show(chain)}`
  if (chain.some(hop => !PERMANENT.includes(hop.status))) return `${alias} redirects temporarily (${show(chain)}): use 301 or 308`
}

/**
 * `start`, after its redirects, lands on the one origin that answers 200 (the canonical one); every alias on another origin
 * reaches it through permanent redirects, in one hop (two when both the scheme and the host change).
 */
export async function judgeHosts(start: string, aliases: string[]): Promise<Outcome> {
  let landed: Response
  try {
    landed = await get(start)
  } catch (error) {
    return { state: 'error', evidence: `${start} did not answer (${(error as Error).message})` }
  }
  await landed.body?.cancel()
  if (landed.status !== 200) return { state: 'fail', evidence: `${start} answered ${landed.status}, so no host serves the site` }
  const canonical = new URL(landed.url || start)

  const others = aliases.filter(alias => new URL(alias).origin !== canonical.origin)
  const problems: string[] = []
  // a host without DNS is named once, not once per scheme
  const unresolved = new Set<string>()
  for (const alias of others) {
    const host = new URL(alias).hostname
    if (unresolved.has(host)) continue
    const problem = await judgeAlias(alias, canonical)
    if (typeof problem === 'object') unresolved.add(host)
    if (problem) problems.push(typeof problem === 'object' ? problem.problem : problem)
  }
  if (problems.length > 0) return { state: 'fail', evidence: problems.join('; ') }
  const redirect = others.length === 1 ? 'redirects' : 'redirect'
  return { state: 'pass', evidence: `${canonical.href} answers 200; ${others.join(', ')} ${redirect} to it permanently` }
}

export default async function canonicalHost({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const { hostname, pathname, search } = new URL(asset.url)
  const hosts = [hostname, otherHost(hostname)].filter(host => host !== undefined)
  const urls = (scheme: string) => hosts.map(host => `${scheme}://${host}${pathname}${search}`)
  return judgeHosts(asset.url, [...urls('https'), ...urls('http')])
}
