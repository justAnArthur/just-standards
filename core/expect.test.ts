import { afterAll, describe, expect, test } from 'bun:test'
import { assertValue } from './expect.ts'

const server = Bun.serve({
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/loop.mp4') return new Response(new Uint8Array(1000), { headers: { 'content-type': 'video/mp4' } })
    if (path === '/big.mp4') return new Response(new Uint8Array(5000), { headers: { 'content-type': 'video/mp4' } })
    return new Response('not found', { status: 404 })
  },
})
const origin = `http://localhost:${server.port}`
afterAll(() => server.stop())

describe('assertValue', () => {
  test('a bare assertion means the value exists', async () => {
    expect(await assertValue('x', 'a', {})).toBeUndefined()
    expect(await assertValue('x', undefined, {})).toBe('x is missing')
    expect(await assertValue('x', '', {})).toBe('x is missing')
    expect(await assertValue('topics', [], {})).toBe('topics is missing')
  })

  test('text and length', async () => {
    expect(await assertValue('h', 'nosniff', { equals: 'nosniff' })).toBeUndefined()
    expect(await assertValue('h', 'NOSNIFF', { equals: 'nosniff' })).toContain('expected "nosniff"')
    expect(await assertValue('d', 'A repo.', { not_matches: '\\.$' })).toContain('matches')
    expect(await assertValue('t', 'short', { min_length: 10 })).toContain('under 10')
    expect(await assertValue('topics', ['a', 'b'], { min_length: 3 })).toContain('length 2')
  })

  test('urls and json', async () => {
    expect(await assertValue('u', '/og.png', { absolute_url: true })).toContain('not an absolute URL')
    expect(await assertValue('j', '{"@type":"Organization"}', { json: true })).toBeUndefined()
    expect(await assertValue('j', '{oops', { json: true })).toContain('not valid JSON')
  })

  test('follow fetches the value, resolved against the page', async () => {
    const video = { status: 200, content_type: 'video/mp4', max_bytes: 2000 }
    expect(await assertValue('v', '/loop.mp4', { follow: video }, origin)).toBeUndefined()
    expect(await assertValue('v', '/big.mp4', { follow: video }, origin)).toContain('over 2000')
    expect(await assertValue('v', '/missing.mp4', { follow: video }, origin)).toContain('answered 404')
  })
})

describe('http paths', () => {
  test('resolve against the asset URL, subpath included', async () => {
    const { resolve } = await import('./checks/http.ts')
    expect(resolve('/', 'https://a.example')).toBe('https://a.example/')
    expect(resolve('/llms.txt', 'https://u.github.io/modo/')).toBe('https://u.github.io/modo/llms.txt')
    expect(resolve('/', 'https://u.github.io/modo')).toBe('https://u.github.io/modo/')
  })
})
