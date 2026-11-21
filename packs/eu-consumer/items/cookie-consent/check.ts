import type { Page } from 'playwright-core'
import type { Visit } from '../../../../core/browser.ts'
import type { Context } from '../../../../core/checks/context.ts'
import { type ConsentButton, clickConsent, consentButtons } from '../../../../core/consent.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { siteOf, trackingCookie } from '../../../../core/trackers.ts'

const AFTER_REJECT_MS = 2500

interface Probe {
  buttons: ConsentButton[]
  /** the reject button, once clicked */
  rejected?: string
  /** it was there and could not be clicked */
  unclickable?: string
  /** tracker and third-party cookies after rejecting */
  after: { name: string; why: string }[]
}

/** Reads the banner's first layer, clicks reject when there is one, and reads the cookies a few seconds later. */
export async function probe(page: Page): Promise<Probe> {
  const buttons = await consentButtons(page)
  const reject = buttons.find(button => button.kind === 'reject')
  if (!reject) return { buttons, after: [] }
  if (!(await clickConsent(page, reject))) return { buttons, unclickable: reject.text, after: [] }
  await page.waitForTimeout(AFTER_REJECT_MS)
  const site = siteOf(new URL(page.url()).hostname)
  const after = (await page.context().cookies())
    .map(cookie => ({ name: cookie.name, why: trackingCookie(cookie, site) ?? '' }))
    .filter(({ why }) => why)
  return { buttons, rejected: reject.text, after }
}

const quoted = (buttons: ConsentButton[]) => buttons.map(button => `"${button.text}"`).join(', ')

/**
 * The banner's first layer offers reject next to accept, and rejecting stops tracking. A site that tracks nothing and
 * shows no banner passes: it needs none. What fires before any choice is the `trackers` expectation's part.
 */
export default async function cookieConsent([visit]: Visit[], _ctx: Context): Promise<Outcome> {
  if (!visit) return { state: 'error', evidence: 'no page was visited' }
  const { buttons, rejected, unclickable, after } = visit.probe as Probe
  const accept = buttons.filter(button => button.kind === 'accept')
  const settings = buttons.filter(button => button.kind === 'settings')
  if (unclickable) return { state: 'fail', evidence: `the banner's "${unclickable}" could not be clicked` }
  if (!rejected) {
    if (accept.length === 0) {
      const tracking = visit.requests.some(r => r.tracker) || visit.cookies.some(cookie => cookie.tracking)
      if (tracking) return { state: 'fail', evidence: 'no cookie banner, while trackers run' }
      return { state: 'pass', evidence: 'no cookie banner, and nothing tracks before a choice' }
    }
    const other = settings.length ? `, only ${quoted(settings)}` : ''
    return { state: 'fail', evidence: `the cookie banner offers ${quoted(accept)} but no reject on its first layer${other}` }
  }
  const sent = [...new Set(visit.requests.filter(r => r.interacted && r.tracker).map(r => `${r.tracker} (${new URL(r.url).host})`))]
  // cookies set before the choice are the `trackers` expectation's to report
  const fresh = after.filter(cookie => !visit.cookies.some(before => before.name === cookie.name)).map(cookie => `${cookie.name} (${cookie.why})`)
  const failures = [
    ...(sent.length ? [`after "${rejected}", requests to ${sent.join(', ')}`] : []),
    ...(fresh.length ? [`after "${rejected}", cookies ${fresh.slice(0, 8).join(', ')}`] : []),
  ]
  if (failures.length) return { state: 'fail', evidence: failures.join('; ') }
  return { state: 'pass', evidence: `the banner offers ${quoted(buttons.filter(b => b.kind === 'reject'))} beside ${quoted(accept) || 'its other choices'}; after "${rejected}" nothing tracks` }
}
