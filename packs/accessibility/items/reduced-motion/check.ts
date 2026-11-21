import type { Page } from 'playwright-core'
import type { Visit } from '../../../../core/browser.ts'
import type { Context } from '../../../../core/checks/context.ts'
import type { Outcome } from '../../../../core/schema.ts'

declare const document: any, innerHeight: number, innerWidth: number

/** Motion shorter than this is a state change (a hover, a fade), not something that moves on its own. */
const MAX_MS = 500
const WATCH_MS = 3000
const EVERY_MS = 300
const SHOWN = 4

interface Moving {
  what: string
  /** CSS animation, CSS transition, script (Web Animations) or video */
  kind: string
  /** active duration in ms; null for infinite */
  ms: number | null
}

/** In the page: the visible animations running now that last longer than `max`, and playing videos. */
function moving(max: number): Moving[] {
  const describe = (el: any) => {
    if (!el?.tagName) return 'an element'
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : cls ? `.${cls}` : ''}`
  }
  const onScreen = (el: any) => {
    if (!el?.getBoundingClientRect || !el.checkVisibility?.({ checkOpacity: false, checkVisibilityCSS: true })) return false
    const r = el.getBoundingClientRect()
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
  }
  const found: Moving[] = []
  for (const animation of document.getAnimations()) {
    if (animation.playState !== 'running') continue
    const target = animation.effect?.target
    if (!onScreen(target)) continue
    const timing = animation.effect.getComputedTiming()
    const ms = timing.activeDuration === Infinity ? null : Number(timing.activeDuration)
    if (ms !== null && ms <= max) continue
    const kind = animation.animationName ? 'CSS animation' : animation.transitionProperty ? 'CSS transition' : 'script animation'
    const name = animation.animationName ?? animation.transitionProperty ?? animation.id ?? ''
    found.push({ what: `${describe(target)}${name ? ` (${name})` : ''}`, kind, ms })
  }
  for (const video of document.querySelectorAll('video')) {
    if (!video.paused && video.currentTime > 0 && onScreen(video) && !video.controls) found.push({ what: describe(video), kind: 'video', ms: null })
  }
  return found
}

/** Watches the first screen for a few seconds after load: carousels and fades start on timers. */
export async function probe(page: Page) {
  const seen = new Map<string, Moving>()
  for (let waited = 0; waited <= WATCH_MS; waited += EVERY_MS) {
    for (const item of await page.evaluate(moving, MAX_MS)) seen.set(`${item.kind} ${item.what}`, item)
    await page.waitForTimeout(EVERY_MS)
  }
  return [...seen.values()]
}

const length = (item: Moving) => (item.ms === null ? 'looping' : `${(item.ms / 1000).toFixed(1)} s`)

/** With `prefers-reduced-motion: reduce`, nothing on the first screen animates for longer than half a second, and no video plays by itself. */
export default async function reducedMotion([visit]: Visit[], _ctx: Context): Promise<Outcome> {
  const found = (visit?.probe ?? []) as Moving[]
  if (found.length === 0) return { state: 'pass', evidence: `with prefers-reduced-motion: reduce, nothing on the first screen moves for over ${MAX_MS} ms in the ${WATCH_MS / 1000} s after load` }
  const shown = found.slice(0, SHOWN).map(item => `${item.what}: ${item.kind}, ${length(item)}`)
  const more = found.length > SHOWN ? ` and ${found.length - SHOWN} more` : ''
  return { state: 'fail', evidence: `with prefers-reduced-motion: reduce, still moving after load: ${shown.join('; ')}${more}` }
}
