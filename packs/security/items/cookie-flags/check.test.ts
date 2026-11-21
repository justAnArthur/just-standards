import { afterAll, describe, expect, test } from 'bun:test'
import { html, site } from '../../../seo/fixture.ts'
import cookieFlags, { cookieProblems, parseCookie, sessionLike } from './check.ts'

const page = html('<title>Acme</title>')
const setting = (...cookies: string[]) => () => {
  const headers = new Headers({ 'content-type': 'text/html' })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(page, { headers })
}
const good = site({
  '/': setting('NEXT_LOCALE=sk; Path=/; Secure; SameSite=Lax', 'old=; Max-Age=0; Path=/'),
  '/login': setting('payload-token=x; Path=/; Secure; HttpOnly; SameSite=Strict'),
})
const bad = site({
  '/': setting('NEXT_LOCALE=sk; Path=/; SameSite=lax'),
  '/account': setting('sessionid=abc; Path=/; Secure; SameSite=Lax', 'track=1; Secure; SameSite=None'),
})
const none = site({ '/': page })
afterAll(() => [good, bad, none].forEach(s => s.server.stop(true)))

describe('the rules', () => {
  test('parses the attributes, case-insensitively', () => {
    expect(parseCookie('a=b=c; secure; HTTPONLY; samesite=None')).toEqual({ name: 'a', secure: true, httpOnly: true, sameSite: 'none', deleting: false })
    expect(parseCookie('a=; Expires=Thu, 01 Jan 1970 00:00:00 GMT').deleting).toBe(true)
  })
  test('session-like names need HttpOnly; CSRF tokens do not', () => {
    expect(['sessionid', 'PHPSESSID', 'auth_token', 'sid', 'connect.sid'].every(sessionLike)).toBe(true)
    expect(['NEXT_LOCALE', 'csrftoken', 'XSRF-TOKEN', 'theme'].some(sessionLike)).toBe(false)
    expect(cookieProblems(parseCookie('x=1; SameSite=None'))).toEqual(['Secure', 'Secure (SameSite=None requires it)'])
  })
})

test('flagged cookies pass; a deleting Set-Cookie is ignored', async () => {
  const outcome = await cookieFlags(good.ctx())
  expect(outcome.state).toBe('pass')
  expect(outcome.evidence).toContain('2 cookies (NEXT_LOCALE, payload-token)')
})

test('a missing Secure, SameSite or session HttpOnly fails, naming the page', async () => {
  const outcome = await cookieFlags(bad.ctx())
  expect(outcome.state).toBe('fail')
  expect(outcome.evidence).toContain('NEXT_LOCALE (set on /) lacks Secure')
  expect(outcome.evidence).toContain('sessionid (set on /account) lacks HttpOnly')
  expect(outcome.evidence).not.toContain('track')
})

test('no cookies pass', async () => {
  expect((await cookieFlags(none.ctx())).evidence).toStartWith('no cookies set on 1 pages')
})
