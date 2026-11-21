// What the security items share: the home page's response, and Content-Security-Policy read into directives.
import type { Context } from '../../core/checks/context.ts'
import { get } from '../../core/expect.ts'
import type { Outcome } from '../../core/schema.ts'
import { challenged } from '../firewall.ts'

export interface Home {
  url: string
  status: number
  headers: Headers
  html: string
}

/** The home page as served (after redirects), or the outcome to return when it can't be read. */
export async function home({ asset }: Context): Promise<Home | Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let response: Response
  try {
    response = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  const blocked = challenged(response)
  if (blocked) return { state: 'error', evidence: blocked }
  if (response.status >= 500) return { state: 'error', evidence: `${asset.url} answered ${response.status}` }
  return { url: response.url || asset.url, status: response.status, headers: response.headers, html: await response.text() }
}

export const isOutcome = (value: unknown): value is Outcome => typeof value === 'object' && value !== null && 'state' in value

/** One policy: directive name → its sources, lowercased (nonces and hashes keep their case). */
export type Policy = Map<string, string[]>

/**
 * The policies of a CSP header value. Several headers arrive joined by `, `, and each is enforced on its own, so a resource
 * must pass every policy.
 */
export function parseCsp(value: string | null | undefined): Policy[] {
  if (!value) return []
  return value
    .split(',')
    .map(policy => {
      const directives: Policy = new Map()
      for (const part of policy.split(';')) {
        const [name, ...sources] = part.trim().split(/\s+/)
        // the first occurrence of a directive wins (CSP3 §2.2.1)
        if (name && !directives.has(name.toLowerCase())) {
          directives.set(
            name.toLowerCase(),
            sources.map(source => (/^'(nonce|sha\d+)-/i.test(source) ? source : source.toLowerCase())),
          )
        }
      }
      return directives
    })
    .filter(policy => policy.size > 0)
}

/** The CSP of `<meta http-equiv="Content-Security-Policy">`: enforced, but without frame-ancestors, report-uri or sandbox. */
export function metaCsp(html: string) {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html.slice(0, 20_000)
  const tags = head.match(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi) ?? []
  return tags.map(tag => tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i)).flatMap(match => (match ? [match[1] ?? match[2] ?? ''] : []))
}

/** What's wrong with how one policy restricts scripts, or undefined when it does. */
export function scriptProblem(policy: Policy): string | undefined {
  const name = policy.has('script-src') ? 'script-src' : policy.has('default-src') ? 'default-src' : undefined
  if (!name) return 'no script-src or default-src, so it restricts no scripts'
  const sources = policy.get(name) as string[]
  // With a nonce or a hash, browsers ignore 'unsafe-inline'; with 'strict-dynamic', also host and scheme sources.
  const keyed = sources.some(source => /^'(nonce|sha(256|384|512))-/i.test(source))
  const dynamic = sources.includes("'strict-dynamic'")
  if (sources.includes("'unsafe-inline'") && !keyed) return `${name} allows 'unsafe-inline' without a nonce or hash, so any injected inline script runs`
  const open = sources.filter(source => ['*', 'http:', 'https:', 'data:'].includes(source))
  if (open.length > 0 && !(dynamic && keyed)) return `${name} allows ${open.join(' ')}, so a script from anywhere runs`
}

/** The frame-ancestors sources across the policies, or undefined when none sets it. */
export function frameAncestors(policies: Policy[]) {
  const found = policies.filter(policy => policy.has('frame-ancestors'))
  return found.length > 0 ? found.map(policy => policy.get('frame-ancestors') as string[]) : undefined
}
