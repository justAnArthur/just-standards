import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { COMPLAINTS, htmlOf, langOf, legalLinks, linksOf, pathOf, PRIVACY, statusOf, TERMS, TERMS_HREF } from '../../links.ts'

const NOT_TERMS = new RegExp(`${Object.values(PRIVACY).map(pattern => pattern.source).join('|')}|cookie`)

/** The home page links the terms (or rental conditions, or the complaints procedure) in its language, and they answer 200. */
export default async function terms({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const home = await htmlOf(asset.url)
  if (!home) return { state: 'error', evidence: `${asset.url} did not answer 200` }
  const lang = langOf(home.html)
  const { named, also } = legalLinks(await linksOf(home.html, home.final), TERMS, TERMS_HREF, lang, NOT_TERMS)
  if (named.length === 0) {
    const elsewhere = also[0] ? `; it links "${also[0].text}", not in ${lang}` : ''
    return { state: 'fail', evidence: `the home page links no terms or rental conditions${lang ? ` in its language (${lang})` : ''}${elsewhere}` }
  }

  const checked = await Promise.all(named.slice(0, 6).map(async link => ({ ...link, status: await statusOf(link.href) })))
  const ok = checked.filter(link => link.status === 200)
  if (ok.length === 0) {
    return { state: 'fail', evidence: checked.map(link => `"${link.text}" ${link.href} answered ${link.status || 'nothing'}`).join('; ') }
  }
  const complaints = ok.some(link => COMPLAINTS.test(link.text)) ? '' : '; no separate complaints procedure is linked (it may be part of the terms)'
  const broken = checked.filter(link => link.status !== 200).map(link => `; "${link.text}" ${link.href} answered ${link.status || 'nothing'}`)
  const shown = ok.slice(0, 3).map(link => `"${link.text}" ${pathOf(link.href)}`)
  return { state: 'pass', evidence: `${shown.join(', ')} answer 200${complaints}${broken.join('')}` }
}
