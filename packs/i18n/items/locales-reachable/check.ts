import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'
import { isOutcome, langOf, type Locale, oneLanguage, primary, siteOf } from '../../locales.ts'

/** What's wrong with a locale's home, or undefined when it answers 200 in its own language; `blocked` when the firewall answered. */
async function problemOf(locale: Locale): Promise<string | { blocked: string } | undefined> {
  let response: Response
  try {
    response = await get(locale.home)
  } catch (error) {
    return `${locale.code} (${locale.home}, from ${locale.via.join(', ')}) did not respond (${(error as Error).message})`
  }
  const blocked = challenged(response)
  if (blocked) {
    await response.body?.cancel()
    return { blocked }
  }
  const where = response.url && response.url !== locale.home ? ` (redirected to ${response.url})` : ''
  if (response.status !== 200) {
    await response.body?.cancel()
    return `${locale.code} (${locale.home}, from ${locale.via.join(', ')}) answered ${response.status}${where}`
  }
  const lang = /html/.test(response.headers.get('content-type') ?? '') ? await langOf(await response.text()) : undefined
  if (lang && primary(lang) !== locale.language) return `${locale.code} (${locale.home}) serves a page in <html lang="${lang}">${where}`
}

/** Every language the home page declares (its lang, hreflang alternates, switcher links) has a home that answers 200 in it. */
export default async function localesReachable(ctx: Context): Promise<Outcome> {
  const site = await siteOf(ctx)
  if (isOutcome(site)) return site
  const single = oneLanguage(site)
  if (single) return single
  const answers = await Promise.all(site.locales.map(problemOf))
  const blocked = answers.find(answer => typeof answer === 'object')
  if (blocked) return { state: 'error', evidence: blocked.blocked }
  const problems = answers.filter(Boolean)
  const codes = site.locales.map(locale => locale.code).join(', ')
  if (problems.length > 0) return { state: 'fail', evidence: `${problems.join('; ')} (declared: ${codes})` }
  return { state: 'pass', evidence: `${site.locales.map(locale => `${locale.code} ${new URL(locale.home).pathname}`).join(', ')}: each answers 200 in its language` }
}
