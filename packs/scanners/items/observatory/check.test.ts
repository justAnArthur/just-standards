import { afterAll, beforeEach, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import observatory, { atLeast, failedTests } from './check.ts'

// A fake Observatory: each host answers what `scans` holds for it.
const scans: Record<string, { status?: number; body: unknown }> = {}
const tests: Record<string, unknown> = {}
const asked: string[] = []
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const url = new URL(request.url)
    const host = url.searchParams.get('host') ?? ''
    asked.push(`${request.method} ${url.pathname} ${host}`)
    if (url.pathname === '/api/v2/scan' && request.method === 'POST') {
      const scan = scans[host] ?? { status: 422, body: { error: 'invalid-hostname-lookup', message: `${host} cannot be resolved` } }
      return Response.json(scan.body, { status: scan.status ?? 200 })
    }
    if (url.pathname === '/api/v2/analyze') return Response.json({ scan: {}, tests: tests[host] ?? {}, history: [] })
    return new Response('not found', { status: 404 })
  },
})
process.env.STANDARDS_OBSERVATORY_URL = server.url.origin
afterAll(() => {
  server.stop(true)
  delete process.env.STANDARDS_OBSERVATORY_URL
})
beforeEach(() => {
  asked.length = 0
  delete process.env.STANDARDS_OBSERVATORY_GRADE
})

const ctx = (url: string) => ({ asset: { id: 'site', kind: 'website', url } }) as Context
const scan = (grade: string, failed: number) => ({
  body: { details_url: 'https://developer.mozilla.org/en-US/observatory/analyze?host=x', scanned_at: '2026-11-21T11:37:36.401Z', error: null, grade, score: 50, status_code: 200, tests_failed: failed, tests_passed: 10 - failed, tests_quantity: 10 },
})

test('grades compare best first', () => {
  expect(atLeast('A+', 'B+')).toBe(true)
  expect(atLeast('B+', 'B+')).toBe(true)
  expect(atLeast('B', 'B+')).toBe(false)
  expect(atLeast('?', 'F')).toBe(false)
})

test('the failed tests, most expensive first; passing and not-applicable ones left out', () => {
  expect(
    failedTests({
      cookies: { title: 'Cookies', pass: false, result: 'cookies-without-secure-flag-but-protected-by-hsts', score_modifier: -5 },
      csp: { title: 'Content Security Policy (CSP)', pass: false, result: 'csp-not-implemented', score_modifier: -25 },
      referrer: { title: 'Referrer Policy', pass: null, result: 'referrer-policy-not-implemented', score_modifier: 0 },
      hsts: { title: 'HSTS', pass: true, result: 'hsts-implemented-max-age-at-least-six-months', score_modifier: 0 },
    }),
  ).toEqual(['Content Security Policy (CSP): csp-not-implemented (-25)', 'Cookies: cookies-without-secure-flag-but-protected-by-hsts (-5)'])
})

test('a C fails and lists the failed tests from the latest scan', async () => {
  scans['c.example'] = scan('C', 2)
  tests['c.example'] = {
    'x-frame-options': { title: 'X-Frame-Options', pass: false, result: 'x-frame-options-not-implemented', score_modifier: -20 },
    'content-security-policy': { title: 'Content Security Policy (CSP)', pass: false, result: 'csp-not-implemented', score_modifier: -25 },
  }
  const outcome = await observatory(ctx('https://c.example/sk'))
  expect(outcome).toEqual({
    state: 'fail',
    evidence:
      'c.example grades C (score 50, 8/10 tests passed, scanned 2026-11-21 11:37), under B+; failed: Content Security Policy (CSP): csp-not-implemented (-25); X-Frame-Options: x-frame-options-not-implemented (-20)',
  })
  expect(asked).toEqual(['POST /api/v2/scan c.example', 'GET /api/v2/analyze c.example'])
})

test('an A passes with one request; the grade to reach is configurable', async () => {
  scans['a.example'] = scan('A', 0)
  expect(await observatory(ctx('https://a.example'))).toEqual({ state: 'pass', evidence: 'a.example grades A (score 50, 10/10 tests passed, scanned 2026-11-21 11:37)' })
  expect(asked).toHaveLength(1)
  process.env.STANDARDS_OBSERVATORY_GRADE = 'A+'
  expect((await observatory(ctx('https://a.example'))).state).toBe('fail')
  process.env.STANDARDS_OBSERVATORY_GRADE = 'C'
  scans['c2.example'] = scan('C', 1)
  expect((await observatory(ctx('https://c2.example'))).state).toBe('pass')
})

test('a host Observatory cannot scan, a server error and localhost are errors, never a pass', async () => {
  const unknown = await observatory(ctx('https://nowhere.example'))
  expect(unknown).toEqual({ state: 'error', evidence: "Observatory couldn't scan nowhere.example (invalid-hostname-lookup: nowhere.example cannot be resolved); nothing was graded" })
  scans['down.example'] = { status: 500, body: 'oops' }
  expect((await observatory(ctx('https://down.example'))).evidence).toContain("Observatory couldn't scan down.example (answered 500); nothing was graded")
  expect((await observatory(ctx('http://localhost:3000'))).state).toBe('error')
  process.env.STANDARDS_OBSERVATORY_URL = 'http://127.0.0.1:1'
  expect((await observatory(ctx('https://a.example'))).evidence).toStartWith("Observatory didn't answer for a.example")
  process.env.STANDARDS_OBSERVATORY_URL = server.url.origin
})
