import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'
import { challenged } from '../../../firewall.ts'

/** HTML §13.2.3.2: a browser looks for `<meta charset>` in the first 1024 bytes only. */
const PRESCAN = 1024

const isUtf8 = (charset: string) => /^utf-?8$/i.test(charset.trim().replace(/^["']|["']$/g, ''))

/** The charset a `<meta charset>` or `<meta http-equiv="Content-Type">` declares, and where its tag starts. */
export function metaCharset(html: string) {
  const match =
    html.match(/<meta\b[^>]*\bcharset\s*=\s*["']?([\w-]+)/i) ??
    html.match(/<meta\b[^>]*http-equiv\s*=\s*["']?content-type["']?[^>]*content\s*=\s*["'][^"']*charset=([\w-]+)/i)
  return match ? { charset: match[1] as string, at: match.index as number } : undefined
}

/** What's wrong with how a page declares its encoding, or undefined when it says UTF-8 where a browser reads it. */
export function charsetProblem(contentType: string, bytes: Uint8Array): string | undefined {
  const header = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 64 * 1024))
  // decoded as latin1, a character is a byte: the tag's index is its byte offset
  const meta = metaCharset(head)
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return `the bytes of the page are not valid UTF-8${header ? ` (declared ${header})` : ''}`
  }
  if (header && !isUtf8(header)) return `the Content-Type header declares charset=${header}`
  if (meta && !isUtf8(meta.charset)) return `<meta> declares charset ${meta.charset}${header ? `, against the header's ${header}` : ''}`
  if (header) return undefined
  if (!meta) return 'neither the Content-Type header nor a <meta charset> declares UTF-8'
  if (meta.at >= PRESCAN) return `<meta charset="${meta.charset}"> starts at byte ${meta.at}, after the first ${PRESCAN} where browsers look for it, and the header has no charset`
}

/** The home page declares UTF-8: in its Content-Type header, or a `<meta charset>` in its first 1024 bytes; and its bytes are UTF-8. */
export default async function charset({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let response: Response
  try {
    response = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  if (response.status !== 200) return { state: 'error', evidence: challenged(response) ?? `${asset.url} answered ${response.status}` }
  const type = response.headers.get('content-type') ?? ''
  const problem = charsetProblem(type, new Uint8Array(await response.arrayBuffer()))
  if (problem) return { state: 'fail', evidence: problem }
  return { state: 'pass', evidence: /charset/i.test(type) ? `Content-Type: ${type}` : 'a <meta charset="utf-8"> in the first 1024 bytes' }
}
