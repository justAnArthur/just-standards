// Finding a cookie banner's buttons by what they say, in the page, its open shadow roots and its frames: what a
// visitor sees on the banner's first layer, before opening any settings.
import type { Frame, Page } from 'playwright-core'

declare const document: any, getComputedStyle: any, innerHeight: number, innerWidth: number

/** Words on a banner's buttons, by what they do; matched on the lowercased label. Reject is tried first: "allow only necessary" rejects. */
const WORDS = {
  reject: [
    'reject', 'decline', 'deny', 'refuse', 'disagree', "don't accept", 'do not accept', 'only (strictly )?(necessary|essential|required)',
    '(necessary|essential|required)( cookies)? only', 'use (only )?necessary', 'continue without', 'odmietn', 'zamietn', 'nesúhlas',
    'odmítn', 'nesouhlas', '(len|iba|jen|pouze) (nevyhnutn|nutn|potrebn|nezbytn)', 'ablehnen', 'nur (notwendig|essenziell|erforderlich|technisch)',
    'avvís', 'nokta', 'afvis', 'kun nødvendige', 'refuser', 'tout refuser', 'rechazar', 'rifiut', 'odrzu', 'elutasít', 'csak a szükséges',
  ],
  accept: [
    'accept', 'agree', 'allow', '^ok(ay)?\\b', 'got it', 'súhlas', 'prija', 'povoli', 'akcept', 'rozumiem', 'přijm', 'souhlas', 'povolit',
    'akzeptier', 'zustimm', 'einverstanden', 'alle erlauben', 'g[oó]ðtak', 'godkend', 'tillad', 'accepter', 'aceptar', 'accett',
    'zgadzam', 'zaakceptuj', 'elfogad',
  ],
  settings: [
    'settings', 'preferences', 'customi[sz]e', 'manage', 'more options', 'options', 'nastaven', 'prispôsob', 'upravi', 'předvolby',
    'einstellung', 'anpassen', 'stillingar', 'indstilling', 'paramètres', 'personnaliser', 'configur', 'impostazioni', 'ustawienia', 'beállítás',
  ],
}
/** Text of the notice around the buttons: what tells a cookie banner from any other dialog. */
const NOTICE = 'cookie|consent|súbor|súhlas|souhlas|gdpr|privacy|datenschutz|persónupp|personupp|kakur|tracking|sledovan|souhlas|zgod|adatkezel'

export interface ConsentButton {
  kind: 'accept' | 'reject' | 'settings'
  text: string
  /** the frame it is in: 0 for the page itself */
  frame: number
  mark: string
}

/** In a frame: the visible buttons of a cookie notice, each marked with `data-std-consent` so it can be clicked. */
function inFrame({ words, notice, frame }: { words: typeof WORDS; notice: string; frame: number }) {
  const kinds = (['reject', 'accept', 'settings'] as const).map(kind => [kind, new RegExp(words[kind].join('|'), 'i')] as const)
  const isNotice = new RegExp(notice, 'i')
  const all: any[] = []
  const walk = (root: any) => {
    all.push(...root.querySelectorAll('button, a, [role=button], input[type=button], input[type=submit]'))
    for (const host of root.querySelectorAll('*')) if (host.shadowRoot) walk(host.shadowRoot)
  }
  walk(document)
  const found: ConsentButton[] = []
  all.forEach((el, i) => {
    const text = String(el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text || text.length > 60) return
    const kind = kinds.find(([, pattern]) => pattern.test(text.toLowerCase()))?.[0]
    if (!kind) return
    // A banner is a layer over the page (fixed, sticky, a dialog) whose short text speaks of cookies or consent: a footer's
    // "Cookie policy" link next to a newsletter's "OK" is not one.
    let node = el
    let inNotice = false
    let layered = false
    for (let up = 0; node && node !== document.body && up < 25; up++) {
      if (!inNotice) {
        const around = String(node.innerText ?? node.textContent ?? '')
        if (around.length <= 3000 && isNotice.test(around)) inNotice = true
      }
      const position = node.nodeType === 1 ? getComputedStyle(node).position : ''
      if (position === 'fixed' || position === 'sticky' || node.tagName === 'DIALOG' || /dialog/.test(node.getAttribute?.('role') ?? '') || node.getAttribute?.('aria-modal') === 'true') layered = true
      node = node.parentElement ?? node.getRootNode?.()?.host
    }
    // a banner in a frame of its own (a consent manager's iframe) is a layer already
    if (!inNotice || !(layered || frame > 0)) return
    const rect = el.getBoundingClientRect()
    const onScreen = rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
    const visible = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : getComputedStyle(el).visibility !== 'hidden'
    if (!onScreen || !visible) return
    const mark = `${kind}-${frame}-${i}`
    el.setAttribute('data-std-consent', mark)
    found.push({ kind, text, frame, mark })
  })
  return found
}

/** The visible buttons of a cookie banner, in the page and its frames, before any choice. */
export async function consentButtons(page: Page): Promise<ConsentButton[]> {
  const frames = page.frames()
  const found = await Promise.all(
    frames.map((frame, i) => frame.evaluate(inFrame, { words: WORDS, notice: NOTICE, frame: i }).catch(() => [] as ConsentButton[])),
  )
  return found.flat()
}

/** Clicks a button `consentButtons` found; false when it couldn't be clicked. */
export async function clickConsent(page: Page, button: ConsentButton) {
  const frame: Frame | undefined = page.frames()[button.frame]
  if (!frame) return false
  try {
    await frame.locator(`[data-std-consent="${button.mark}"]`).first().click({ timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/** Closes a cookie banner the way a visitor who declines would (reject, else accept), so what is behind it can be probed. */
export async function dismissConsent(page: Page) {
  const buttons = await consentButtons(page)
  const button = buttons.find(b => b.kind === 'reject') ?? buttons.find(b => b.kind === 'accept')
  if (!button) return undefined
  const clicked = await clickConsent(page, button)
  if (clicked) await page.waitForTimeout(500)
  return clicked ? button : undefined
}
