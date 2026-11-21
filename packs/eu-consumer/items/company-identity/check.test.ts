import { afterAll, expect, test } from 'bun:test'
import { pagesFor } from './check.ts'
import { pagesFor as adrPages, odrLinks } from '../adr-info/check.ts'

// The AI's answer is not tested here (it needs `claude`); what it reads is.
const html = (body: string) => new Response(`<html lang="sk"><body>${body}</body></html>`, { headers: { 'content-type': 'text/html' } })
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/') {
      return html(`<nav><a href="/kontakt">KONTAKT</a><a href="https://other.example/vop">VOP partnera</a></nav>
        <footer><a href="/o-nas">O nás</a><a href="/sluzby/podmienky-prenajmu-vozidla">Podmienky prenájmu</a>
        <a href="/sluzby/vseobecne-obchodne-podmienky">Všeobecné obchodné podmienky</a><a href="/sluzby/reklamacny-poriadok">Reklamačný poriadok</a></footer>`)
    }
    if (pathname === '/o-nas') return new Response('gone', { status: 404 })
    if (pathname === '/sluzby/reklamacny-poriadok') return html('<a href="https://ec.europa.eu/consumers/odr/">platforma RSO</a>')
    return html('page')
  },
})
afterAll(() => server.stop(true))
const base = `http://localhost:${server.port}`

test('reads the home page, the contact page and the general terms, on the site itself, leaving out pages that do not answer', async () => {
  expect(await pagesFor(`${base}/`)).toEqual([`${base}/`, `${base}/kontakt`, `${base}/sluzby/vseobecne-obchodne-podmienky`])
})

test('adr-info reads the terms and the complaints procedure, and finds the stale ODR link', async () => {
  const pages = (await adrPages(`${base}/`)) ?? []
  expect(pages).toEqual([`${base}/`, `${base}/sluzby/vseobecne-obchodne-podmienky`, `${base}/sluzby/reklamacny-poriadok`])
  expect(await odrLinks(pages)).toEqual([`${base}/sluzby/reklamacny-poriadok`])
})
