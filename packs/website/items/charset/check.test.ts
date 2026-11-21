import { afterAll, expect, test } from 'bun:test'
import { site } from '../../../seo/fixture.ts'
import charset, { charsetProblem } from './check.ts'

const bytes = (text: string) => new TextEncoder().encode(text)
const padded = (meta: string) => `<!doctype html><html><head><script>${'x'.repeat(1200)}</script>${meta}</head><body>Požičovňa</body></html>`

test('UTF-8 in the header, or a <meta> early enough', () => {
  expect(charsetProblem('text/html; charset=utf-8', bytes(padded('')))).toBeUndefined()
  expect(charsetProblem('text/html', bytes('<html><head><meta charset="UTF-8"></head></html>'))).toBeUndefined()
  expect(charsetProblem('text/html', bytes('<meta http-equiv="Content-Type" content="text/html; charset=utf-8">'))).toBeUndefined()
})

test('no declaration, a late <meta>, another charset, or bytes that are not UTF-8 fail', () => {
  expect(charsetProblem('text/html', bytes('<html><body>x</body></html>'))).toBe('neither the Content-Type header nor a <meta charset> declares UTF-8')
  expect(charsetProblem('text/html', bytes(padded('<meta charset="utf-8">')))).toContain('after the first 1024 where browsers look for it')
  expect(charsetProblem('text/html; charset=windows-1250', bytes('<p>x</p>'))).toBe('the Content-Type header declares charset=windows-1250')
  expect(charsetProblem('text/html; charset=utf-8', bytes('<meta charset="iso-8859-2">'))).toBe("<meta> declares charset iso-8859-2, against the header's utf-8")
  expect(charsetProblem('text/html; charset=utf-8', new Uint8Array([60, 112, 62, 0xe8, 0x61, 60]))).toContain('not valid UTF-8')
})

const s = site({ '/': () => new Response('<meta charset="utf-8"><p>Požičovňa</p>', { headers: { 'content-type': 'text/html' } }) })
afterAll(() => s.server.stop(true))
test('reads the home page', async () => {
  expect(await charset(s.ctx())).toEqual({ state: 'pass', evidence: 'a <meta charset="utf-8"> in the first 1024 bytes' })
})
