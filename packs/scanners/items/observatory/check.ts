import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { listed } from '../../shared.ts'

/** Observatory's grades, best first. */
export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'] as const
const DEFAULT_GRADE = 'B+'
const api = () => (process.env.STANDARDS_OBSERVATORY_URL ?? 'https://observatory-api.mdn.mozilla.net').replace(/\/$/, '')
/** A scan the client gave up on keeps running on the server and is cached for a minute: asking again returns it. */
const RETRY_AFTER_MS = Number(process.env.STANDARDS_OBSERVATORY_RETRY_MS ?? 5_000)

/** `POST /api/v2/scan`: the scan of the host, at most a minute old (Observatory's cooldown). */
export interface Scan {
  details_url?: string
  scanned_at?: string
  error?: string | null
  grade?: string | null
  score?: number | null
  status_code?: number | null
  tests_failed?: number
  tests_passed?: number
  tests_quantity?: number
  /** on a 4xx/5xx: a code such as `invalid-hostname-lookup`, and the message */
  message?: string
}

/** One test of `GET /api/v2/analyze`: the latest scan's tests, which the website shows. */
export interface Test {
  title?: string
  name?: string
  pass: boolean | null
  result?: string
  score_modifier?: number
}

/** The lowest grade that passes: `STANDARDS_OBSERVATORY_GRADE`, else B+. */
export function minGrade() {
  const wanted = (process.env.STANDARDS_OBSERVATORY_GRADE ?? DEFAULT_GRADE).toUpperCase()
  return (GRADES as readonly string[]).includes(wanted) ? wanted : DEFAULT_GRADE
}

export const atLeast = (grade: string, min: string) => {
  const rank = GRADES.indexOf(grade as (typeof GRADES)[number])
  return rank !== -1 && rank <= GRADES.indexOf(min as (typeof GRADES)[number])
}

/** The failed tests, worst first: `X-Frame-Options: x-frame-options-not-implemented (-20)`. */
export function failedTests(tests: Record<string, Test>) {
  return Object.values(tests)
    .filter(test => test.pass === false)
    .sort((a, b) => (a.score_modifier ?? 0) - (b.score_modifier ?? 0))
    .map(test => `${test.title ?? test.name}: ${test.result}${test.score_modifier ? ` (${test.score_modifier})` : ''}`)
}

async function scan(host: string): Promise<Scan> {
  const url = `${api()}/api/v2/scan?host=${encodeURIComponent(host)}`
  const ask = async () => {
    const response = await get(url, { method: 'POST' })
    const parsed: unknown = await response.json().catch(() => undefined)
    const body = (parsed && typeof parsed === 'object' ? parsed : {}) as Scan
    if (!response.ok) return { ...body, error: body.error ?? `answered ${response.status}`, status_code: body.status_code ?? response.status }
    return body
  }
  try {
    return await ask()
  } catch (error) {
    if ((error as Error).name !== 'TimeoutError') throw error
    await Bun.sleep(RETRY_AFTER_MS)
    return ask()
  }
}

async function tests(host: string): Promise<Record<string, Test> | undefined> {
  try {
    const response = await get(`${api()}/api/v2/analyze?host=${encodeURIComponent(host)}`)
    if (!response.ok) {
      await response.body?.cancel()
      return undefined
    }
    return ((await response.json()) as { tests?: Record<string, Test> }).tests
  } catch {
    return undefined
  }
}

/** Mozilla HTTP Observatory grades the site's HTTP headers B+ or better. */
export default async function observatory({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const host = new URL(asset.url).hostname
  if (host === 'localhost' || /^[\d.]+$|:/.test(host)) return { state: 'error', evidence: `Observatory scans public hosts only, not ${host}` }
  const min = minGrade()

  let result: Scan
  try {
    result = await scan(host)
  } catch (error) {
    return { state: 'error', evidence: `Observatory didn't answer for ${host} (${(error as Error).message}); nothing was graded` }
  }
  if (result.error || !result.grade) {
    const why = [result.error, result.message].filter(Boolean).join(': ') || 'no grade in the answer'
    return { state: 'error', evidence: `Observatory couldn't scan ${host} (${why}); nothing was graded` }
  }

  const summary = `${host} grades ${result.grade} (score ${result.score}, ${result.tests_passed}/${result.tests_quantity} tests passed, scanned ${result.scanned_at?.slice(0, 16).replace('T', ' ')})`
  const failed = (result.tests_failed ?? 0) > 0 ? await tests(host) : undefined
  const failures = failed ? failedTests(failed) : []
  const shown = failures.length ? `; failed: ${listed(failures, 6)}` : (result.tests_failed ?? 0) > 0 ? `; ${result.tests_failed} tests failed (${result.details_url})` : ''
  if (!atLeast(result.grade, min)) return { state: 'fail', evidence: `${summary}, under ${min}${shown}` }
  return { state: 'pass', evidence: `${summary}${shown}` }
}
