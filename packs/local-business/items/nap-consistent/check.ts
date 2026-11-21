import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { brandOf, footerOf, fold, hasAddress, isLocalBusiness, jsonLd, locationPage, pathOf, phonesIn, samePhone, some, survey, textOf, typesOf, unreachable } from '../../shared.ts'

const ORGANIZATIONS = /^(Organization|Corporation|LocalBusiness)$/

/**
 * The visible text a site states its name, address and phone in: the home page's footer, the contact page, and each
 * location's own page.
 */
async function statedText(found: NonNullable<Awaited<ReturnType<typeof survey>>>, ctx: Context) {
  const brand = brandOf(ctx)
  const parts = [(await footerOf(found.home.html)) ?? (await textOf(found.home.html))]
  if (found.contact) parts.push(await textOf(found.contact.html))
  for (const place of found.locations) {
    const { page } = await locationPage(place, found, brand)
    if (page && page !== found.contact) parts.push(await textOf(page.html))
  }
  return parts.join('\n')
}

export default async function napConsistent(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const found = await survey(ctx)
  if (!found) return unreachable(ctx)
  const read = some([found.home, found.contact].filter(Boolean).map(p => pathOf(p!.final)), 3, ', ')

  // the business's own name and phone: Organization or LocalBusiness nodes on the home and contact pages
  const names = new Set<string>()
  const phones: { phone: string; whose: string }[] = []
  for (const source of [found.home, found.contact]) {
    if (!source) continue
    for (const node of (await jsonLd(source.html)).nodes) {
      const own = isLocalBusiness(node) || typesOf(node).some(type => ORGANIZATIONS.test(type))
      if (own && typeof node.name === 'string' && node.name.trim()) names.add(node.name.trim())
      if (own && typeof node.telephone === 'string' && node.telephone.trim()) phones.push({ phone: node.telephone, whose: node.name ? String(node.name).trim() : 'the business' })
    }
  }
  for (const place of found.locations) if (place.telephone) phones.push({ phone: place.telephone, whose: place.name })
  if (phones.length === 0 && found.locations.length === 0) {
    const only = names.size ? `the JSON-LD gives only a name (${[...names].map(name => `"${name}"`).join(', ')}), no address or phone` : `no Organization or LocalBusiness JSON-LD`
    return { state: 'fail', evidence: `${only} on ${read} to compare with the text; see local-business/locations-schema` }
  }

  const text = await statedText(found, ctx)
  const shown = phonesIn(text)
  const folded = ` ${fold(text)} `
  const problems: string[] = []
  const missingNames = [...names].filter(name => !folded.includes(` ${fold(name)} `))
  if (missingNames.length) problems.push(`the name ${missingNames.map(name => `"${name}"`).join(', ')} isn't in the text`)
  const seen: string[] = []
  for (const { phone, whose } of phones) {
    if (seen.some(other => samePhone(other, phone))) continue
    seen.push(phone)
    if (!shown.some(other => samePhone(other, phone))) problems.push(`the phone ${phone} (${whose}) isn't in the text${shown.length ? `, which shows ${some(shown, 3, ', ')}` : ''}`)
  }
  const unshown = found.locations.filter(place => place.street && !hasAddress(text, place))
  if (unshown.length) {
    problems.push(`${unshown.length} of ${found.locations.length} JSON-LD addresses aren't in the text: ${some(unshown.map(place => `${place.name}: ${place.street}`), 3, ', ')}`)
  }

  const compared = `${names.size} name${names.size === 1 ? '' : 's'}, ${seen.length} phone${seen.length === 1 ? '' : 's'}, ${found.locations.length} address${found.locations.length === 1 ? '' : 'es'} from JSON-LD, against the footer, contact and location pages`
  if (problems.length) return { state: 'fail', evidence: `${some(problems, 4)} (${compared})` }
  return { state: 'pass', evidence: `the JSON-LD's name, phone and addresses are all in the visible text (${compared})` }
}
