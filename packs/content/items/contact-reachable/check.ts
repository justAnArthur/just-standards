import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import { decode } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages, quote, some, textNodes } from '../../shared.ts'

/** What a contact page is called, in the sites' languages, in a link's path or text. */
const CONTACT = /kontakt|contact|samband|kapcsolat|contatt|contacto|impressum|o-nas|about-us|um-okkum/i

/** Where the footer is: the element, its landmark role, or a container named after it. */
const FOOTER = 'footer, [role="contentinfo"], [id*="footer" i], [class*="footer" i]'

/**
 * A phone number written in international form: `+421 900 200 200`, `00421 2 2086 2620`, `+298 358800`. National forms
 * (`0900 …`) look too much like other numbers to tell apart.
 */
const PHONE = /(?<![\w+])(?<!\d[\s.\-/])(?:\+|00)[1-9]\d{0,2}(?:[\s.\-/]?\(?\d{1,4}\)?){2,6}(?![\w])/g

export interface Link {
  href: string
  text: string
  inFooter: boolean
}

/** Every link of the page, and whether it sits in the footer. */
export async function linksOf(html: string): Promise<Link[]> {
  const links: Link[] = []
  let footer = 0
  let open: Link | undefined
  await new HTMLRewriter()
    .on(FOOTER, {
      element(element) {
        if (element.selfClosing || !element.canHaveContent) return
        footer++
        element.onEndTag(() => void footer--)
      },
    })
    .on('a[href]', {
      element(element) {
        open = { href: (element.getAttribute('href') ?? '').trim(), text: element.getAttribute('aria-label') ?? '', inFooter: footer > 0 }
        links.push(open)
        if (element.canHaveContent) element.onEndTag(() => void (open = undefined))
      },
      text(chunk) {
        if (open) open.text += chunk.text
      },
    })
    .transform(new Response(html))
    .text()
  for (const link of links) link.text = decode(link.text).replace(/\s+/g, ' ').trim()
  return links
}

const isContact = (link: Link) => /^(tel|mailto):/i.test(link.href) || CONTACT.test(link.href) || CONTACT.test(link.text)

/** A tel: link a phone can dial: digits, an optional +, visual separators, an optional extension. */
export function dialable(href: string) {
  let number = href.replace(/^tel:/i, '')
  try {
    number = decodeURIComponent(number)
  } catch {}
  return /^\+?\d{4,15}(;ext=\d+|[,;pPwW]+[\d*#]*)*$/.test(number.replace(/[\s().\-/]/g, ''))
}

/** Phone numbers in the visible text that aren't inside a tel: link. */
export async function unlinkedPhones(html: string) {
  const withoutTel = html.replace(/<a\b[^>]*\bhref\s*=\s*["']?\s*tel:[\s\S]*?<\/a>/gi, '')
  const phones = (await textNodes(withoutTel)).flatMap(node => [...node.matchAll(PHONE)].map(match => match[0].trim()))
  // 8 to 15 digits: the length of a phone number with its country code
  return [...new Set(phones.filter(phone => (phone.match(/\d/g)?.length ?? 0) >= 8 && (phone.match(/\d/g)?.length ?? 0) <= 15))]
}

export async function problemsOf(html: string): Promise<string[]> {
  const links = await linksOf(html)
  const footer = links.filter(link => link.inFooter)
  const problems: string[] = []
  if (!(footer.length > 0 ? footer : links).some(isContact)) {
    const empty = (await textNodes(html)).length === 0 ? ': its body is empty as served, so the page exists only once JavaScript runs' : ''
    problems.push(footer.length > 0 ? 'the footer has no tel:, mailto: or contact link' : `no footer, and no tel:, mailto: or contact link on the page${empty}`)
  }
  for (const link of links.filter(link => /^tel:/i.test(link.href) && !dialable(link.href))) problems.push(`tel: link ${quote(link.href)} isn't a number a phone can dial`)
  for (const link of links.filter(link => /^mailto:/i.test(link.href) && !/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(link.href))) {
    problems.push(`mailto: link ${quote(link.href)} isn't an address`)
  }
  for (const phone of await unlinkedPhones(html)) problems.push(`${quote(phone)} is written out but not a tel: link`)
  return [...new Set(problems)]
}

/** Every sampled page's footer offers a way to reach the business, and phone numbers are links a phone can dial. */
export default async function contactReachable(ctx: Context): Promise<Outcome> {
  const pages = await htmlPages(ctx)
  if (!Array.isArray(pages)) return pages
  const failures: string[] = []
  for (const page of pages) for (const problem of await problemsOf(page.html)) failures.push(`${pathOf(page.url)}: ${problem}`)
  if (failures.length === 0) return { state: 'pass', evidence: `every page's footer links a phone, an e-mail or the contact page, and phone numbers are tel: links (${pages.length} pages)` }
  return { state: 'fail', evidence: `${some(failures)} (${pages.length} pages checked)` }
}
