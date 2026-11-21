import { join } from 'node:path'
import type { Page } from 'playwright-core'
import type { Visit } from '../browser.ts'
import { hostOf, pathOf, sitemapOf, sitemapPages, spread } from '../crawl.ts'
import { local, sameUrl } from '../expect.ts'
import type { BrowserExpect, Check, Outcome } from '../schema.ts'
import type { Context } from './context.ts'
import { resolve } from './http.ts'

type BrowserCheck = Extract<Check, { kind: 'browser' }>

/** What an item's `script` module may export. */
export interface BrowserScript {
  probe?: (page: Page, visit: Visit) => Promise<unknown>
  default?: (visits: Visit[], ctx: Context) => Promise<Outcome>
}

// playwright-core and axe-core take a moment to load: only a run with browser items pays for it.
let engine: Promise<typeof import('../browser.ts')> | undefined
const browser = () => (engine ??= import('../browser.ts'))

/** Closes the shared Chromium if a check started one, so a CLI run exits now rather than after its idle wait. */
export async function closeBrowser() {
  if (engine) await (await engine).closeBrowser()
}

const SHOWN = 5
const NOT_PAGES = /\.(pdf|jpe?g|png|webp|avif|gif|svg|xml|txt|zip|docx?|xlsx?)$/i

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`

/** The pages a check visits: its `pages`, then `sample` pages spread across the sitemap, on the asset's host. */
export async function pagesOf(check: Pick<BrowserCheck, 'pages' | 'sample'>, base: string) {
  const urls = check.pages.map(path => resolve(path, base))
  if (!check.sample) return urls
  const listed = (await sitemapPages(await sitemapOf(base))) ?? []
  const own = [...new Set(listed.map(local))].filter(
    url => hostOf(url) === hostOf(base) && !NOT_PAGES.test(new URL(url).pathname) && !urls.some(taken => sameUrl(taken, url)),
  )
  return [...urls, ...spread(own, check.sample)]
}

/** The first way the visits miss one expectation, as failures for the evidence. */
function judge(expect: BrowserExpect, visits: Visit[]): string[] {
  const failures: string[] = []
  for (const v of visits) {
    const where = pathOf(v.final)
    if ('axe' in expect) {
      const bad = (v.axe ?? []).filter(violation => violation.impact && expect.axe.impact.includes(violation.impact))
      if (bad.length) failures.push(`${where}: ${bad.map(violation => `${violation.id} (${violation.impact}) ×${violation.nodes}`).join(', ')}`)
    }
    if ('console' in expect) {
      const ignore = expect.console.ignore ? new RegExp(expect.console.ignore, 'i') : undefined
      const errors = v.console.filter(message => !ignore?.test(message))
      if (errors.length) failures.push(`${where}: ${errors.length} console error${errors.length > 1 ? 's' : ''}: ${errors.slice(0, 2).map(e => `"${e.slice(0, 140)}"`).join('; ')}`)
    }
    if ('transfer' in expect) {
      const total = v.requests.reduce((sum, request) => sum + request.bytes, 0)
      const js = v.requests.filter(request => request.type === 'script').reduce((sum, request) => sum + request.bytes, 0)
      const over: string[] = []
      if (expect.transfer.total_kb && total > expect.transfer.total_kb * 1024) over.push(`${kb(total)} transferred, over ${expect.transfer.total_kb} KB`)
      if (expect.transfer.js_kb && js > expect.transfer.js_kb * 1024) over.push(`JS ${kb(js)}, over ${expect.transfer.js_kb} KB`)
      if (over.length) {
        const heaviest = [...v.requests].sort((a, b) => b.bytes - a.bytes).slice(0, 3)
        failures.push(`${where}: ${over.join('; ')} (heaviest: ${heaviest.map(r => `${pathOf(r.url).slice(-50)} ${kb(r.bytes)}`).join(', ')})`)
      }
    }
    if ('trackers' in expect) {
      const allowed = expect.trackers.allow_cookies ? new RegExp(expect.trackers.allow_cookies) : undefined
      const sent = [...new Set(v.requests.filter(r => r.tracker && !r.interacted).map(r => `${r.tracker} (${new URL(r.url).host})`))]
      const cookies = v.cookies.filter(cookie => cookie.tracking && !allowed?.test(cookie.name)).map(cookie => `${cookie.name} (${cookie.tracking})`)
      if (sent.length) failures.push(`${where}: before any choice, requests to ${sent.join(', ')}`)
      if (cookies.length) failures.push(`${where}: before any choice, cookies ${cookies.slice(0, 8).join(', ')}`)
    }
  }
  return failures
}

/** What a pass says about the visits, for the evidence. */
function summary(expect: BrowserExpect, visits: Visit[]) {
  if ('transfer' in expect) {
    return visits
      .map(v => {
        const total = v.requests.reduce((sum, r) => sum + r.bytes, 0)
        const js = v.requests.filter(r => r.type === 'script').reduce((sum, r) => sum + r.bytes, 0)
        return `${pathOf(v.final)}: ${kb(total)} transferred, JS ${kb(js)}`
      })
      .join('; ')
  }
  if ('axe' in expect) return `no ${expect.axe.impact.join(' or ')} axe violations`
  if ('console' in expect) return 'no console errors'
  return 'no tracker requests or tracker cookies before any choice'
}

export async function browserCheck(check: BrowserCheck, ctx: Context): Promise<Outcome> {
  const { asset } = ctx
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  if (check.expect.length === 0 && !check.script) return { state: 'error', evidence: `${ctx.item.key}: a browser check needs expect or script` }
  const module: BrowserScript = check.script ? await import(join(ctx.item.dir, check.script)) : {}

  const urls = await pagesOf(check, asset.url)
  const options = {
    viewport: check.viewport,
    reducedMotion: check.reduced_motion,
    axe: check.axe || check.expect.some(e => 'axe' in e),
    tabs: check.keyboard?.tabs,
    probe: module.probe,
  }
  const { visit } = await browser()
  const visits = await Promise.all(urls.map(url => visit(url, options)))

  const challenged = visits.find(v => v.challenged)
  if (challenged) return { state: 'error', evidence: `${challenged.challenged} answered ${pathOf(challenged.url)} with a bot challenge (${challenged.status}): try again later, or let the checks' address through` }
  const broken = visits.find(v => v.error || v.status === 0 || v.status === 429 || v.status >= 500)
  if (broken) return { state: 'error', evidence: `${broken.url} ${broken.error ? `did not load: ${broken.error}` : `answered ${broken.status}`}` }
  const missing = visits.filter(v => v.status >= 400)
  if (missing.length) return { state: 'fail', evidence: missing.map(v => `${pathOf(v.url)} answered ${v.status}`).join('; ') }

  const failures = check.expect.flatMap(expect => judge(expect, visits))
  const scripted = module.default ? await module.default(visits, ctx) : undefined
  const checked = `(${visits.map(v => pathOf(v.final)).join(', ')}; ${check.viewport})`
  if (scripted?.state === 'error') return scripted
  if (failures.length || scripted?.state === 'fail') {
    const all = [...failures, ...(scripted?.state === 'fail' ? [scripted.evidence] : [])]
    const more = all.length > SHOWN ? `; and ${all.length - SHOWN} more` : ''
    return { state: 'fail', evidence: `${all.slice(0, SHOWN).join('; ')}${more} ${checked}` }
  }
  const passed = [...check.expect.map(expect => summary(expect, visits)), ...(scripted ? [scripted.evidence] : [])]
  return { state: 'pass', evidence: `${passed.join('; ')} ${checked}` }
}
