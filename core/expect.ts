import type { ValueAssertion } from './schema.ts'

const USER_AGENT = 'just-standards/0.1 (+https://github.com/justAnArthur/just-standards)'

const extraHeaders = new Map<string, Record<string, string>>()

/** Headers `get` sends with every request to `origin`, such as a preview deployment's protection bypass. */
export function authorize(origin: string, headers: Record<string, string>) {
  extraHeaders.set(new URL(origin).origin, headers)
}

export function get(url: string, init: RequestInit = {}) {
  return fetch(url, {
    redirect: 'follow',
    ...init,
    headers: { 'user-agent': USER_AGENT, ...extraHeaders.get(new URL(url).origin), ...init.headers },
    signal: AbortSignal.timeout(20_000),
  })
}

const isEmpty = (value: string | string[] | undefined) => value === undefined || value.length === 0

async function follow(url: string, expect: NonNullable<ValueAssertion['follow']>) {
  let response: Response
  try {
    response = await get(url)
  } catch (error) {
    return `${url} did not respond (${(error as Error).message})`
  }
  await response.body?.cancel()
  if (response.status !== expect.status) return `${url} answered ${response.status}, expected ${expect.status}`
  const type = response.headers.get('content-type') ?? ''
  if (expect.content_type && !type.startsWith(expect.content_type)) {
    return `${url} is ${type || 'untyped'}, expected ${expect.content_type}`
  }
  const bytes = Number(response.headers.get('content-length'))
  if (expect.max_bytes && bytes > expect.max_bytes) return `${url} is ${bytes} bytes, over ${expect.max_bytes}`
}

/** A URL without its fragment or a trailing slash, for comparing two spellings of one page. */
export const sameUrl = (a: string, b: string) => {
  const plain = (url: string) => {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.href.replace(/\/$/, '')
  }
  return plain(a) === plain(b)
}

/** The first way `value` misses the assertion, or undefined when it holds. `base` resolves relative URLs: it is the page's URL. */
export async function assertValue(label: string, value: string | string[] | undefined, a: ValueAssertion, base?: string) {
  if (isEmpty(value)) return a.optional ? undefined : `${label} is missing`
  const text = Array.isArray(value) ? value.join(', ') : (value as string)
  const shown = text.length > 80 ? `${text.slice(0, 77)}…` : text

  if (a.equals !== undefined && text !== a.equals) return `${label} is "${shown}", expected "${a.equals}"`
  if (a.matches && !new RegExp(a.matches, 'i').test(text)) return `${label} does not match /${a.matches}/`
  if (a.not_matches && new RegExp(a.not_matches, 'i').test(text)) return `${label} matches /${a.not_matches}/`
  const length = (value as string | string[]).length
  if (a.min_length !== undefined && length < a.min_length) return `${label} has length ${length}, under ${a.min_length}`
  if (a.max_length !== undefined && length > a.max_length) return `${label} has length ${length}, over ${a.max_length}`
  if (a.absolute_url && !/^https?:\/\//.test(text)) return `${label} is not an absolute URL: "${shown}"`
  if (a.json) {
    try {
      JSON.parse(text)
    } catch {
      return `${label} is not valid JSON`
    }
  }
  if (a.self && base) {
    let resolved: string
    try {
      resolved = new URL(text, base).href
    } catch {
      return `${label} "${shown}" is not a URL`
    }
    if (!sameUrl(resolved, base)) return `${label} is ${resolved}, not the page itself (${base})`
  }
  if (a.follow) return follow(new URL(text, base).href, a.follow)
}
