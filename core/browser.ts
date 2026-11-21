// One headless Chromium per process, shared by every `browser` check: launched on first use, closed when no check has
// used it for a moment (so a CLI run exits) or by `closeBrowser`.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import axe from 'axe-core'
import { type Browser, type BrowserContext, chromium, type LaunchOptions, type Page, type Request as PlaywrightRequest } from 'playwright-core'
import { headersFor, local, rewriting } from './expect.ts'
import { siteOf, trackerOf, trackingCookie } from './trackers.ts'

// The functions handed to `page.evaluate` run in the page. The project's lib has no DOM (it would clash with Bun's
// types), so what they touch is declared here, loosely, for this module only.
declare const window: any, document: any, getComputedStyle: any, innerHeight: number, innerWidth: number, CSSStyleSheet: any
type Element = any
type HTMLElement = any
type HTMLInputElement = any

export const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const
export type Viewport = keyof typeof VIEWPORTS

const IDLE_MS = 1500
const MAX_CONTEXTS = 4
const GOTO_TIMEOUT_MS = 30_000
const IDLE_TIMEOUT_MS = 8000
/** After the network is quiet: consent banners and tags that start on a timer. */
const SETTLE_MS = 1000
/** A visit that takes longer (a page that never stops, a probe that hangs) is cut off: its context is closed. */
const VISIT_TIMEOUT_MS = 90_000
const CLOSE_TIMEOUT_MS = 5000
/** What a hosting platform adds to its previews only (Vercel's toolbar): not the site's, left out of what a visit collects. */
const PREVIEW_ONLY = /^https:\/\/vercel\.live\//

// --- finding a Chromium -------------------------------------------------------------------------------------------

/** playwright-core's browser registry: `PLAYWRIGHT_BROWSERS_PATH`, else the platform's cache folder. */
function registry() {
  const set = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (set && set !== '0') return set
  if (process.platform === 'darwin') return join(homedir(), 'Library/Caches/ms-playwright')
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? homedir(), 'ms-playwright')
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'ms-playwright')
}

const EXECUTABLES = [
  'chrome-headless-shell-mac-arm64/chrome-headless-shell',
  'chrome-headless-shell-mac-x64/chrome-headless-shell',
  'chrome-headless-shell-linux64/chrome-headless-shell',
  'chrome-headless-shell-win64/chrome-headless-shell.exe',
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-win64/chrome.exe',
  'chrome-win/chrome.exe',
]

/** Chromium builds other Playwright versions left in the registry, newest first, the headless shell before the full browser. */
function installed() {
  let dirs: string[]
  try {
    dirs = readdirSync(registry())
  } catch {
    return []
  }
  const revision = (dir: string) => Number(dir.match(/-(\d+)$/)?.[1] ?? 0)
  return dirs
    .filter(dir => /^chromium(_headless_shell)?-\d+$/.test(dir))
    .sort((a, b) => revision(b) - revision(a) || Number(b.includes('headless')) - Number(a.includes('headless')))
    .flatMap(dir => EXECUTABLES.map(exe => join(registry(), dir, exe)))
    .filter(path => existsSync(path))
}

/**
 * How to start Chromium, in order:
 * 1. `STANDARDS_CHROMIUM`, an executable path, when set;
 * 2. the build this playwright-core version expects (`bunx playwright-core install chromium-headless-shell`);
 * 3. the newest Chromium another Playwright version installed in the same registry: playwright-core drives builds a
 *    few revisions apart fine, and `chromium.launch()` alone would refuse them;
 * 4. Google Chrome itself (`channel: 'chrome'`).
 */
function candidates(): LaunchOptions[] {
  const env = process.env.STANDARDS_CHROMIUM
  return [...(env ? [{ executablePath: env }] : []), {}, ...installed().map(executablePath => ({ executablePath })), { channel: 'chrome' }]
}

let launched: Promise<Browser> | undefined
let working: LaunchOptions | undefined

