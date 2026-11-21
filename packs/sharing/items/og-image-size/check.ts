import type { Context } from '../../../../core/checks/context.ts'
import { resolve } from '../../../../core/checks/http.ts'
import { get } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'

const WIDTH = 1200
const HEIGHT = 630
const TOLERANCE = 0.05
const MAX_BYTES = 5_000_000

export interface Size {
  format: 'png' | 'jpeg' | 'webp' | 'gif'
  width: number
  height: number
}

const ascii = (bytes: Uint8Array, at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length))

// JPEG start-of-frame markers, which carry the size: C0–CF but for DHT (C4), JPG (C8) and DAC (CC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function jpegSize(bytes: Uint8Array, view: DataView) {
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return undefined
    const marker = bytes[at + 1] as number
    if (marker === 0xff) {
      at += 1 // fill byte
      continue
    }
    if (SOF.has(marker)) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) }
    // markers without a length: RSTn, SOI, EOI, TEM
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      at += 2
      continue
    }
    at += 2 + view.getUint16(at + 2)
  }
}

function webpSize(bytes: Uint8Array, view: DataView) {
  const byte = (at: number) => bytes[at] as number
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  // lossless: 14 bits of width - 1, then 14 of height - 1, from byte 21
  if (chunk === 'VP8L') {
    return {
      width: 1 + (((byte(22) & 0x3f) << 8) | byte(21)),
      height: 1 + (((byte(24) & 0x0f) << 10) | (byte(23) << 2) | ((byte(22) & 0xc0) >> 6)),
    }
  }
  // extended: 24-bit canvas width - 1 and height - 1
  if (chunk === 'VP8X') {
    const u24 = (at: number) => byte(at) | (byte(at + 1) << 8) | (byte(at + 2) << 16)
    return { width: 1 + u24(24), height: 1 + u24(27) }
  }
}

/** An image's format and pixel size, read from its header bytes; undefined for any other format or a truncated header. */
export function imageSize(bytes: Uint8Array): Size | undefined {
  if (bytes.length < 30) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return { format: 'png', width: view.getUint32(16), height: view.getUint32(20) }
  if (ascii(bytes, 0, 4) === 'GIF8') return { format: 'gif', width: view.getUint16(6, true), height: view.getUint16(8, true) }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const size = jpegSize(bytes, view)
    return size && { format: 'jpeg', ...size }
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const size = webpSize(bytes, view)
    return size && { format: 'webp', ...size }
  }
}

/** The body, up to one byte past `limit`, so a larger file is known to be too large without downloading all of it. */
async function readUpTo(response: Response, limit: number) {
  const chunks: Uint8Array[] = []
  let length = 0
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  while (length <= limit) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.length
  }
  await reader.cancel()
  return Buffer.concat(chunks)
}

const near = (value: number, target: number) => Math.abs(value - target) <= target * TOLERANCE
const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`

export default async function ogImageSize({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const home = resolve('/', asset.url)
  let html: string
  try {
    html = await (await get(home)).text()
  } catch (error) {
    return { state: 'error', evidence: `${home} did not answer (${(error as Error).message})` }
  }
  const content = (await select(html, 'meta[property="og:image"]'))[0]?.attrs.content?.trim()
  if (!content) return { state: 'fail', evidence: `no og:image on ${home}` }
  const image = new URL(content, home).href

  let response: Response
  try {
    response = await get(image)
  } catch (error) {
    return { state: 'fail', evidence: `the og:image ${image} did not answer (${(error as Error).message})` }
  }
  if (response.status !== 200) {
    await response.body?.cancel()
    return { state: 'fail', evidence: `the og:image ${image} answered ${response.status}` }
  }
  const declared = Number(response.headers.get('content-length'))
  if (declared > MAX_BYTES) {
    await response.body?.cancel()
    return { state: 'fail', evidence: `the og:image ${image} is ${megabytes(declared)}, over ${megabytes(MAX_BYTES)}` }
  }
  const bytes = await readUpTo(response, MAX_BYTES)
  if (bytes.length > MAX_BYTES) return { state: 'fail', evidence: `the og:image ${image} is over ${megabytes(MAX_BYTES)}` }

  const size = imageSize(bytes)
  if (!size) {
    const type = response.headers.get('content-type') || 'an unknown type'
    return { state: 'fail', evidence: `the og:image ${image} (${type}) is not a PNG, JPEG, WebP or GIF, which every platform shows` }
  }
  const shown = `${size.width}×${size.height} ${size.format.toUpperCase()}, ${megabytes(bytes.length)}`
  if (!near(size.width, WIDTH) || !near(size.height, HEIGHT)) {
    return { state: 'fail', evidence: `the og:image ${image} is ${shown}, expected ${WIDTH}×${HEIGHT} (±${TOLERANCE * 100}%)` }
  }
  return { state: 'pass', evidence: `the og:image ${image} is ${shown}` }
}
