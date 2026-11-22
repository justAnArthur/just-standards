import { describe, expect, test } from 'bun:test'
import { metaCsp, parseCsp, scriptProblem } from '../../headers.ts'
import { serve } from '../../fixture.ts'
import csp from './check.ts'

describe('scriptProblem', () => {
  const problem = (value: string) => scriptProblem(parseCsp(value)[0] as Map<string, string[]>)
  test('a policy that holds scripts', () => {
    expect(problem("default-src 'self'")).toBeUndefined()
    expect(problem("script-src 'self' https://www.googletagmanager.com")).toBeUndefined()
    // with a nonce, browsers ignore 'unsafe-inline' and, under 'strict-dynamic', https:
    expect(problem("script-src 'nonce-R4nd0m' 'strict-dynamic' 'unsafe-inline' https:; object-src 'none'")).toBeUndefined()
    expect(problem("script-src 'self' 'sha256-abc=' 'unsafe-inline'")).toBeUndefined()
  })
  test('one that does not', () => {
    expect(problem("script-src 'self' 'unsafe-inline'")).toContain("allows 'unsafe-inline' without a nonce or hash")
    expect(problem("default-src * 'unsafe-inline'")).toContain("default-src allows 'unsafe-inline'")
    expect(problem("script-src 'self' https:")).toContain('allows https:')
    expect(problem('frame-ancestors none; img-src *')).toBe('no script-src or default-src, so it restricts no scripts')
  })
  test('the first of a repeated directive wins; nonces keep their case', () => {
    const [policy] = parseCsp("Script-Src 'nonce-AbC'; script-src *")
    expect(policy?.get('script-src')).toEqual(["'nonce-AbC'"])
  })
  test('reads a <meta> policy from the head', () => {
    expect(metaCsp(`<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"></head>`)).toEqual(["default-src 'self'"])
  })
})

describe('csp', () => {
  test('passes an enforced policy, from a header or a <meta>', async () => {
    expect(await serve({ 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" }, csp)).toEqual({
      state: 'pass',
      evidence: 'the Content-Security-Policy header restricts scripts to listed sources',
    })
    const meta = `<head><meta http-equiv="content-security-policy" content="script-src 'nonce-x'"></head>`
    expect((await serve({}, csp, meta)).evidence).toBe('a <meta http-equiv> policy restricts scripts with nonces or hashes')
  })
  test("fails a nonce policy whose page scripts carry no nonce: it blocks the site's own code", async () => {
    const header = { 'content-security-policy': "script-src 'nonce-abc' 'strict-dynamic'" }
    const ok = '<script nonce="abc" src="/app.js"></script><script nonce="abc">boot()</script><script type="application/ld+json">{}</script>'
    expect((await serve(header, csp, ok)).state).toBe('pass')
    const prerendered = '<script src="/_next/static/chunks/main.js" async></script><script>self.__next_f.push([1])</script>'
    expect(await serve(header, csp, prerendered)).toEqual({ state: 'fail', evidence: expect.stringContaining("2 of the page's 2 scripts carry no matching nonce") })
    // without 'strict-dynamic', an external script from an allowed source runs without the nonce
    expect((await serve({ 'content-security-policy': "script-src 'self' 'nonce-abc'" }, csp, '<script src="/app.js"></script>')).state).toBe('pass')
  })
  test('fails no policy, Report-Only alone, and a weak one', async () => {
    expect((await serve({}, csp)).evidence).toContain('sends no Content-Security-Policy')
    const reportOnly = await serve({ 'content-security-policy-report-only': "script-src 'self'" }, csp)
    expect(reportOnly).toEqual({ state: 'fail', evidence: expect.stringContaining('only Content-Security-Policy-Report-Only is sent, which blocks nothing; it holds scripts already') })
    expect((await serve({ 'content-security-policy': "script-src 'self' 'unsafe-inline'" }, csp)).evidence).toContain('is sent, but script-src allows')
  })
})
