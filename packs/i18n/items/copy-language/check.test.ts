import { expect, test } from 'bun:test'
import { localesOf } from '../../locales.ts'
import { samplesOf } from './check.ts'

// The AI's answer is not tested here (it needs `claude`); which pages it reads per language is.
test('each language gets its home and a crawled page in that language', async () => {
  const locales = await localesOf('https://acme.sk/', '<html lang="sk"><head><link rel="alternate" hreflang="en" href="https://acme.sk/en"></head></html>')
  const page = (url: string, lang: string) => ({ url, final: url, html: `<html lang="${lang}"><body>x</body></html>` })
  const pages = [page('https://acme.sk/', 'sk'), page('https://acme.sk/en', 'en'), page('https://acme.sk/flotila', 'sk'), page('https://acme.sk/en/fleet', 'en-GB'), page('https://acme.sk/kontakt', 'sk')]
  expect((await samplesOf(locales, pages)).map(sample => sample.pages)).toEqual([
    ['https://acme.sk/', 'https://acme.sk/flotila'],
    ['https://acme.sk/en', 'https://acme.sk/en/fleet'],
  ])
})
