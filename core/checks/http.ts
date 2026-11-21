import { assertValue, get } from '../expect.ts'
import { select } from '../html.ts'
import type { Check, HttpExpect, Outcome } from '../schema.ts'
import type { Context } from './context.ts'

type HttpCheck = Extract<Check, { kind: 'http' }>

/** Paths are relative to the asset's URL, so a site served under a subpath (`/modo/`) is checked there. */
export const resolve = (path: string, base: string) => new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`).href

const VALUE_KEYS = ['equals', 'matches', 'not_matches', 'min_length', 'max_length', 'absolute_url', 'json', 'follow', 'self'] as const

/** The first way one page misses one expectation, or undefined. `response` needs only its status and headers. */
export async function expectOne(expect: HttpExpect, response: Pick<Response, 'status' | 'headers'>, body: string, url: string) {
  if ('status' in expect) {
    return response.status === expect.status ? undefined : `${url} answered ${response.status}, expected ${expect.status}`
  }
  if ('header' in expect) return assertValue(`header ${expect.header}`, response.headers.get(expect.header) ?? undefined, expect, url)
  if ('body' in expect) return assertValue(`body of ${url}`, body, expect, url)

  const elements = await select(body, expect.select)
  const label = expect.attr ? `${expect.select} @${expect.attr}` : expect.select
  const counted = expect.min_count !== undefined || expect.max_count !== undefined
  if (expect.min_count !== undefined && elements.length < expect.min_count) {
    return `${elements.length} ${expect.select} on ${url}, expected at least ${expect.min_count}`
  }
  if (expect.max_count !== undefined && elements.length > expect.max_count) {
    return `${elements.length} ${expect.select} on ${url}, expected at most ${expect.max_count}`
  }
  if (elements.length === 0) return expect.optional || counted ? undefined : `${expect.select} not found on ${url}`
  // A count alone says nothing about the elements' values.
  if (counted && !expect.attr && !VALUE_KEYS.some(key => expect[key] !== undefined)) return undefined
  const failures = await Promise.all(
    elements.map(element => assertValue(label, expect.attr ? element.attrs[expect.attr] : element.text.trim(), expect, url)),
  )
  // one matching element is enough: pages often carry several JSON-LD blocks or icons
  return failures.includes(undefined) ? undefined : failures[0]
}

export async function http(check: HttpCheck, { asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const failures: string[] = []

  for (const request of check.requests) {
    const url = resolve(request.path, asset.url)
    let response: Response
    try {
      response = await get(url, { headers: request.headers })
    } catch (error) {
      return { state: 'error', evidence: `${url} did not respond (${(error as Error).message})` }
    }
    if (response.status >= 500) return { state: 'error', evidence: `${url} answered ${response.status}` }
    const body = await response.text()
    for (const expect of request.expect) {
      const failure = await expectOne(expect, response, body, url)
      if (failure) failures.push(failure)
    }
  }
  if (failures.length > 0) return { state: 'fail', evidence: failures.join('; ') }
  return { state: 'pass', evidence: check.requests.map(request => resolve(request.path, asset.url as string)).join(', ') }
}
