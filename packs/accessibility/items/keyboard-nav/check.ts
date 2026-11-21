import type { Page } from 'playwright-core'
import type { Focus, Visit } from '../../../../core/browser.ts'
import type { Context } from '../../../../core/checks/context.ts'
import { dismissConsent } from '../../../../core/consent.ts'
import type { Outcome } from '../../../../core/schema.ts'

declare const document: any, innerHeight: number, scrollY: number

const TARGETS = 20
const SHOWN = 4

interface Probe {
  /** the cookie banner's button clicked first, so Tab starts on the page itself */
  dismissed?: string
  targets: { id: string; tag: string; text: string }[]
  /** elements Tab can stop on */
  tabbable: number
}

/** In the page: marks what Tab must reach, the visible header links and buttons and the form controls of the first two screens. */
function markTargets(max: number) {
  const shown = (el: any) =>
    !el.closest('[inert],[aria-hidden=true]') && !el.disabled && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
    el.getBoundingClientRect().width > 1
  const header = [...document.querySelectorAll('header a[href], nav a[href], header button, [role=banner] a[href], [role=banner] button')]
  const forms = [...document.querySelectorAll('main input:not([type=hidden]), main select, main textarea, main button, form input:not([type=hidden]), form select, form textarea')].filter(
    (el: any) => el.getBoundingClientRect().top + scrollY < innerHeight * 2,
  )
  const seen = new Set()
  const targets: { id: string; tag: string; text: string }[] = []
  for (const el of [...header, ...forms] as any[]) {
    if (seen.has(el) || targets.length >= max || !shown(el)) continue
    seen.add(el)
    const id = String(targets.length)
    el.setAttribute('data-std-target', id)
    const label = el.labels?.[0]?.innerText || el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('title') || ''
    targets.push({ id, tag: el.tagName.toLowerCase(), text: String(label).replace(/\s+/g, ' ').trim().slice(0, 40) })
  }
  const tabbable = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [tabindex], summary, iframe')].filter(
    (el: any) => el.tabIndex >= 0 && shown(el),
  ).length
  return { targets, tabbable }
}
export async function probe(page: Page): Promise<Probe> {
  const dismissed = await dismissConsent(page)
  const marked = await page.evaluate(markTargets, TARGETS)
  return { ...(dismissed ? { dismissed: dismissed.text } : {}), ...marked }
}

const name = (stop: Focus) => `"${stop.text || stop.href || stop.tag}" (${stop.tag})`

/** The first element focus stays on: three Tabs in a row, or a cycle of a few elements outside a dialog. */
function trapOf(stops: Focus[], tabbable: number) {
  for (let i = 2; i < stops.length; i++) {
    const [a, b, c] = [stops[i - 2]!, stops[i - 1]!, stops[i]!]
    if (!a.none && a.key === b.key && b.key === c.key) return `focus stays on ${name(a)}`
  }
  const tail = stops.slice(-20)
  const keys = new Set(tail.map(stop => stop.key))
  if (stops.length >= 30 && keys.size <= 4 && keys.size < tabbable && !tail.some(stop => stop.none) && !tail.every(stop => stop.dialog)) {
    return `focus cycles through ${[...new Map(tail.map(stop => [stop.key, stop])).values()].map(name).join(', ')} only`
  }
}

/** Tab reaches the header's links and buttons and the first forms' controls, every stop shows focus, and nothing traps it. */
export default async function keyboardNav([visit]: Visit[], _ctx: Context): Promise<Outcome> {
  const stops = visit?.keyboard ?? []
  const { targets, tabbable, dismissed } = (visit?.probe ?? { targets: [], tabbable: 0 }) as Probe
  const on = stops.filter(stop => !stop.none)
  if (on.length === 0) return { state: 'fail', evidence: `${stops.length} Tab presses focused nothing on the page` }

  const failures: string[] = []
  const reached = new Set(on.map(stop => stop.target).filter(Boolean))
  const missed = targets.filter(target => !reached.has(target.id))
  if (missed.length) {
    failures.push(`${stops.length} Tab presses never reach ${missed.slice(0, SHOWN).map(t => `"${t.text || t.tag}" (${t.tag})`).join(', ')}${missed.length > SHOWN ? ` and ${missed.length - SHOWN} more` : ''}`)
  }
  const unseen = [...new Map(on.filter(stop => !stop.frame && (!stop.shown || stop.changes === false)).map(stop => [stop.key, stop])).values()]
  if (unseen.length) {
    const why = (stop: Focus) => (stop.shown ? '' : ', off screen')
    failures.push(`no visible focus on ${unseen.slice(0, SHOWN).map(stop => `${name(stop)}${why(stop)}`).join(', ')}${unseen.length > SHOWN ? ` and ${unseen.length - SHOWN} more` : ''}`)
  }
  const trap = trapOf(stops, tabbable)
  if (trap) failures.push(trap)

  const first = dismissed ? ` after closing the cookie banner ("${dismissed}")` : ''
  if (failures.length) return { state: 'fail', evidence: `${failures.join('; ')}${first}` }
  const distinct = new Set(on.map(stop => stop.key)).size
  return { state: 'pass', evidence: `Tab reaches all ${targets.length} header and form controls; ${distinct} stops, each with visible focus${first}` }
}
