import type { Context } from '../../../../core/checks/context.ts'
import { readable } from '../../../../core/checks/ai.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlOf, linksOf, pathOf } from '../../../eu-consumer/links.ts'

/** What the link to the statement says, by text or by its path. */
const LINK = /accessib|a11y|prístupnos|pristupnos|přístupnost|barrierefrei|aðgengi|tilgængelighed|tilgaengelighed|accessibilit|accesibilidad|accessibilità|dostępnoś|akadálymentes|wcag/i
/** What makes a page a conformance statement: the standard or the law it is measured against. */
const STANDARD = /WCAG|EN\s?301\s?549|2019\/882|accessibility act|351\/2022|zákon\S* o prístupnosti|barrierefreiheitsstärkungsgesetz|\bBFSG\b|BITV/i

/** The home page links an accessibility statement that answers 200 and names WCAG, EN 301 549 or the EAA or its national law. */
export default async function accessibilityStatement({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const home = await htmlOf(asset.url)
  if (!home) return { state: 'error', evidence: `${asset.url} did not answer 200` }
  const links = (await linksOf(home.html, home.final)).filter(link => LINK.test(link.text) || LINK.test(pathOf(link.href)))
  if (links.length === 0) return { state: 'fail', evidence: `${home.final} links no accessibility statement` }
  const tried: string[] = []
  for (const link of links.slice(0, 3)) {
    const page = await htmlOf(link.href)
    if (!page) {
      tried.push(`${pathOf(link.href)} does not answer 200`)
      continue
    }
    const text = (await readable(page.html)).replace(/<[^>]+>/g, ' ')
    const standard = text.match(STANDARD)?.[0]
    if (standard) return { state: 'pass', evidence: `"${link.text || pathOf(link.href)}" → ${pathOf(page.final)}, which names ${standard}` }
    tried.push(`${pathOf(page.final)} names no standard (WCAG, EN 301 549, the EAA or its national law)`)
  }
  return { state: 'fail', evidence: `the accessibility link${links.length > 1 ? 's' : ''} on the home page: ${tried.join('; ')}` }
}
