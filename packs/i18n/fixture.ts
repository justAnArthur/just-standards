import { site } from '../seo/fixture.ts'

const page = (lang: string, head: string, body: string) => `<!doctype html><html lang="${lang}"><head>${head}</head><body>${body}</body></html>`
const alt = (origin: string, sk: string, en: string) =>
  `<link rel="alternate" hreflang="sk" href="${origin}${sk}"><link rel="alternate" hreflang="en" href="${origin}${en}"><link rel="alternate" hreflang="x-default" href="${origin}${sk}">`

/**
 * A two-language site: Slovak at the root, English under `/en`. `good` keeps the page in the switcher, answers 404 for an
 * unknown locale and serves every locale's home; otherwise the switcher goes home, `/xx/` renders a page and `/en` is a 500.
 */
export function bilingual(good: boolean) {
  return site({
    '/': origin => page('sk', alt(origin, '/', '/en'), '<nav><a href="/en" hreflang="en">English</a></nav><h1>Požičovňa áut</h1>'),
    '/en': origin => (good ? page('en', alt(origin, '/', '/en'), '<nav><a href="/">Slovensky</a></nav><h1>Car rental</h1>') : new Response('crash', { status: 500 })),
    '/flotila': origin => page('sk', alt(origin, '/flotila', '/en/fleet'), `<nav><a href="${good ? '/en/fleet' : '/en'}">EN</a></nav><h1>Flotila</h1>`),
    '/en/fleet': origin => page('en', alt(origin, '/flotila', '/en/fleet'), `<nav><a href="${good ? '/flotila' : '/'}">SK</a></nav><h1>Fleet</h1>`),
    // a Slovak-only page: its alternates leave English out, so the switcher's way home is right
    '/blog/novinka': origin => page('sk', `<link rel="alternate" hreflang="sk" href="${origin}/blog/novinka">`, '<a href="/en">EN</a><h1>Novinka</h1>'),
    ...(good ? {} : { '/xx/': page('xx', '', '<h1>Car rental</h1>'), '/zz-ZZ/': page('zz', '', '<h1>Car rental</h1>') }),
  })
}

export const monolingual = () => site({ '/': page('sk', '', '<h1>Požičovňa áut</h1><a href="/kontakt">Kontakt</a>'), '/kontakt': page('sk', '', '<h1>Kontakt</h1>') })
