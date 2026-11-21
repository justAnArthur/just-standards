import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../../local-business/fixture.ts'
import bookingEntry, { bookingForm } from './check.ts'

const linked = site({
  '/': html('', '<a href="/blog/rezervacia-vozidla">Rezervácia vozidla</a><a href="/rezervacia/sprava">Moja rezervácia</a><a href="/rezervacia/auto">Hľadaj vozidlá</a>'),
  '/rezervacia/auto': html('', 'Booking'),
  '/blog/rezervacia-vozidla': html('', 'Post'),
})
const broken = site({ '/': html('', '<a href="/booking">Book now</a>') })
const none = site({ '/': html('', '<h1>Cars</h1><a href="/blog">Blog</a>') })
afterAll(() => [linked, broken, none].forEach(s => s.server.stop(true)))

test('a search link into the booking flow that answers passes; posts and "my booking" are not it', async () => {
  expect(await bookingEntry(linked.ctx())).toEqual({
    state: 'pass',
    evidence: `the home page as served carries the link "hľadaj vozidlá" → ${linked.url}/rezervacia/auto answers 200`,
  })
})

test('a booking link that 404s fails', async () => {
  expect(await bookingEntry(broken.ctx())).toEqual({
    state: 'fail',
    evidence: `the home page's booking links don't work: "book now" → /booking answers 404; and no booking form with place and date fields`,
  })
})

test('no form and no link fails', async () => {
  expect((await bookingEntry(none.ctx())).state).toBe('fail')
})

test('a form with a pick-up place and a date, as inputs or as a widget\'s labels', async () => {
  expect(await bookingForm('<form><label for="p">Miesto vyzdvihnutia</label><select id="p"></select><input type="date" name="from"></form>')).toBeTruthy()
  expect(await bookingForm('<div><p>Pick-up location</p><button>Bratislava</button><p>Date from</p><button>Choose a date</button></div>')).toBeTruthy()
  expect(await bookingForm('<form><input type="email" name="email" placeholder="E-mail"></form>')).toBeUndefined()
})
