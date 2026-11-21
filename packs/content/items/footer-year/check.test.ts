import { afterAll, describe, expect, test } from 'bun:test'
import { html, site } from '../../../seo/fixture.ts'
import footerYear, { judge, siteNotice } from './check.ts'

const now = new Date('2026-11-21T10:00:00Z')
const notice = (body: string) => siteNotice(html('<meta name="description" content="MIT © 2019 Someone">', body))

describe('siteNotice', () => {
  test('the footer notice, with its latest year, over credits elsewhere on the page', () => {
    expect(notice('<p>Photo © 2019 J. Doe</p><footer><a href="/copyright">Copyright</a><p>© 2015–2026 Acme s.r.o.</p></footer>')).toEqual({
      text: '© 2015–2026 Acme s.r.o.',
      year: 2026,
      empty: false,
    })
  })
  test("React's markers: a year that is there, and one only JavaScript fills in", () => {
    expect(notice('<footer><p>© Copyright <!-- -->2026<!-- --> AVIS Car Rental</p></footer>')?.year).toBe(2026)
    expect(notice('<footer><p>© Copyright <!-- --> <!-- --> Avis Car Rental</p></footer>')).toEqual({ text: '© Copyright Avis Car Rental', year: undefined, empty: true })
  })
  test('no footer: the last notice on the page; scripts and the head never count', () => {
    expect(notice('<script>var c = "© 2020"</script><div>&copy; 2024 Acme</div>')?.year).toBe(2024)
    expect(notice('<div id="root"></div>')).toBeUndefined()
  })
})

describe('judge', () => {
  const at = (year: number | undefined, empty = false) => judge({ text: `© ${year ?? ''} Acme`, year, empty }, now)
  test('the current year passes; a past, a future or a missing one fails', () => {
    expect(at(2026).state).toBe('pass')
    expect(at(2025).evidence).toBe('"© 2025 Acme" states 2025, not 2026: the footer looks unmaintained')
    expect(at(2027).state).toBe('fail')
    expect(at(undefined, true).evidence).toContain('rendered only by JavaScript')
    expect(at(undefined).state).toBe('pass')
    expect(judge(undefined, now).evidence).toBe('no copyright notice in the HTML as served')
  })
  test("last year's notice passes in the first two weeks of January", () => {
    expect(judge({ text: '© 2026', year: 2026, empty: false }, new Date('2027-01-10T00:00:00Z')).state).toBe('pass')
    expect(judge({ text: '© 2026', year: 2026, empty: false }, new Date('2027-01-20T00:00:00Z')).state).toBe('fail')
  })
})

const old = site({ '/': html('', '<footer><small>Copyright (c) 2023 Acme</small></footer>') })
afterAll(() => old.server.stop(true))
test('reads the home page', async () => {
  expect(await footerYear(old.ctx(), now)).toEqual({ state: 'fail', evidence: '"Copyright (c) 2023 Acme" states 2023, not 2026: the footer looks unmaintained' })
})
