import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { home, isOutcome, metaCsp, parseCsp, scriptProblem } from '../../headers.ts'

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
    const how = scripts.some(source => /^'(nonce|sha)/.test(source)) ? 'with nonces or hashes' : 'to listed sources'
    return { state: 'pass', evidence: `${where} restricts scripts ${how}${header && meta.length ? ' (and a <meta> policy too)' : ''}` }
  }
  return { state: 'fail', evidence: `${where} is sent, but ${problems[0]}` }
}
