import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import { decode } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'
import { quote } from '../../shared.ts'

/** Days into January when last year's notice still passes: a deploy over the holidays isn't a forgotten footer. */
const GRACE_DAYS = 14

export interface Notice {
  /** the notice as text */
  text: string
  /** the latest year it states */
  year?: number
  /** React's markers around an expression that rendered nothing: the year is filled in only by JavaScript */
  empty: boolean
}

const MARK = /©|&copy;|&#169;|&#xa9;|\(c\)|\bcopyright\b/gi
// where a notice ends: the end of its element, the start of the next block, or a line break
const END = /<\/(p|div|span|small|li|footer|section|td)>|<(p|div|li|ul|nav|section|footer)\b|<br\s*\/?>/i

/** The copyright notices of some HTML, in document order. One element holding "©" and "Copyright" is one notice. */
export function notices(html: string): Notice[] {
  const found: Notice[] = []
  let after = 0
  for (const match of html.matchAll(MARK)) {
    const at = match.index as number
    // in an attribute (`href="/copyright"`), not in the text
    if (at < after || html.lastIndexOf('<', at) > html.lastIndexOf('>', at)) continue
    const rest = html.slice(at, at + 400)
    const end = rest.search(END)
    const segment = end < 0 ? rest.slice(0, 200) : rest.slice(0, end)
    after = at + segment.length
    const text = decode(segment.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
    const years = [...text.matchAll(/\b(19[89]\d|20\d\d)\b/g)].map(year => Number(year[1]))
    found.push({ text, year: years.length ? Math.max(...years) : undefined, empty: /<!--\s*-->\s*<!--\s*-->/.test(segment) })
  }
  return found
}

/** The visible markup: no scripts, styles, head or comments other than React's empty `<!-- -->` markers. */
const visible = (html: string) =>
  (html.match(/<body[\s\S]*$/i)?.[0] ?? html)
    .replace(/<(script|style|template|noscript|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--(?!\s*-->)[\s\S]*?-->/g, '')

/** The notice that speaks for the site: the last one in the footer, else the last on the page; ones stating a year first. */
export function siteNotice(html: string) {
  const body = visible(html)
  const footers = body.match(/<footer\b[\s\S]*?<\/footer>/gi) ?? []
  const inFooter = footers.flatMap(notices)
  const candidates = inFooter.length > 0 ? inFooter : notices(body)
  return candidates.filter(notice => notice.year).at(-1) ?? candidates.find(notice => notice.empty) ?? candidates.at(-1)
}

export function judge(notice: Notice | undefined, now = new Date()): Outcome {
  if (!notice) return { state: 'pass', evidence: 'no copyright notice in the HTML as served' }
  const current = now.getUTCFullYear()
  if (notice.year === undefined) {
    if (notice.empty) {
      return { state: 'fail', evidence: `the notice ${quote(notice.text)} has an empty slot where the year goes: it is rendered only by JavaScript, so crawlers and the first paint show none` }
    }
    return { state: 'pass', evidence: `the notice ${quote(notice.text)} states no year` }
  }
  const january = now.getUTCMonth() === 0 && now.getUTCDate() <= GRACE_DAYS
  if (notice.year === current || (january && notice.year === current - 1)) return { state: 'pass', evidence: `${quote(notice.text)}` }
  if (notice.year > current) return { state: 'fail', evidence: `${quote(notice.text)} states ${notice.year}, a year that hasn't begun` }
  return { state: 'fail', evidence: `${quote(notice.text)} states ${notice.year}, not ${current}: the footer looks unmaintained` }
}

/** The copyright year on the home page is the current year, or a range ending in it. */
export default async function footerYear({ asset }: Context, now = new Date()): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let response: Response
  try {
    response = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  if (response.status !== 200) return { state: 'error', evidence: challenged(response) ?? `${asset.url} answered ${response.status}` }
  return judge(siteNotice(await response.text()), now)
}
