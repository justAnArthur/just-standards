import type { Context } from '../../../../core/checks/context.ts'
import { pathOf } from '../../../../core/crawl.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { htmlPages, isHome, some } from '../../shared.ts'

type Node = Record<string, unknown>

const isType = (node: Node, type: string) => {
  const types = node['@type']
  return Array.isArray(types) ? types.includes(type) : types === type
}

/** Every object in a JSON-LD value: through arrays, `@graph` and nested properties (a WebPage's `breadcrumb`). */
function* nodes(value: unknown): Generator<Node> {
  if (Array.isArray(value)) for (const entry of value) yield* nodes(entry)
  else if (value && typeof value === 'object') {
    yield value as Node
    for (const child of Object.values(value)) yield* nodes(child)
  }
}

/** What Google needs of a BreadcrumbList: ListItems with a position and a name, each but the last with its URL. */
function listProblem(list: Node) {
  const items = list.itemListElement
  if (!Array.isArray(items) || items.length === 0) return 'has no itemListElement'
  for (const [i, raw] of items.entries()) {
    const item = (raw ?? {}) as Node
    const target = item.item
    const name = item.name ?? (target && typeof target === 'object' ? (target as Node).name : undefined)
    if (item.position === undefined) return `item ${i + 1} has no position`
    if (typeof name !== 'string' || !name.trim()) return `item ${i + 1} has no name`
    const url = typeof target === 'string' ? target : target && typeof target === 'object' ? ((target as Node)['@id'] ?? (target as Node).url) : undefined
    if (i < items.length - 1 && typeof url !== 'string') return `item ${i + 1} has no item URL`
  }
}

async function breadcrumbsOf(html: string) {
  const lists: Node[] = []
  let invalid = 0
  for (const script of await select(html, 'script[type="application/ld+json"]')) {
    try {
      for (const node of nodes(JSON.parse(script.text))) if (isType(node, 'BreadcrumbList')) lists.push(node)
    } catch {
      invalid++
    }
  }
  const microdata = (await select(html, '[itemtype$="BreadcrumbList"]')).length > 0
  return { lists, invalid, microdata }
}

export default async function breadcrumbs(ctx: Context): Promise<Outcome> {
  const pages = await htmlPages(ctx)
  if (!Array.isArray(pages)) return pages
  const inner = pages.filter(page => !isHome(page.final, ctx.asset.url as string))
  if (inner.length === 0) return { state: 'pass', evidence: `no inner pages among the ${pages.length} crawled: nothing to place` }

  const without: string[] = []
  const problems: string[] = []
  let viaMicrodata = 0
  for (const page of inner) {
    const { lists, invalid, microdata } = await breadcrumbsOf(page.html)
    const path = pathOf(page.url)
    if (lists.length === 0) {
      if (microdata) viaMicrodata++
      else without.push(invalid ? `${path} (${invalid} JSON-LD block${invalid > 1 ? 's' : ''} don't parse)` : path)
      continue
    }
    const problem = lists.map(listProblem).find(Boolean)
    if (problem && lists.every(list => listProblem(list))) problems.push(`${path}: BreadcrumbList ${problem}`)
  }

  if (without.length) problems.unshift(`${without.length} of ${inner.length} inner pages have no BreadcrumbList: ${some(without, 4, ', ')}`)
  const sample = `${inner.length} inner pages${viaMicrodata ? `, ${viaMicrodata} with microdata breadcrumbs` : ''}`
  if (problems.length > 0) return { state: 'fail', evidence: `${some(problems)} (${sample})` }
  return { state: 'pass', evidence: `every inner page carries a BreadcrumbList (${sample})` }
}