async function launch() {
  if (working) return chromium.launch({ ...working, headless: true })
  const tried: string[] = []
  for (const options of candidates()) {
    try {
      const browser = await chromium.launch({ ...options, headless: true })
      working = options
      return browser
    } catch (error) {
      tried.push(`${options.executablePath ?? options.channel ?? 'bundled'}: ${(error as Error).message.split('\n')[0]}`)
    }
  }
  throw new Error(`no Chromium could be launched (run \`bunx playwright-core install chromium-headless-shell\`, or set STANDARDS_CHROMIUM). Tried ${tried.join('; ')}`)
}

function browser() {
  if (!launched) {
    launched = launch()
    launched.catch(() => (launched = undefined))
  }
  return launched
}

/** Whether a Chromium can be launched here; tests skip without one. */
export async function canLaunch() {
  try {
    await browser()
    return true
  } catch {
    return false
  }
}

let open = 0
let idle: ReturnType<typeof setTimeout> | undefined
const waiting: (() => void)[] = []

/** Closes the shared browser now; the next check launches another. */
export async function closeBrowser() {
  clearTimeout(idle)
  const closing = launched
  launched = undefined
  const browser = await closing?.catch(() => undefined)
  // a browser that doesn't close in time is killed by playwright-core's exit handler
  if (browser) await Promise.race([browser.close().catch(() => {}), Bun.sleep(CLOSE_TIMEOUT_MS)])
}

/** Runs `fn` in a fresh incognito context (no cookies, no cache) of the shared browser, at most MAX_CONTEXTS at once. */
async function withContext<T>(options: (browser: Browser) => Parameters<Browser['newContext']>[0], fn: (context: BrowserContext) => Promise<T>) {
  clearTimeout(idle)
  if (open >= MAX_CONTEXTS) await new Promise<void>(go => waiting.push(go))
  open++
  try {
    const shared = await browser()
    const context = await shared.newContext(options(shared))
    try {
      return await fn(context)
    } finally {
      await context.close().catch(() => {})
    }
  } finally {
    open--
    const next = waiting.shift()
    if (next) next()
    else if (open === 0) {
      idle = setTimeout(() => void closeBrowser(), IDLE_MS)
      // the browser's pipes keep the process alive until it closes; the timer itself must not
      idle.unref?.()
    }
  }
}

// --- what a visit collects ----------------------------------------------------------------------------------------

export interface Request {
  url: string
  /** Playwright's resource type: document, script, stylesheet, image, font, fetch, xhr… */
  type: string
  /** 0 when it failed */
  status: number
  /** bytes over the wire: compressed body and headers */
  bytes: number
  /** the response's content type, without parameters */
  mime: string
  thirdParty: boolean
  /** the tracker it goes to, from `core/trackers.ts` */
  tracker?: string
  /** sent after the visit's first interaction (a click in a probe, a Tab) */
  interacted: boolean
  failure?: string
}

export interface Cookie {
  name: string
  domain: string
  /** why it is non-essential: a tracker's name or a third-party domain */
  tracking?: string
}

export interface Focus {
  /** a stable number per element in the visit, to tell the same element apart from another */
  key: number
  tag: string
  text: string
  href?: string
  role?: string
  /** `data-std-target` on the element: a probe's mark for "must be reachable" */
  target?: string
  /** inside a dialog (`role=dialog`, `aria-modal`, `<dialog>`) */
  dialog: boolean
  /** the body, or nothing: focus left the page */
  none: boolean
  /** an iframe: what is focused inside isn't looked at */
  frame: boolean
  /** a box of some size inside the viewport while focused */
  shown: boolean
  /** the element, its pseudo elements, parent or first child look different focused than not; unknown for the last stop */
  changes?: boolean
  /** for `href="#id"`: whether the page has that id */
  anchorTarget?: boolean
}

