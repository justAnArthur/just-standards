import type { Context } from '../../../../core/checks/context.ts'
import { resolve } from '../../../../core/checks/http.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'
import { isOutcome, oneLanguage, siteOf } from '../../locales.ts'

/** Locale prefixes no site has: `xx` is no language, `ZZ` no region. */
export const MADE_UP = ['/xx/', '/zz-ZZ/']

/** A made-up locale prefix answers 404: a route that renders any `[locale]` makes endless duplicate pages, or crashes. */
export default async function unknownLocale(ctx: Context): Promise<Outcome> {
  const site = await siteOf(ctx)
  if (isOutcome(site)) return site
  const single = oneLanguage(site)
  if (single) return single
  const problems: string[] = []
  const answers: string[] = []
  for (const path of MADE_UP) {
    const url = resolve(path, ctx.asset.url as string)
    let response: Response
    try {
      response = await get(url)
    } catch (error) {
      return { state: 'error', evidence: `${url} did not respond (${(error as Error).message})` }
    }
    await response.body?.cancel()
    const blocked = challenged(response)
    if (blocked) return { state: 'error', evidence: `${path}: ${blocked}` }
    const where = response.url && response.url !== url ? ` (redirected to ${new URL(response.url).pathname})` : ''
    answers.push(`${path} ${response.status}`)
    if (response.status === 404 || response.status === 410) continue
    if (response.status === 200) problems.push(`${path} answered 200${where}: a page in a language the site doesn't have`)
    else problems.push(`${path} answered ${response.status}${where}, expected 404`)
  }
  if (problems.length > 0) return { state: 'fail', evidence: problems.join('; ') }
  return { state: 'pass', evidence: `${answers.join(', ')}: an unknown locale is a 404` }
}
