import { afterAll, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import terms from './check.ts'

const home = (lang: string, links: string) => `<html lang="${lang}"><body><footer>${links}</footer></body></html>`
const pages: Record<string, string> = {
  '/vop/': home('sk', '<a href="/sluzby/vop">Všeobecné obchodné podmienky</a><a href="/sluzby/reklamacny-poriadok">Reklamačný poriadok</a><a href="/podmienky-gdpr">Podmienky ochrany osobných údajov</a>'),
  '/en-on-sk/': home('sk', '<a href="/terms">Terms and conditions</a>'),
  '/broken/': home('en', '<a href="/missing">Rental conditions</a>'),
  '/none/': home('de', '<a href="/datenschutz">Datenschutz</a>'),
  '/sluzby/vop': 'terms',
  '/sluzby/reklamacny-poriadok': 'complaints',
}
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const html = pages[new URL(request.url).pathname]
    return html ? new Response(html, { headers: { 'content-type': 'text/html' } }) : new Response('nope', { status: 404 })
  },
})
afterAll(() => server.stop(true))
const ctx = (path: string) => ({ asset: { id: 'site', kind: 'website', url: `http://localhost:${server.port}${path}` } }) as Context

test('passes the terms and the complaints procedure, and leaves the privacy terms out', async () => {
  const outcome = await terms(ctx('/vop/'))
  expect(outcome).toEqual({
    state: 'pass',
    evidence: '"všeobecné obchodné podmienky" /sluzby/vop, "reklamačný poriadok" /sluzby/reklamacny-poriadok answer 200',
  })
})

test('fails terms in another language, a broken link, and no link at all', async () => {
  expect((await terms(ctx('/en-on-sk/'))).evidence).toBe('the home page links no terms or rental conditions in its language (sk); it links "terms and conditions", not in sk')
  expect((await terms(ctx('/broken/'))).evidence).toBe(`"rental conditions" http://localhost:${server.port}/missing answered 404`)
  expect(await terms(ctx('/none/'))).toEqual({ state: 'fail', evidence: 'the home page links no terms or rental conditions in its language (de)' })
})
