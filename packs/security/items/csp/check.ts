import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { home, isOutcome, metaCsp, parseCsp, scriptProblem } from '../../headers.ts'

const nonceOf = (policy: Map<string, string[]>) =>
  (policy.get('script-src') ?? policy.get('default-src') ?? []).find(source => /^'nonce-/i.test(source))?.slice(7, -1)

/**
 * The page's own scripts that a nonce policy blocks: with a nonce in script-src, an inline script runs only with that
 * nonce, and under 'strict-dynamic' an external one does too. A prerendered page can't carry a per-request nonce, so
 * such a policy passes the header check and still stops every script. JSON data blocks don't run, so they don't count.
 */
function unmarked(html: string, policies: Map<string, string[]>[]) {
  const policy = policies.find(nonceOf)
  if (!policy) return undefined
  const nonce = nonceOf(policy)
  const strict = (policy.get('script-src') ?? policy.get('default-src') ?? []).includes("'strict-dynamic'")
  const tags = [...html.matchAll(/<script\b([^>]*)>/gi)].map(match => match[1] ?? '')
  const runs = tags.filter(attrs => !/\btype\s*=\s*["']?(application\/(ld\+)?json|importmap|text\/plain)/i.test(attrs))
  const missing = runs.filter(attrs => {
    if (/\bsrc\s*=/i.test(attrs) && !strict) return false
    return attrs.match(/\bnonce\s*=\s*["']?([^"'\s>]+)/i)?.[1] !== nonce
  })
  if (missing.length === 0) return undefined
  return `${missing.length} of the page's ${runs.length} scripts carry no matching nonce (served HTML that is prerendered can't carry a per-request one)`
}

/**
 * An enforced Content-Security-Policy that restricts scripts: no 'unsafe-inline' without nonces or hashes, no wildcard
 * script source. Report-Only blocks nothing, so it alone fails, with that said; framing is `frame-protection`'s.
 */
export default async function csp(ctx: Context): Promise<Outcome> {
  const page = await home(ctx)
  if (isOutcome(page)) return page
  const header = page.headers.get('content-security-policy')
  const meta = metaCsp(page.html)
  const enforced = [...parseCsp(header), ...meta.flatMap(parseCsp)]
  const where = header ? 'the Content-Security-Policy header' : 'a <meta http-equiv> policy'

  if (enforced.length === 0) {
    const reportOnly = parseCsp(page.headers.get('content-security-policy-report-only'))
    if (reportOnly.length > 0) {
      const problem = reportOnly.map(scriptProblem).find(Boolean)
      const ready = problem ? ` and would still be weak: ${problem}` : '; it holds scripts already, so it can be switched to enforcing'
      return { state: 'fail', evidence: `only Content-Security-Policy-Report-Only is sent, which blocks nothing${ready}` }
    }
    return { state: 'fail', evidence: `${page.url} sends no Content-Security-Policy` }
  }
  // Policies stack: a script must pass each, so one that holds scripts is enough.
  const problems = enforced.map(scriptProblem)
  if (problems.includes(undefined)) {
    const policy = enforced[problems.indexOf(undefined)]
    const scripts = policy?.get('script-src') ?? policy?.get('default-src') ?? []
    const blocked = unmarked(page.html, enforced)
    if (blocked) return { state: 'fail', evidence: `${where} holds scripts with a nonce, but ${blocked}: the browser blocks them, so the page breaks` }
    const how = scripts.some(source => /^'(nonce|sha)/.test(source)) ? 'with nonces or hashes' : 'to listed sources'
    return { state: 'pass', evidence: `${where} restricts scripts ${how}${header && meta.length ? ' (and a <meta> policy too)' : ''}` }
  }
  return { state: 'fail', evidence: `${where} is sent, but ${problems[0]}` }
}
