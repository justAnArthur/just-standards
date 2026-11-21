import type { Page } from 'playwright-core'
import type { Visit } from '../../../../core/browser.ts'
import type { Context } from '../../../../core/checks/context.ts'
import { dismissConsent } from '../../../../core/consent.ts'
import type { Outcome } from '../../../../core/schema.ts'

/** What skip links say, in the site languages: "skip to content", "preskočiť na obsah", "zum Inhalt", "beint til innihald"… */
const SKIP = /skip|jump to|main content|to content|preskoč|prejsť na|na obsah|hlavn\S* obsah|přeskoč|zum inhalt|inhalt springen|zum hauptinhalt|beint til|til innihald|hop til|aller au contenu|ir al contenido|vai al contenuto|przejdź do|ugrás/i

/** Where skip links point when their text is an icon or another language. */
const TO_CONTENT = /^#(main|content|main-?content|obsah|inhalt|innihald|page|primary)/i

/** A cookie banner first in the tab order is closed, as a visitor would, before the first Tab. */
export async function probe(page: Page) {
  const dismissed = await dismissConsent(page)
  return dismissed ? { dismissed: dismissed.text } : {}
}

/** One of the first Tab stops is a same-page link that says it skips, points at an element that exists, and shows when focused. */
export default async function skipLink([visit]: Visit[], _ctx: Context): Promise<Outcome> {
  const stops = (visit?.keyboard ?? []).filter(stop => !stop.none)
  const first = stops[0]
  if (!first) return { state: 'fail', evidence: 'Tab focuses nothing on the page' }
  const skip = stops.slice(0, 2).find(stop => stop.tag === 'a' && stop.href?.startsWith('#') && (SKIP.test(stop.text) || TO_CONTENT.test(stop.href)))
  const said = `the first Tab stop is "${first.text || first.href || first.tag}" (${first.tag}${first.href ? ` → ${first.href}` : ''})`
  if (!skip) return { state: 'fail', evidence: `no skip link: ${said}` }
  if (skip.anchorTarget === false) return { state: 'fail', evidence: `the skip link "${skip.text}" points at ${skip.href}, which no element on the page has as its id` }
  if (!skip.shown) return { state: 'fail', evidence: `the skip link "${skip.text}" stays hidden when focused` }
  return { state: 'pass', evidence: `skip link "${skip.text}" → ${skip.href}, visible when focused` }
}
