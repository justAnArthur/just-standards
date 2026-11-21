import type { Page } from 'playwright-core'
import type { Visit } from '../../../../core/browser.ts'
import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'

declare const window: any

/** The four signals of Consent Mode v2; the last two are what v2 added. */
const SIGNALS = ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'] as const
const GOOGLE_TAG = /^https?:\/\/(www\.)?googletagmanager\.com\/(gtm\.js|gtag\/js)|^https?:\/\/[\w.:-]+\/(gtm\.js\?id=GTM-|gtag\/js\?id=G-)/
const HIT = /\/g\/collect\?|google-analytics\.com\/(g\/)?collect/

interface Probe {
  /** the dataLayer's entries: gtag() calls as `args`, pushed objects as `push` */
  dataLayer: ({ args: unknown[] } | { push: unknown } | { unreadable: true })[] | null
  /** Google's own record of the consent state, when gtag.js has loaded: signal → { default, update } (true is granted) */
  ics: Record<string, { default?: boolean; update?: boolean }> | null
  gtag: boolean
  gtm: boolean
}

/** In the page, before any interaction: the dataLayer as gtag and GTM saw it, and the consent state gtag.js holds. */
function read(): Probe {
  const dl = window.dataLayer
  const dataLayer = Array.isArray(dl)
    ? dl.map((entry: any) => {
        try {
          if (Object.prototype.toString.call(entry) === '[object Arguments]') return { args: JSON.parse(JSON.stringify(Array.from(entry))) }
          return { push: JSON.parse(JSON.stringify(entry)) }
        } catch {
          return { unreadable: true as const }
        }
      })
    : null
  const entries = window.google_tag_data?.ics?.entries
  const ics = entries
    ? Object.fromEntries(Object.entries(entries).map(([key, value]: [string, any]) => [key, { default: value?.default, update: value?.update }]))
    : null
  return { dataLayer, ics, gtag: typeof window.gtag === 'function', gtm: !!window.google_tag_manager }
}

export const probe = (page: Page) => page.evaluate(read)

type Defaults = Partial<Record<(typeof SIGNALS)[number], string>>

/** The `consent default` the dataLayer holds (gtag calls and the `['consent', 'default', …]` arrays some CMPs push), merged in order. */
function defaultsOf(probe: Probe) {
  const defaults: Defaults = {}
  let index = -1
  let configBefore = false
  probe.dataLayer?.forEach((entry, i) => {
    const args = 'args' in entry ? entry.args : 'push' in entry && Array.isArray(entry.push) ? entry.push : undefined
    if (!args) return
    if (args[0] === 'config' && index === -1) configBefore = true
    if (args[0] !== 'consent' || args[1] !== 'default' || typeof args[2] !== 'object' || !args[2]) return
    if (index === -1) index = i
    for (const signal of SIGNALS) {
      const value = (args[2] as Record<string, unknown>)[signal]
      if (typeof value === 'string' && !(signal in defaults)) defaults[signal] = value
    }
  })
  if (index === -1 && probe.ics) {
    for (const signal of SIGNALS) {
      const value = probe.ics[signal]?.default
      if (value !== undefined) defaults[signal] = value ? 'granted' : 'denied'
    }
  }
  return { defaults, found: index !== -1 || Object.keys(defaults).length > 0, configBefore }
}

/**
 * When the page loads Google tags: the four Consent Mode v2 signals default to denied before any choice, set before the
 * first `config`, and the first hits say so (`gcs=G100`).
 */
export default async function consentMode([visit]: Visit[], _ctx: Context): Promise<Outcome> {
  if (!visit) return { state: 'error', evidence: 'no page was visited' }
  const probe = visit.probe as Probe
  const tags = visit.requests.filter(r => !r.interacted && GOOGLE_TAG.test(r.url))
  const hits = visit.requests.filter(r => !r.interacted && HIT.test(r.url))
  if (tags.length === 0 && hits.length === 0 && !probe.gtag && !probe.gtm) return { state: 'pass', evidence: 'no Google tags on the page' }

  const { defaults, found, configBefore } = defaultsOf(probe)
  const failures: string[] = []
  if (!found) failures.push('Google tags load, but no consent default is set before any choice')
  else {
    const granted = SIGNALS.filter(signal => defaults[signal] === 'granted')
    const missing = SIGNALS.filter(signal => !defaults[signal])
    if (granted.length) failures.push(`the consent default grants ${granted.join(', ')}`)
    if (missing.length) failures.push(`no default for ${missing.join(', ')}${missing.some(s => s.startsWith('ad_') && s !== 'ad_storage') ? ' (Consent Mode v2)' : ''}`)
    if (configBefore) failures.push("gtag('config') runs before gtag('consent', 'default')")
  }
  const states = [...new Set(hits.map(hit => new URL(hit.url).searchParams.get('gcs') ?? 'none'))]
  if (states.includes('none')) failures.push('a Google Analytics hit before any choice carries no consent state (no gcs)')
  const notDenied = states.filter(state => state !== 'none' && state !== 'G100')
  // gcs=G1xy: x is ad_storage, y analytics_storage; 1 granted, 0 denied, - not set
  const unset = notDenied.filter(state => state.includes('-'))
  const granted = notDenied.filter(state => !state.includes('-'))
  if (unset.length) failures.push(`Google Analytics hits before any choice carry no consent default (${unset.map(s => `gcs=${s}`).join(', ')})`)
  if (granted.length) failures.push(`Google Analytics hits before any choice say ${granted.map(s => `gcs=${s}`).join(', ')}, not G100 (all denied)`)

  if (failures.length) return { state: 'fail', evidence: failures.join('; ') }
  const shown = SIGNALS.map(signal => `${signal}=${defaults[signal]}`).join(', ')
  return { state: 'pass', evidence: `consent defaults before any choice: ${shown}${hits.length ? `; ${hits.length} hits with gcs=G100` : ''}` }
}
