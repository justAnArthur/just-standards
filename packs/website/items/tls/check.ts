import { connect } from 'node:tls'
import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import { select } from '../../../../core/html.ts'
import type { Outcome } from '../../../../core/schema.ts'

const MIN_DAYS = 21
const DAY = 86_400_000
const TIMEOUT = 15_000
const SHOWN = 3

export interface Peer {
  /** The certificate chains to a trusted root and names the host. */
  authorized: boolean
  error?: string
  validTo: Date
  /** `TLSv1.3`, `TLSv1.2`… */
  protocol: string
}

/** The certificate and protocol a TLS server presents for `host`. `ca` replaces the trusted roots, for tests. */
export function peer(host: string, port = 443, ca?: string): Promise<Peer> {
  return new Promise((done, fail) => {
    const socket = connect({ host, port, servername: host, rejectUnauthorized: false, ca, timeout: TIMEOUT }, () => {
      const certificate = socket.getPeerCertificate()
      const error = socket.authorizationError
      done({
        authorized: socket.authorized,
        error: error ? String(error) : undefined,
        validTo: new Date(certificate.valid_to),
        protocol: socket.getProtocol() ?? 'unknown',
      })
      socket.end()
    })
    socket.on('error', fail)
    socket.on('timeout', () => {
      socket.destroy()
      fail(new Error(`no TLS handshake within ${TIMEOUT / 1000} s`))
    })
  })
}

// What a browser loads as part of the page; links people follow (`a[href]`, canonical, alternates) aren't mixed content.
const SUBRESOURCES: [string, string][] = [
  ['script[src]', 'src'],
  ['link[rel~="stylesheet"]', 'href'],
  ['link[rel~="icon"]', 'href'],
  ['link[rel="preload"]', 'href'],
  ['link[rel="modulepreload"]', 'href'],
  ['link[rel="manifest"]', 'href'],
  ['img[src]', 'src'],
  ['img[srcset]', 'srcset'],
  ['source[src]', 'src'],
  ['source[srcset]', 'srcset'],
  ['video[src]', 'src'],
  ['video[poster]', 'poster'],
  ['audio[src]', 'src'],
  ['iframe[src]', 'src'],
  ['embed[src]', 'src'],
  ['object[data]', 'data'],
]

/** The `http://` subresources of a page: what a browser blocks or flags as mixed content on an HTTPS page. */
export async function mixedContent(html: string) {
  const found = new Set<string>()
  for (const [selector, attr] of SUBRESOURCES) {
    for (const element of await select(html, selector)) {
      const value = element.attrs[attr] ?? ''
      const urls = attr === 'srcset' ? value.split(',').map(entry => entry.trim().split(/\s+/)[0] ?? '') : [value.trim()]
      for (const url of urls) if (/^http:\/\//i.test(url)) found.add(url)
    }
  }
  return [...found]
}

/** What's wrong with a certificate, or undefined. */
export function judgePeer(host: string, { authorized, error, validTo, protocol }: Peer, now = new Date()) {
  const days = Math.floor((validTo.getTime() - now.getTime()) / DAY)
  if (!authorized) return `the certificate of ${host} is not trusted (${error ?? 'unknown reason'})`
  if (days < MIN_DAYS) return `the certificate of ${host} expires in ${days} days (${validTo.toISOString().slice(0, 10)}), under ${MIN_DAYS}`
  if (!/^TLSv1\.[23]$/.test(protocol)) return `${host} negotiated ${protocol}, older than TLS 1.2`
}

export default async function tls({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const url = new URL(asset.url)
  if (url.protocol !== 'https:') return { state: 'fail', evidence: `${asset.url} is not served over HTTPS` }

  let certificate: Peer
  try {
    certificate = await peer(url.hostname, Number(url.port) || 443)
  } catch (error) {
    return { state: 'error', evidence: `no TLS connection to ${url.hostname} (${(error as Error).message})` }
  }
  const problems = [judgePeer(url.hostname, certificate)]
  let html: string
  try {
    html = await (await get(asset.url)).text()
  } catch (error) {
    // an untrusted certificate is also why the page can't be fetched
    if (problems[0]) return { state: 'fail', evidence: problems[0] }
    return { state: 'error', evidence: `${asset.url} did not answer (${(error as Error).message})` }
  }

  const mixed = await mixedContent(html)
  if (mixed.length > 0) {
    const count = mixed.length === 1 ? '1 http:// subresource' : `${mixed.length} http:// subresources`
    problems.push(`${count} on the home page: ${mixed.slice(0, SHOWN).join(', ')}${mixed.length > SHOWN ? '…' : ''}`)
  }
  const found = problems.filter(Boolean)
  if (found.length > 0) return { state: 'fail', evidence: found.join('; ') }
  const days = Math.floor((certificate.validTo.getTime() - Date.now()) / DAY)
  return { state: 'pass', evidence: `${certificate.protocol}, certificate valid ${days} more days, no http:// subresources on the home page` }
}
