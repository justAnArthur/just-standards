import type { Context } from '../../../../core/checks/context.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages } from '../../../seo/shared.ts'
import { EMAIL, type Page, pathOf, phonesIn, runsOf, samePhone, some, survey, unreachable } from '../../shared.ts'

/** Links a tap on which calls or messages the number. */
const CALLS = /^(tel|callto|sms):|^https?:\/\/(wa\.me|api\.whatsapp\.com|(www\.)?viber\.com)\//i

/** A tel: value as E.164 wants it: `+`, the country code and the number, with at most visual separators. */
export function telProblem(href: string) {
  let value = href.replace(/^tel:/i, '')
  try {
    value = decodeURIComponent(value)
  } catch {}
  value = value.replace(/;ext=\d+$/i, '')
  const bare = value.replace(/[\s().\-/]/g, '')
  if (/^\+[1-9]\d{6,14}$/.test(bare)) return undefined
  if (/^0\d{6,14}$/.test(bare)) return `${href} has no country code`
  return `${href} isn't a number (+ and digits)`
}

export interface Found {
  /** numbers in the text that no tel: link carries */
  phones: string[]
  emails: string[]
  /** tel: hrefs that won't dial */
  tels: string[]
}

/** What one page shows: numbers and addresses outside a tel:/mailto: link, and tel: values that aren't E.164. */
export async function scan(html: string): Promise<Found> {
  const runs = await runsOf(html)
  const phones: string[] = []
  const emails: string[] = []
  const tels = new Set<string>()
  for (const run of runs) {
    const href = run.href ?? ''
    if (/^tel:/i.test(href)) {
      const problem = telProblem(href)
      if (problem) tels.add(problem)
    }
    if (!CALLS.test(href)) for (const phone of phonesIn(run.text)) if (!phones.some(other => samePhone(other, phone))) phones.push(phone)
    if (!/^mailto:/i.test(href)) for (const email of run.text.match(EMAIL) ?? []) if (!emails.includes(email.toLowerCase())) emails.push(email.toLowerCase())
  }
  // a tel: href without its text in the page (an icon) still counts for problems, so read the hrefs too
  for (const link of await select(html, 'a[href]')) {
    const href = link.attrs.href ?? ''
    const problem = /^tel:/i.test(href) && telProblem(href)
    if (problem) tels.add(problem)
  }
  return { phones, emails, tels: [...tels] }
}

export default async function clickToCall(ctx: Context): Promise<Outcome> {
  const crawled = await htmlPages(ctx)
  if (!Array.isArray(crawled)) return crawled
  // a home page that answers 403 (a bot checkpoint) or 404 leaves nothing to read, which is not a pass
  const found = await survey(ctx)
  if (!found) return unreachable(ctx)
  const pages: Page[] = [...crawled]
  if (found?.contact && !pages.some(p => p.final === found.contact?.final)) pages.push(found.contact)

  // each number once, with the pages it's on
  const where = (list: Map<string, string[]>, key: string, path: string) => list.set(key, [...(list.get(key) ?? []), path])
  const phoneMap = new Map<string, string[]>()
  const emailMap = new Map<string, string[]>()
  const tels = new Set<string>()
  for (const page of pages) {
    const seen = await scan(page.html)
    const path = pathOf(page.final)
    for (const phone of seen.phones) where(phoneMap, [...phoneMap.keys()].find(other => samePhone(other, phone)) ?? phone, path)
    for (const email of seen.emails) where(emailMap, email, path)
    for (const tel of seen.tels) tels.add(tel)
  }
  const listed = (list: Map<string, string[]>) =>
    [...list].map(([key, paths]) => `${key} on ${paths[0]}${paths.length > 1 ? ` and ${paths.length - 1} more page${paths.length > 2 ? 's' : ''}` : ''}`)
  const phones = listed(phoneMap)
  const emails = listed(emailMap)
  const problems = [
    tels.size && `tel: links that won't dial: ${some([...tels], 3, ', ')}`,
    phones.length && `${phones.length} phone number${phones.length > 1 ? 's' : ''} not in a tel: link: ${some(phones, 3, ', ')}`,
    emails.length && `${emails.length} e-mail address${emails.length > 1 ? 'es' : ''} not in a mailto: link: ${some(emails, 3, ', ')}`,
  ].filter(Boolean)
  const sample = `${pages.length} page${pages.length > 1 ? 's' : ''}`
  if (problems.length) return { state: 'fail', evidence: `${problems.join('; ')} (${sample})` }
  return { state: 'pass', evidence: `every phone number shown is a tel: link in E.164 form and every e-mail a mailto: link (${sample})` }
}
