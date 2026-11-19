import type { ValueAssertion } from './schema.ts'

const USER_AGENT = 'just-standards/0.1 (+https://github.com/justAnArthur/just-standards)'

export function get(url: string, init: RequestInit = {}) {
  return fetch(url, {
    redirect: 'follow',
    ...init,
    headers: { 'user-agent': USER_AGENT, ...init.headers },
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

/** The first way `value` misses the assertion, or undefined when it holds. `base` resolves relative URLs. */
export async function assertValue(label: string, value: string | string[] | undefined, a: ValueAssertion, base?: string) {
  if (isEmpty(value)) return `${label} is missing`
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
  if (a.follow) return follow(new URL(text, base).href, a.follow)
}