export interface AxeViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null
  help: string
  nodes: number
  /** up to three CSS selectors of failing nodes */
  targets: string[]
}

export interface Visit {
  /** asked for */
  url: string
  /** after redirects */
  final: string
  status: number
  error?: string
  /** the bot protection that answered instead of the site: a challenge page says nothing about the site */
  challenged?: string
  viewport: Viewport
  dpr: number
  /** every request until the visit ended, in order */
  requests: Request[]
  /** set before any interaction */
  cookies: Cookie[]
  /** `console.error` messages and uncaught exceptions */
  console: string[]
  axe?: AxeViolation[]
  /** one entry per Tab press */
  keyboard?: Focus[]
  /** what the item's `probe` returned */
  probe?: unknown
}

export interface VisitOptions {
  viewport: Viewport
  reducedMotion?: boolean
  axe?: boolean
  /** Tab presses to record */
  tabs?: number
  /** Runs once the page has settled, after cookies are read and axe ran, before the keyboard; may click. */
  probe?: (page: Page, visit: Visit) => Promise<unknown>
}

const userAgent = (version: string, viewport: Viewport) => {
  const major = version.split('.')[0]
  return viewport === 'mobile'
    ? `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36 just-standards/0.1`
    : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 just-standards/0.1`
}

const hostOf = (url: string) => {
  try {
    return new URL(local(url)).hostname
  } catch {
    return ''
  }
}

/** Loads `url` in a fresh context and collects what `options` asks for. Never throws: a page that fails to load has `error`. */
export async function visit(url: string, options: VisitOptions): Promise<Visit> {
  const device = VIEWPORTS[options.viewport]
  return withContext(
    shared => ({ ...device, userAgent: userAgent(shared.version(), options.viewport), reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference' }),
    async context => {
      const result: Visit = { url, final: url, status: 0, viewport: options.viewport, dpr: device.deviceScaleFactor, requests: [], cookies: [], console: [] }
      // On a preview check: production URLs are read from the preview, and the preview gets its bypass header.
      if (rewriting()) {
        await context.route('**/*', async route => {
          const request = route.request()
          const target = local(request.url())
          const extra = headersFor(target)
          if (target === request.url() && !extra) return route.fallback()
          const headers = { ...request.headers(), ...extra }
          if (target === request.url() || new URL(target).protocol === new URL(request.url()).protocol) {
            return route.continue({ url: target === request.url() ? undefined : target, headers })
          }
          // Chromium only rewrites a request to the same scheme: https production → an http preview is fetched here.
          try {
            await route.fulfill({ response: await route.fetch({ url: target, headers }) })
          } catch {
            await route.abort().catch(() => {})
          }
        })
      }
      const page = await context.newPage()
      let cut = false
      const deadline = setTimeout(() => {
        cut = true
        void context.close().catch(() => {})
      }, VISIT_TIMEOUT_MS)
      let interacted = false
      let site = siteOf(hostOf(url))
      const pending = new Set<Promise<void>>()
      // whether the request was sent after the first interaction: judged when it starts, not when it ends
      const late = new WeakSet<PlaywrightRequest>()
      page.on('request', request => void (interacted && late.add(request)))
      const record = (request: PlaywrightRequest, failure?: string) => {
        const address = request.url()
        if (!/^https?:/.test(address) || PREVIEW_ONLY.test(address)) return
        const done = (async () => {
          const response = failure ? null : await request.response().catch(() => null)
          const sizes = await request.sizes().catch(() => undefined)
          result.requests.push({
            url: address,
            type: request.resourceType(),
            status: response?.status() ?? 0,
            bytes: sizes ? Math.max(0, sizes.responseBodySize) + Math.max(0, sizes.responseHeadersSize) : 0,
            mime: (response?.headers()['content-type'] ?? '').split(';')[0]!.trim().toLowerCase(),
            thirdParty: siteOf(hostOf(address)) !== site,
            ...(trackerOf(address) ? { tracker: trackerOf(address) } : {}),
            interacted: late.has(request),
            ...(failure ? { failure } : {}),
          })
        })()
        pending.add(done)
        void done.finally(() => pending.delete(done))
      }
      page.on('requestfinished', request => record(request))
      page.on('requestfailed', request => record(request, request.failure()?.errorText ?? 'failed'))
      page.on('console', message => {
        if (message.type() !== 'error' || PREVIEW_ONLY.test(message.location().url)) return
        // Chromium's own line for a failed load doesn't say what failed
        const where = /^Failed to load resource/.test(message.text()) ? ` (${message.location().url})` : ''
        result.console.push(`${message.text()}${where}`.slice(0, 300))
      })
      page.on('pageerror', error => result.console.push(`Uncaught ${error.name}: ${error.message}`.slice(0, 300)))

      try {
        const response = await page.goto(url, { waitUntil: 'load', timeout: GOTO_TIMEOUT_MS })
        result.status = response?.status() ?? 0
        result.final = page.url()
        const headers = response?.headers() ?? {}
        if (headers['x-vercel-mitigated'] === 'challenge') result.challenged = "Vercel's firewall"
        else if (headers['cf-mitigated'] === 'challenge') result.challenged = 'Cloudflare'
        if (result.challenged) return result
        site = siteOf(hostOf(result.final))
        await page.waitForLoadState('networkidle', { timeout: IDLE_TIMEOUT_MS }).catch(() => {})
        await page.waitForTimeout(SETTLE_MS)
        await Promise.all(pending)
        // Third party is judged against where the page ended up (a redirect to www. is still the site).
        for (const request of result.requests) request.thirdParty = siteOf(hostOf(request.url)) !== site
        result.cookies = (await context.cookies()).map(({ name, domain }) => {
          const tracking = trackingCookie({ name, domain }, site)
          return tracking ? { name, domain, tracking } : { name, domain }
        })
        interacted = true
        if (options.axe) result.axe = await runAxe(page)
        if (options.probe) result.probe = await options.probe(page, result)
        if (options.tabs) result.keyboard = await tabThrough(page, options.tabs)
        await Promise.all(pending)
      } catch (error) {
        result.error = cut ? `cut off after ${VISIT_TIMEOUT_MS / 1000} s` : (error as Error).message.split('\n')[0]
      } finally {
        clearTimeout(deadline)
      }
      return result
    },
  )
}

// --- axe ----------------------------------------------------------------------------------------------------------

/** WCAG 2.2 A and AA, the level EN 301 549 and the European Accessibility Act ask for; axe's best practices are left out. */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function runAxe(page: Page): Promise<AxeViolation[]> {
  // evaluated, not added as a <script>: a Content-Security-Policy doesn't apply to it
  await page.evaluate(`${axe.source};0`)
  return page.evaluate(async tags => {
    const engine = (window as unknown as { axe?: typeof axe }).axe
    if (!engine) throw new Error('axe-core did not load in the page')
    const result = await engine.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'], iframes: false })
    return result.violations.map(v => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map(node => node.target.join(' ')),
    }))
  }, AXE_TAGS)
}

// --- keyboard -----------------------------------------------------------------------------------------------------

/** Presses Tab `tabs` times from the top of the page and records where focus lands, and whether it shows. */
async function tabThrough(page: Page, tabs: number): Promise<Focus[]> {
  await page.evaluate(() => {
    // Focus styles that fade in would read as "no change" a moment after Tab; a stylesheet made in the CSSOM passes a CSP.
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important;scroll-behavior:auto!important}')
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    // Tab starts from the top of the page, wherever a probe clicked.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const start = document.createElement('span')
    start.tabIndex = -1
    start.id = '__std-start'
    document.body.prepend(start)
    start.focus()
    window.scrollTo(0, 0)
  })
  const stops: Focus[] = []
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press('Tab')
    const { focus, before } = await page.evaluate(describeFocus, false)
    if (stops.length && before !== undefined) stops[stops.length - 1]!.changes = before
    stops.push(focus as Focus)
    if (i === 0) await page.evaluate(() => document.getElementById('__std-start')?.remove())
  }
  const { before } = await page.evaluate(describeFocus, true)
  if (stops.length && before !== undefined) stops[stops.length - 1]!.changes = before
  return stops
}

/**
 * In the page: the focused element, and whether the element focused before this one looked different while it had
 * focus. With `blurOnly`, the focused element is blurred and only that comparison is made.
 */
function describeFocus(blurOnly: boolean) {
  type Mark = { el: Element; focused: string }
  const w = window as unknown as { __stdStops?: Mark[]; __stdKeys?: WeakMap<Element, number>; __stdNext?: number }
  w.__stdStops ??= []
  w.__stdKeys ??= new WeakMap()
  const deep = () => {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return active
  }
  const style = (el: Element | null, pseudo?: string) => {
    if (!el) return '-'
    const s = getComputedStyle(el, pseudo)
    // an outline that isn't drawn still changes its offset under Chrome's own :focus-visible rule
    const outline = s.outlineStyle === 'none' || s.outlineWidth === '0px' ? 'none' : `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.outlineOffset}`
    return [
      outline, s.boxShadow, s.borderTopColor, s.borderBottomColor,
      s.borderBottomWidth, s.backgroundColor, s.color, s.textDecorationLine, s.opacity, s.transform, s.top, s.left, s.clip,
      s.clipPath, s.width, s.height, pseudo ? s.content : '',
    ].join('|')
  }
  const snapshot = (el: Element) =>
    [style(el), style(el, '::before'), style(el, '::after'), style(el.parentElement), style(el.firstElementChild)].join('#')

  const stops = w.__stdStops
  const last = stops.at(-1)
  if (blurOnly) (deep() as HTMLElement | null)?.blur?.()
  // focus that didn't move says nothing about how the element looks without it
  const before = last && last.el !== deep() ? snapshot(last.el) !== last.focused : undefined
  if (blurOnly) return { focus: null, before }

  const el = deep()
  const none = !el || el === document.body || el === document.documentElement || el.id === '__std-start'
  if (!w.__stdKeys.has(el ?? document.body)) w.__stdKeys.set(el ?? document.body, (w.__stdNext = (w.__stdNext ?? 0) + 1))
  const key = w.__stdKeys.get(el ?? document.body) as number
  if (none || !el) return { focus: { key, tag: 'body', text: '', dialog: false, none: true, frame: false, shown: false }, before }

  const rect = el.getBoundingClientRect()
  const s = getComputedStyle(el)
  const shown =
    rect.width >= 2 && rect.height >= 2 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth &&
    s.visibility !== 'hidden' && Number(s.opacity) > 0.05
  const field = el as HTMLInputElement
  const text = String(
    (el as HTMLElement).innerText || el.getAttribute('aria-label') || field.labels?.[0]?.innerText || field.placeholder || field.value || el.getAttribute('title') || field.name || '',
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  const href = el.getAttribute('href') ?? undefined
  stops.push({ el, focused: snapshot(el) })
  return {
    focus: {
      key,
      tag: el.tagName.toLowerCase(),
      text,
      ...(href ? { href } : {}),
      ...(el.getAttribute('role') ? { role: el.getAttribute('role') as string } : {}),
      ...(el.getAttribute('data-std-target') ? { target: el.getAttribute('data-std-target') as string } : {}),
      dialog: !!el.closest('[role=dialog],[role=alertdialog],[aria-modal=true],dialog'),
      none: false,
      frame: el.tagName === 'IFRAME',
      shown,
      ...(href?.startsWith('#') && href.length > 1 ? { anchorTarget: !!document.getElementById(decodeURIComponent(href.slice(1))) } : {}),
    },
    before,
  }
}
