import { afterAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runCheck } from '../../core/checks/index.ts'
import type { LoadedItem } from '../../core/load.ts'
import { Item } from '../../core/schema.ts'
import { html, site } from './fixture.ts'

// The crawl items as their item.yml says, on a site where each page breaks one of them.
const item = async (id: string) => Item.parse(Bun.YAML.parse(await Bun.file(join(import.meta.dir, 'items', id, 'item.yml')).text())) as LoadedItem
const description = 'Car and van rental at the airport and in the city centre, with free cancellation up to a day before.'
const head = (title: string, path: string, o: string, extra = '') =>
  `<title>${title}</title><meta name="description" content="${description} ${path}"><link rel="canonical" href="${o}${path}">${extra}`

const s = site({
  '/': o => html(head('Acme rentals: cars and vans', '/', o), '<svg><title>x</title></svg><h1>Acme</h1>'),
  '/vans': o => html(head('Vans for every move · Acme', '/vans', o), '<h1>Vans</h1>'),
  '/cars': o => html(head('Vans for every move · Acme', '/cars', o), '<h1>Cars</h1><h1>More</h1>'),
  '/staging': o => html(head('A page left from staging', '/', o, '<meta name="ROBOTS" content="NOINDEX, follow">'), ''),
  '/header': () => new Response(html('<title>Hidden by a header</title>', '<h1>x</h1>'), { headers: { 'content-type': 'text/html', 'x-robots-tag': 'none' } }),
})
afterAll(() => s.server.stop(true))

const check = async (id: string) => runCheck({ business: s.ctx().business, asset: s.ctx().asset, item: await item(id) })

test('titles: unique, from <head>, not an inline SVG title', async () => {
  const outcome = await check('titles')
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('head > title "Vans for every move · Acme" on both /vans and /cars')
  expect(outcome.evidence).not.toContain('"x"')
})

test('canonical-self: a sitemap page canonicalizing elsewhere fails', async () => {
  const outcome = await check('canonical-self')
  expect(outcome.evidence).toContain('/staging: link[rel="canonical"] @href is')
  expect(outcome.evidence).toContain('/header: link[rel="canonical"] not found')
})

test('one-h1: none and two both fail', async () => {
  const outcome = await check('one-h1')
  expect(outcome.evidence).toContain('/cars: 2 h1, expected at most 1')
  expect(outcome.evidence).toContain('/staging: 0 h1, expected at least 1')
})

test('indexable: noindex in any case, and x-robots-tag none', async () => {
  const outcome = await check('indexable')
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('/staging: meta[name="robots" i] @content matches')
  expect(outcome.evidence).toContain('/header: header x-robots-tag matches')
  expect(outcome.evidence).not.toContain('/vans')
})

test('descriptions: present and unique', async () => {
  const outcome = await check('descriptions')
  expect(outcome.evidence).toContain('/header: meta[name="description"] not found')
  expect(outcome.evidence).toContain('on both / and /staging')
  expect(outcome.evidence).not.toContain('/vans')
})
