import { expect, test } from 'bun:test'
import { serve } from '../../fixture.ts'
import frameProtection from './check.ts'

test('frame-ancestors or X-Frame-Options DENY/SAMEORIGIN pass', async () => {
  expect(await serve({ 'content-security-policy': "default-src 'self'; frame-ancestors 'self' https://partner.example" }, frameProtection)).toEqual({
    state: 'pass',
    evidence: "Content-Security-Policy frame-ancestors 'self' https://partner.example",
  })
  expect((await serve({ 'x-frame-options': 'SAMEORIGIN' }, frameProtection)).state).toBe('pass')
})

test('nothing, ALLOW-FROM, or a wildcard frame-ancestors fail', async () => {
  expect((await serve({}, frameProtection)).evidence).toContain('sends neither')
  expect((await serve({ 'x-frame-options': 'ALLOW-FROM https://a.example' }, frameProtection)).evidence).toContain('ALLOW-FROM is ignored')
  // the wildcard wins over X-Frame-Options
  const open = await serve({ 'content-security-policy': 'frame-ancestors *', 'x-frame-options': 'DENY' }, frameProtection)
  expect(open).toEqual({ state: 'fail', evidence: 'Content-Security-Policy frame-ancestors * lets any site frame the page' })
})
