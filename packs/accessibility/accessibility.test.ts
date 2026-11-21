import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { closeBrowser } from '../../core/browser.ts'
import { browserAvailable, checkItem, html, serve } from '../../core/fixtures/browser.ts'

// a real browser: loading a page, letting it settle and probing it takes seconds
setDefaultTimeout(60_000)
const available = await browserAvailable('packs/accessibility')

const header = '<header><nav><a href="/fleet">Fleet</a> <a href="/places">Locations</a> <button type="button">Menu</button></nav></header>'
const form = '<main id="main"><h1>Rent a car</h1><form><label>Pick-up <input name="from"></label> <button>Search</button></form></main>'
const site = serve({
  // axe
  '/clean/': html(`${header}${form}`),
  '/broken/': html(`${header}<main><h1>Cars</h1><button></button><img src="/car.png"><p style="color:#bbb;background:#fff">faint</p></main>`),
  // keyboard
  '/keys-bad/': html(
    `<style>a:focus,button:focus{outline:none}</style><header><nav><a href="/fleet">Fleet</a> <a href="/places" tabindex="-1">Locations</a></nav></header>${form}`,
  ),
  '/keys-trap/': html(`<header><a href="/fleet">Fleet</a></header><main><input aria-label="Stuck" onkeydown="if (event.key === 'Tab') event.preventDefault()"><a href="/b">Beyond</a></main>`),
  '/keys-banner/': html(
    `${header}${form}<div role="dialog" aria-modal="true" id="cmp"><p>We use cookies.</p><button onclick="cmp.remove()">Reject all</button><button onclick="cmp.remove()">Accept all</button></div>
     <script>document.addEventListener('keydown', e => { if (e.key === 'Tab' && document.getElementById('cmp') && !cmp.contains(document.activeElement)) { e.preventDefault(); cmp.querySelector('button').focus() } })</script>`,
  ),
  // skip link
  '/skip-good/': html(
    `<style>.skip{position:absolute;top:-100px;left:0}.skip:focus{top:0}</style><a class="skip" href="#main">Skip to content</a>${header}${form}`,
  ),
  '/skip-broken/': html(`<a href="#content">Skip to content</a>${header}${form}`),
  '/skip-none/': html(`${header}${form}`),
  // motion
  '/motion/': html(`<style>@keyframes spin{to{transform:rotate(1turn)}}.spin{width:60px;height:60px;background:red;animation:spin 2s linear infinite}</style><div class="spin"></div>`),
  '/still/': html(
    `<style>@keyframes spin{to{transform:rotate(1turn)}}.spin{width:60px;height:60px;background:red}@media (prefers-reduced-motion: no-preference){.spin{animation:spin 2s linear infinite}}</style><div class="spin"></div><button style="transition:opacity .2s">ok</button>`,
  ),
  // statement (http)
  '/a11y-good/': html('<footer><a href="/a11y-good/pristupnost">Vyhlásenie o prístupnosti</a></footer>'),
  '/a11y-good/pristupnost': html('<h1>Vyhlásenie o prístupnosti</h1><p>Stránka je v súlade s WCAG 2.1 AA podľa zákona č. 351/2022 Z. z.</p>'),
  '/a11y-vague/': html('<footer><a href="/a11y-vague/accessibility">Accessibility</a></footer>'),
  '/a11y-vague/accessibility': html('<h1>Accessibility</h1><p>We care about everyone.</p>'),
  '/a11y-none/': html('<footer><a href="/privacy">Privacy</a></footer>'),
})
afterAll(async () => {
  site.stop()
  await closeBrowser()
})

describe.skipIf(!available)('axe', () => {
  test('names the serious and critical rules and their counts', async () => {
    const outcome = await checkItem('accessibility/axe', site.url('/broken/'))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('button-name (critical) ×1')
    expect(outcome.evidence).toContain('image-alt (critical) ×1')
    expect(outcome.evidence).toContain('color-contrast (serious) ×1')
  })
  test('a clean page passes', async () => {
    expect(await checkItem('accessibility/axe', site.url('/clean/'))).toMatchObject({ state: 'pass', evidence: expect.stringContaining('no serious or critical axe violations') })
  })
})

describe.skipIf(!available)('keyboard-nav', () => {
  test('passes a page with native controls and default focus rings', async () => {
    expect(await checkItem('accessibility/keyboard-nav', site.url('/clean/'))).toMatchObject({ state: 'pass', evidence: expect.stringContaining('Tab reaches all 5 header and form controls') })
  })
  test('fails a link Tab skips and focus that shows nothing', async () => {
    const outcome = await checkItem('accessibility/keyboard-nav', site.url('/keys-bad/'))
    expect(outcome.state).toBe('fail')
    expect(outcome.evidence).toContain('never reach "Locations" (a)')
    expect(outcome.evidence).toContain('no visible focus on "Fleet" (a)')
  })
  test('fails a control that holds focus', async () => {
    const outcome = await checkItem('accessibility/keyboard-nav', site.url('/keys-trap/'))
    expect(outcome).toMatchObject({ state: 'fail', evidence: expect.stringContaining('focus stays on "Stuck" (input)') })
  })
  test('closes a cookie dialog that holds focus first', async () => {
    expect(await checkItem('accessibility/keyboard-nav', site.url('/keys-banner/'))).toMatchObject({
      state: 'pass',
      evidence: expect.stringContaining('after closing the cookie banner ("Reject all")'),
    })
  })
})

describe.skipIf(!available)('skip-link', () => {
  test('passes a hidden link that shows on focus and points at main', async () => {
    expect(await checkItem('accessibility/skip-link', site.url('/skip-good/'))).toMatchObject({ state: 'pass', evidence: 'skip link "Skip to content" → #main, visible when focused (/skip-good/; desktop)' })
  })
  test('fails a skip link to nothing, and a page without one', async () => {
    expect(await checkItem('accessibility/skip-link', site.url('/skip-broken/'))).toMatchObject({ state: 'fail', evidence: expect.stringContaining('points at #content, which no element') })
    expect(await checkItem('accessibility/skip-link', site.url('/skip-none/'))).toMatchObject({ state: 'fail', evidence: expect.stringContaining('no skip link: the first Tab stop is "Fleet" (a → /fleet)') })
  })
})

describe.skipIf(!available)('reduced-motion', () => {
  test('fails a looping animation that ignores the setting', async () => {
    expect(await checkItem('accessibility/reduced-motion', site.url('/motion/'))).toMatchObject({ state: 'fail', evidence: expect.stringContaining('div.spin (spin): CSS animation, looping') })
  })
  test('passes motion behind prefers-reduced-motion and short transitions', async () => {
    expect((await checkItem('accessibility/reduced-motion', site.url('/still/'))).state).toBe('pass')
  })
})

describe('accessibility-statement', () => {
  test('passes a linked statement that names its standard', async () => {
    expect(await checkItem('accessibility/accessibility-statement', site.url('/a11y-good/'))).toEqual({
      state: 'pass',
      evidence: '"vyhlásenie o prístupnosti" → /a11y-good/pristupnost, which names WCAG',
    })
  })
  test('fails a statement without a standard, and a site without one', async () => {
    expect(await checkItem('accessibility/accessibility-statement', site.url('/a11y-vague/'))).toMatchObject({ state: 'fail', evidence: expect.stringContaining('/a11y-vague/accessibility names no standard') })
    expect(await checkItem('accessibility/accessibility-statement', site.url('/a11y-none/'))).toMatchObject({ state: 'fail', evidence: expect.stringContaining('links no accessibility statement') })
  })
})
