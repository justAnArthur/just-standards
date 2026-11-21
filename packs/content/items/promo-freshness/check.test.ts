import { expect, test } from 'bun:test'
import { offerPages } from './check.ts'

// The AI's answer is not tested here (it needs `claude`); which pages it reads is.
const home = 'https://www.avis.sk/'
const html = `<nav><a href="/">Domov</a><a href="/blog/7-miest-na-leto">Leto na cestách</a><a href="/obchodne-podmienky">Obchodné podmienky</a></nav>
<section><a href="/aktuality/black-friday-2026#top">Black Friday</a><a href="https://other.example/akcia">Partner</a>
<a href="/flotila">Vozidlá</a><a href="/sk/special">Ponuka mesiaca</a><a href="/aktuality/black-friday-2026">again</a>
<a href="/zimne-pneumatiky">Zimné pneumatiky</a><a href="/extra-zlavy">Extra zľavy</a></section>`

test('offer pages: by path or text, on the site, no blog or terms, each once, at most three', async () => {
  expect(await offerPages(html, home)).toEqual([
    'https://www.avis.sk/aktuality/black-friday-2026',
    'https://www.avis.sk/sk/special',
    'https://www.avis.sk/zimne-pneumatiky',
  ])
})
