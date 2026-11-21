// The pages the ai-visibility AI checks read, found from the home page's links. The link reading is shared with eu-consumer.
import { htmlOf, hostOf, linksOf, pick, CONTACT, TERMS } from '../eu-consumer/links.ts'

export { askAbout } from '../eu-consumer/links.ts'

export const FAQ = /\bfaq\b|často kladené|časté otázky|otázky a odpovede|frequently asked|questions|häufige fragen|spurningar|ofte stillede/
export const PRICING = /cenník|\bceny\b|pricing|\bprices\b|preise|prísir|priser/
const RENTAL_TERMS = /podmien\S* prenájm|rental (terms|conditions)|conditions of (hire|rental)|mietbedingung|leigutreyt|lejebetingelser/

export interface Found {
  home: string
  html: string
  contact?: string
  faq?: string
  terms?: string
  pricing?: string
}

/** The home page (after redirects) and the contact, FAQ, rental terms and pricing pages it links on its own site. */
export async function findPages(url: string): Promise<Found | undefined> {
  const home = await htmlOf(url)
  if (!home) return undefined
  const links = await linksOf(home.html, home.final)
  const host = hostOf(home.final)
  return {
    home: home.final,
    html: home.html,
    contact: pick(links, [CONTACT], host),
    faq: pick(links, [FAQ], host),
    terms: pick(links, [RENTAL_TERMS, ...Object.values(TERMS)], host),
    pricing: pick(links, [PRICING], host),
  }
}

const MAX_JSON_LD = 8_000

/** The page's JSON-LD blocks, which the HTML the AI reads leaves out with the other scripts. */
export async function jsonLdOf(html: string) {
  const blocks: string[] = []
  let open = false
  await new HTMLRewriter()
    .on('script[type="application/ld+json"]', {
      element(element) {
        blocks.push('')
        open = true
        element.onEndTag(() => void (open = false))
      },
      text(chunk) {
        if (open) blocks[blocks.length - 1] += chunk.text
      },
    })
    .transform(new Response(html))
    .text()
  return blocks.map(block => block.trim()).filter(Boolean)
}

/** The JSON-LD of the pages, as a prompt section; empty when there is none. */
export async function jsonLdSection(pages: { url: string; html: string }[]) {
  const parts: string[] = []
  for (const page of pages) for (const block of await jsonLdOf(page.html)) parts.push(`On ${page.url}:\n${block}`)
  if (parts.length === 0) return 'The pages carry no JSON-LD.'
  const all = parts.join('\n\n')
  const cut = all.length > MAX_JSON_LD ? `${all.slice(0, MAX_JSON_LD)}\n(cut at ${MAX_JSON_LD} characters)` : all
  return `The JSON-LD the pages carry (the HTML below leaves scripts out):\n\n\`\`\`json\n${cut}\n\`\`\``
}
