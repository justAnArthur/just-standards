import { afterAll, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import privacyPolicy from './check.ts'

const page = (lang: string, footer: string) => `<html lang="${lang}"><body><main>text</main><footer>${footer}</footer></body></html>`
// Two sites under one server: /bad/ misses the policy in three ways, /good/ links it everywhere.
const sites: Record<string, Record<string, string>> = {
  bad: {
    '': page('sk-SK', '<a href="/bad/gdpr">Ochrana osobných údajov</a>'),
    a: page('sk', '<a href="/bad/privacy">Privacy policy</a>'),
    b: page('sk', '<a href="/bad/cookies">Pravidlá pre súbory cookie</a>'),
    en: page('en', '<a href="/bad/gone">Privacy</a>'),
    gdpr: page('sk', 'policy'),
  },
  good: {
    '': page('sk', '<a href="/good/sluzby/informacia-o-spracuvani-osobnych-udajov">Informácie o spracúvaní osobných údajov</a>'),
    en: page('en', '<a href="/good/privacy"><img alt="Privacy policy" src="/i.svg"></a>'),
    fo: page('fo', '<a href="/good/dv">Dátuvernd</a>'),
    'sluzby/informacia-o-spracuvani-osobnych-udajov': page('sk', 'policy'),
    privacy: page('en', 'policy'),
    dv: page('fo', 'policy'),
  },
}
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { origin, pathname } = new URL(request.url)
    const [, site = '', ...rest] = pathname.split('/')
    const path = rest.join('/')
    const pages = sites[site]
    if (!pages) return new Response('nope', { status: 404 })
    if (path === 'robots.txt') return new Response(`Sitemap: ${origin}/${site}/sitemap.xml`)
    if (path === 'sitemap.xml') {
      const listed = Object.keys(pages).filter(p => p && !['gdpr', 'privacy', 'dv', 'sluzby/informacia-o-spracuvani-osobnych-udajov'].includes(p))
      return new Response(`<urlset>${listed.map(p => `<url><loc>${origin}/${site}/${p}</loc></url>`).join('')}</urlset>`)
    }
    const html = pages[path]
    return html ? new Response(html, { headers: { 'content-type': 'text/html' } }) : new Response('nope', { status: 404 })
  },
})
afterAll(() => server.stop(true))
const ctx = (site: string) => ({ asset: { id: site, kind: 'website', url: `http://localhost:${server.port}/${site}/` } }) as Context

test('fails a page without the link, a link in another language, and a policy that answers 404', async () => {
  const outcome = await privacyPolicy(ctx('bad'))
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('/bad/a links no privacy policy in its language (sk); it links "privacy policy", not in sk')
  expect(outcome.evidence).toContain('/bad/b links no privacy policy in its language (sk)')
  expect(outcome.evidence).toContain('/bad/en: its privacy policy /bad/gone answered 404')
  expect(outcome.evidence).toContain('(4 pages checked)')
})

test('passes Slovak, English (an image link) and Faroese pages that each link a policy', async () => {
  expect(await privacyPolicy(ctx('good'))).toMatchObject({ state: 'pass', evidence: expect.stringContaining('3 pages link a privacy policy that answers 200') })
})
