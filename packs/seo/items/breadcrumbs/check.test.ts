import { afterAll, expect, test } from 'bun:test'
import { html, site } from '../../fixture.ts'
import breadcrumbs from './check.ts'

const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`
const list = (o: string, ...names: string[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: names.map((name, i) => ({ '@type': 'ListItem', position: i + 1, name, item: i < names.length - 1 ? `${o}/${i}` : undefined })),
})

const ok = site({
  '/': html('<title>Home</title>'),
  '/en': html('<title>Home in English</title>'),
  // in an @graph
  '/fleet': o => html(ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'Acme' }, list(o, 'Home', 'Fleet')] })),
  // nested in a WebPage, in an array
  '/fleet/van': o => html(ld([{ '@type': 'WebPage', breadcrumb: list(o, 'Home', 'Fleet', 'Van') }])),
  // microdata counts
  '/contact': html('', '<ol itemscope itemtype="https://schema.org/BreadcrumbList"><li>Home</li></ol>'),
})
const bad = site({
  '/': html(''),
  '/about': html(ld({ '@type': 'Organization', name: 'Acme' })),
  '/broken': html('<script type="application/ld+json">{ not json</script>'),
  '/nameless': o => html(ld({ '@type': 'BreadcrumbList', itemListElement: [{ position: 1, item: `${o}/` }, { position: 2, name: 'Nameless' }] })),
})
afterAll(() => [ok, bad].forEach(s => s.server.stop(true)))

test('BreadcrumbList in @graph, nested, or as microdata passes; home pages need none', async () => {
  expect(await breadcrumbs(ok.ctx())).toEqual({
    state: 'pass',
    evidence: 'every inner page carries a BreadcrumbList (3 inner pages, 1 with microdata breadcrumbs)',
  })
})

test('names the inner pages without one, unparseable JSON-LD and incomplete lists', async () => {
  const outcome = await breadcrumbs(bad.ctx())
  expect(outcome).toEqual({
    state: 'fail',
    evidence: "2 of 3 inner pages have no BreadcrumbList: /about, /broken (1 JSON-LD block don't parse); /nameless: BreadcrumbList item 1 has no name (3 inner pages)",
  })
})
