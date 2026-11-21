import type { Page } from 'playwright-core'
import type { Visit } from '../../../../core/browser.ts'
import type { Context } from '../../../../core/checks/context.ts'
import { local } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { siteOf } from '../../../../core/trackers.ts'

declare const performance: any

/** In the page: the resources Chromium reports as render-blocking (Resource Timing's `renderBlockingStatus`). */
const blocking = (page: Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry: any) => entry.renderBlockingStatus === 'blocking')
      .map((entry: any) => ({ url: String(entry.name), type: String(entry.initiatorType) })),
  ) as Promise<{ url: string; type: string }[]>

export const probe = blocking

/** No script or stylesheet from another site holds the first render. */
export default async function thirdParty([visit]: Visit[], _ctx: Context): Promise<Outcome> {
  if (!visit) return { state: 'error', evidence: 'no page was visited' }
  const site = siteOf(new URL(local(visit.final)).hostname)
  const all = (visit.probe ?? []) as { url: string; type: string }[]
  const foreign = all.filter(entry => siteOf(new URL(local(entry.url)).hostname) !== site)
  const kind = (type: string) => (type === 'link' || type === 'css' ? 'stylesheet' : type)
  if (foreign.length) {
    return { state: 'fail', evidence: `render-blocking from other hosts: ${foreign.slice(0, 5).map(e => `${kind(e.type)} ${e.url.slice(0, 90)}`).join(', ')}` }
  }
  return { state: 'pass', evidence: `${all.length} render-blocking file${all.length === 1 ? '' : 's'}, all from ${site}` }
}
