import { afterAll, describe, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import ogImageSize, { imageSize } from './check.ts'

const hex = (text: string) => Uint8Array.from(Buffer.from(text, 'hex'))

/** A PNG's signature and IHDR chunk, then `padding` zero bytes. */
function png(width: number, height: number, padding = 0) {
  const bytes = new Uint8Array(33 + padding)
  bytes.set(hex('89504e470d0a1a0a0000000d49484452'))
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

/** A JPEG's SOI, an APP0 and a comment segment, a fill byte, then a progressive start of frame (SOF2). */
function jpeg(width: number, height: number) {
  const size = Buffer.alloc(4)
  size.writeUInt16BE(height, 0)
  size.writeUInt16BE(width, 2)
  return hex(`ffd8ffe000104a46494600010200000100010000fffe0004abcdffffc2001108${size.toString('hex')}03012200021101031101`)
}

// The first 40 bytes of files cwebp wrote: lossy (VP8), lossless (VP8L) and with alpha (VP8X).
const webp = {
  lossy: hex('52494646f00500005745425056503820e4050000b0a5009d012aaf0475023e9148a14d25a4232220'),
  lossless: hex('5249464626000000574542505650384c1a0000002f4c4137000710f58ffe0708246dd63ffff647f4'),
  alpha: hex('52494646e002000057454250565038580a000000100000007f0200df0100414c50481d0000000107'),
}

describe('imageSize', () => {
  test('reads PNG, JPEG (past other segments), WebP in all three forms and GIF', () => {
    expect(imageSize(png(1200, 630))).toEqual({ format: 'png', width: 1200, height: 630 })
    expect(imageSize(jpeg(1201, 631))).toEqual({ format: 'jpeg', width: 1201, height: 631 })
    expect(imageSize(webp.lossy)).toEqual({ format: 'webp', width: 1199, height: 629 })
    expect(imageSize(webp.lossless)).toEqual({ format: 'webp', width: 333, height: 222 })
    expect(imageSize(webp.alpha)).toEqual({ format: 'webp', width: 640, height: 480 })
    expect(imageSize(hex(`4749463839612c01c800${'00'.repeat(30)}`))).toEqual({ format: 'gif', width: 300, height: 200 })
  })
  test('nothing for another format or a truncated header', () => {
    expect(imageSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"/>'))).toBeUndefined()
    expect(imageSize(png(1200, 630).subarray(0, 20))).toBeUndefined()
  })
})

let image = '/og.png'
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url)
    const send = (bytes: Uint8Array, type = 'image/png') => new Response(bytes, { headers: { 'content-type': type } })
    if (pathname === '/') return new Response(`<head><meta property="og:image" content="${image}"></head>`, { headers: { 'content-type': 'text/html' } })
    if (pathname === '/og.png') return send(png(1200, 630, 1000))
    if (pathname === '/og.jpg') return send(jpeg(1210, 640), 'image/jpeg')
    if (pathname === '/logo.png') return send(png(590, 180))
    if (pathname === '/huge.png') return send(png(1200, 630, 5_100_000))
    if (pathname === '/og.svg') return send(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg">${' '.repeat(40)}</svg>`), 'image/svg+xml')
    return new Response('nope', { status: 404 })
  },
})
afterAll(() => server.stop(true))

const check = () => ogImageSize({ asset: { id: 'site', kind: 'website', url: `http://localhost:${server.port}` } } as Context)
const withImage = (path: string) => {
  image = path
  return check()
}

describe('og-image-size', () => {
  test('passes 1200×630, and within 5% of it', async () => {
    expect(await withImage('/og.png')).toMatchObject({ state: 'pass', evidence: expect.stringContaining('1200×630 PNG') })
    expect((await withImage(`http://localhost:${server.port}/og.jpg`)).state).toBe('pass')
  })

  test('fails a logo-shaped image, one over 5 MB, another format, a 404 and none at all', async () => {
    expect((await withImage('/logo.png')).evidence).toContain('is 590×180 PNG, 0.0 MB, expected 1200×630 (±5%)')
    expect((await withImage('/huge.png')).evidence).toContain('over 5.0 MB')
    expect((await withImage('/og.svg')).evidence).toContain('(image/svg+xml) is not a PNG, JPEG, WebP or GIF')
    expect((await withImage('/gone.png')).evidence).toContain('answered 404')
    expect((await withImage('')).evidence).toContain('no og:image on')
  })
})
