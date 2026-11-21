import { afterAll, expect, test } from 'bun:test'
import { pagesFor as answerPages } from '../answers/check.ts'
import { pagesFor } from './check.ts'
import { jsonLdSection } from '../../pages.ts'

// The AI's answer is not tested here (it needs `claude`); what it reads is.
const html = (body: string) => new Response(`<html lang="en"><body>${body}</body></html>`, { headers: { 'content-type': 'text/html' } })
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/') {
      return html(`<script type="application/ld+json">{"@type":"AutoRental","telephone":"+298 358800"}</script>
        <a href="/en/contact">Contact us</a><a href="/en/faq">FAQ</a><a href="/en/services/rental-terms-and-conditions">Vehicle Rental Conditions</a>
        <a href="/en/terms">Terms</a><a href="/pricing">Prices</a>`)
    }
    if (pathname === '/pricing') return new Response('gone', { status: 404 })
    if (pathname === '/bare/') return html('<p>no links</p>')
    return html('page')
  },
})
afterAll(() => server.stop(true))
const base = `http://localhost:${server.port}`

test('entity-facts reads the home page and the contact page, and hands the model their JSON-LD', async () => {
  const found = await pagesFor(`${base}/`)
  expect(found?.pages.map(page => page.url)).toEqual([`${base}/`, `${base}/en/contact`])
  expect(await jsonLdSection(found?.pages ?? [])).toContain('"telephone":"+298 358800"')
  expect(await pagesFor(`${base}/bare/`)).toMatchObject({ contactFound: false })
  expect(await jsonLdSection([{ url: base, html: '<p></p>' }])).toBe('The pages carry no JSON-LD.')
})

test('answers reads the home page, the FAQ and the rental conditions, leaving out pages that do not answer', async () => {
  expect(await answerPages(`${base}/`)).toEqual([`${base}/`, `${base}/en/faq`, `${base}/en/services/rental-terms-and-conditions`])
})
