import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { home, isOutcome } from '../../headers.ts'

/** Headers that name the software behind the site whatever their value. */
const NAMING = ['x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator', 'x-drupal-cache']
/** Headers that may name a host or platform, but not a version. */
const VERSIONED = ['server', 'via']

/** Response headers name no framework and no software version: `X-Powered-By: Next.js` and `Server: nginx/1.18.0` fail, `Server: Vercel` passes. */
export default async function serverLeak(ctx: Context): Promise<Outcome> {
  const page = await home(ctx)
  if (isOutcome(page)) return page
  const leaks: string[] = []
  for (const name of NAMING) {
    const value = page.headers.get(name)
    if (value) leaks.push(`${name}: ${value}`)
  }
  for (const name of VERSIONED) {
    const value = page.headers.get(name)
    // nginx/1.18.0, Apache/2.4.41 (Ubuntu), PHP/8.1; a bare HTTP version in Via ("1.1 vegur") is not software's
    const stripped = name === 'via' ? value?.replace(/(^|,\s*)(HTTP\/)?\d\.\d\s+/gi, '$1') : value
    if (value && stripped && /[a-z][\w.-]*\/\d|\b\d+\.\d+(\.\d+)?\b/i.test(stripped)) leaks.push(`${name}: ${value}`)
  }
  if (leaks.length > 0) return { state: 'fail', evidence: `the home page's response names its software: ${leaks.join('; ')}` }
  const server = page.headers.get('server')
  return { state: 'pass', evidence: `no X-Powered-By or version banner${server ? ` (Server: ${server})` : ''}` }
}
