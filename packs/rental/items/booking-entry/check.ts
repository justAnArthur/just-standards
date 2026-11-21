import type { Context } from '../../../../core/checks/context.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { pathOf, statusOf } from '../../../eu-consumer/links.ts'
import { textOf, unreachable } from '../../../local-business/shared.ts'
import { homeOf } from '../../shared.ts'

/** Words of a booking or search link, by its text. */
export const BOOK =
  /rezerv|\bbook|reserv|hľadaj|vyhľadaj|vyhladaj|hladaj|nájdi|nájsť|find (a )?(car|cars|vehicle|van)|search|objedna|buchen|suchen|bílleig|bóka|leig bil|finn bil|søg|bestil|zarezerw|szukaj|foglal|vybrať auto|zobraziť (autá|vozidlá|ponuku)/i
/** Paths of a booking flow. */
export const BOOK_PATH = /rezervac|reservation|booking|\/book\b|buchung|reserv|\/search|vyhladav/i
/** Links into an existing booking, or posts about booking, not into a new one. */
const NOT_BOOKING = /manage|sprava|správa|moja rezerv|my booking|môj|invoice|faktúr|cancel|zrušiť|depozit|deposit|\/(blogs?|aktuality|news|clanky?|faq)\//i

/** Words that name a pick-up place and a date field, in an input's attributes or labels, or in the form's visible text. */
const PLACE = /pick-?\s?up|location|miesto|pobočk|pobock|vyzdvih|station|abhol|stanica|odkiaľ|where|lieu|lugar|stað|place/i
const DATE = /date|dátum|datum|termín|termin|\bod\b|from|\bdo\b|until|kedy|vyzdvihnutie|return|vrátenie|datum|dato|dagfesting|when/i

/** A booking form on the page: an element with a pick-up place field and a date field (inputs, selects, or a widget's labels). */
export async function bookingForm(html: string) {
  const fields = await select(html, 'input, select, textarea, button[aria-haspopup], [role="combobox"], label')
  const said = fields.map(field => [field.attrs.name, field.attrs.id, field.attrs.placeholder, field.attrs['aria-label'], field.attrs.type, field.text].filter(Boolean).join(' '))
  const dated = fields.some(field => /^(date|datetime-local)$/i.test(field.attrs.type ?? '')) || said.some(text => DATE.test(text))
  const placed = said.some(text => PLACE.test(text))
  if (placed && dated) return 'a booking form with pick-up place and date fields'
  // a widget built of buttons and listboxes says "Pick-up location" and "Date from" in its visible text
  const text = await textOf(html)
  const head = text.slice(0, 4000)
  if (/pick-?up location|miesto (vyzdvihnutia|prevzatia)|pobočka (vyzdvihnutia|prevzatia)|abholort|abholung/i.test(head) && /date from|dátum (od|vyzdvihnutia|prevzatia)|pick-?up date|abholdatum|date to|choose a date|vyberte dátum/i.test(head)) {
    return 'a booking search with pick-up place and date fields'
  }
  return undefined
}

export default async function bookingEntry(ctx: Context): Promise<Outcome> {
  if (!ctx.asset.url) return { state: 'error', evidence: `asset ${ctx.asset.id} has no url` }
  const home = await homeOf(ctx)
  if (!home) return unreachable(ctx)

  const form = await bookingForm(home.page.html)
  // booking engines may live on another host, so every link counts, by its text or its path
  const ctas = home.links.filter(link => !NOT_BOOKING.test(`${link.text} ${pathOf(link.href)}`) && (BOOK.test(link.text) || BOOK_PATH.test(pathOf(link.href))))
  // a link into the booking flow by its path first, then one that only says "book"
  const ranked = [...ctas.filter(link => BOOK_PATH.test(pathOf(link.href))), ...ctas]
  const distinct = [...new Map(ranked.map(link => [link.href, link])).values()].slice(0, 4)
  const statuses = await Promise.all(distinct.map(link => statusOf(link.href)))
  const working = distinct.filter((_, i) => statuses[i] === 200)
  const broken = distinct.map((link, i) => `"${link.text || pathOf(link.href)}" → ${pathOf(link.href)} answers ${statuses[i] || 'nothing'}`).filter((_, i) => statuses[i] !== 200)

  const cta = working[0] && `the link "${working[0].text || pathOf(working[0].href)}" → ${working[0].href} answers 200`
  if (form || cta) {
    const also = broken.length ? `; but ${broken.join(', ')}` : ''
    return { state: 'pass', evidence: `the home page as served carries ${[form, cta].filter(Boolean).join(', and ')}${also}` }
  }
  if (broken.length) return { state: 'fail', evidence: `the home page's booking links don't work: ${broken.join(', ')}; and no booking form with place and date fields` }
  return { state: 'fail', evidence: `the home page as served (${pathOf(home.page.final)}) has no booking form with pick-up place and date fields, and no book or search link` }
}
