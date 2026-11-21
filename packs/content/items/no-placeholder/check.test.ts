import { afterAll, describe, expect, test } from 'bun:test'
import { html, site } from '../../../seo/fixture.ts'
import noPlaceholder, { leftovers } from './check.ts'

describe('leftovers', () => {
  test('finds filler, to-dos, templates, code values and unfinished sections in visible text', async () => {
    const body = [
      '<p>Lorem ipsum dolor sit amet, consectetur.</p>',
      '<h2>TODO: write the intro</h2>',
      '<p>Hello {{ user.name }}</p><p>Ahoj {firstName}</p>',
      '<span>Cena: <!-- -->NaN<!-- --> €</span><span>undefined</span>',
      '<section><h2>Coming soon</h2></section>',
      '<a href="/vozidla/undefined">Detail</a>',
    ].join('')
    const found = await leftovers(html('', body))
    expect(found).toEqual([
      'filler text "Lorem ipsum dolor sit amet, consectetur."',
      'a to-do "TODO: write the intro"',
      'an unfilled template "Hello {{ user.name }}"',
      'an unfilled template "Ahoj {firstName}"',
      'a value rendered as text "NaN"',
      'a value rendered as text "undefined"',
      'an unfinished section "Coming soon"',
      'a URL built from a missing value "/vozidla/undefined"',
    ])
  })

  test('leaves alone what only looks like one: scripts, code samples, prose, JSON-LD', async () => {
    const body = [
      '<script>if (x === undefined) render("{{x}}")</script>',
      '<script type="application/ld+json">{"price": null}</script>',
      '<pre><code>const name = `${first}`; {props}</code></pre>',
      '<p>The contract is null and void. Nancy said "todo bien".</p>',
      '<p>Our new branch opens soon — and much more is coming soon to all of our rental locations across the country this winter.</p>',
      '<a href="/nullarbor">Nullarbor</a>',
    ].join('')
    expect(await leftovers(html('<title>{{ignored in head}}</title>', body))).toEqual([])
  })
})

const clean = site({ '/': html('<title>Acme</title>', '<h1>Acme</h1><p>Rent a car from 22 €/day.</p>') })
const dirty = site({ '/': html('', '<h1>Acme</h1>'), '/fleet': html('', '<p>from <!-- -->undefined<!-- --> €/day</p>') })
afterAll(() => [clean, dirty].forEach(s => s.server.stop(true)))

test('passes clean pages, fails a leftover naming its page', async () => {
  expect((await noPlaceholder(clean.ctx())).state).toBe('pass')
  const outcome = await noPlaceholder(dirty.ctx())
  expect(outcome).toEqual({ state: 'fail', evidence: '/fleet: a value rendered as text "undefined" (2 pages checked)' })
})
