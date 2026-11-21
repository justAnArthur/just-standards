import { connect } from 'node:net'
import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

const MIN_DAYS = 60
const DAY = 86_400_000
const BOOTSTRAP = 'https://data.iana.org/rdap/dns.json'
const IANA_WHOIS = 'whois.iana.org'
const TIMEOUT = 10_000

// Second-level labels under which a registrable domain has three labels: example.co.uk, example.com.au.
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'])
// Hosts whose subdomains belong to the platform: its owner renews the domain, not the site's.
const HOSTED = ['github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'workers.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com', 'onrender.com', 'fly.dev', 'azurewebsites.net']

/** The domain a registrar renews for a host: `avis.sk` for `www.avis.sk`, `acme.co.uk` for `shop.acme.co.uk`; or the platform it is hosted under. */
export function registrable(host: string): { domain: string } | { platform: string } {
  const name = host.toLowerCase().replace(/\.$/, '')
  const platform = HOSTED.find(suffix => name === suffix || name.endsWith(`.${suffix}`))
  if (platform) return { platform }
  const labels = name.split('.')
  const three = labels.length >= 3 && SECOND_LEVEL.has(labels.at(-2) as string) && (labels.at(-1) as string).length === 2
  return { domain: labels.slice(three ? -3 : -2).join('.') }
}

interface Rdap {
  events?: { eventAction?: string; eventDate?: string }[]
}

/** The expiry an RDAP domain answer states, if any. */
export function rdapExpiry(answer: Rdap) {
  const date = answer.events?.find(event => event.eventAction === 'expiration')?.eventDate
  return date && !Number.isNaN(Date.parse(date)) ? new Date(date) : undefined
}

let bootstrap: Promise<[string[], string[]][]> | undefined

/** The registry's RDAP base URL for a TLD, from IANA's bootstrap file; undefined when the registry runs none. */
export async function rdapBase(tld: string) {
  bootstrap ??= get(BOOTSTRAP)
    .then(response => response.json() as Promise<{ services: [string[], string[]][] }>)
    .then(file => file.services)
    .catch(error => {
      bootstrap = undefined
      throw error
    })
  const service = (await bootstrap).find(([tlds]) => tlds.includes(tld))
  return service?.[1].find(url => url.startsWith('https://')) ?? service?.[1][0]
}

/** One WHOIS query (RFC 3912): the query and CRLF to port 43, the answer until the server closes. */
export function whois(server: string, query: string, port = 43): Promise<string> {
  return new Promise((done, fail) => {
    let text = ''
    const socket = connect({ host: server, port, timeout: TIMEOUT }, () => socket.write(`${query}\r\n`))
    socket.setEncoding('utf8')
    socket.on('data', chunk => (text += chunk))
    socket.on('end', () => done(text))
    socket.on('error', fail)
    socket.on('timeout', () => {
      socket.destroy()
      fail(new Error(`no answer from ${server} within ${TIMEOUT / 1000} s`))
    })
  })
}

const EXPIRY_FIELD =
  /^\s*(?:registry expiry date|registrar registration expiration date|expiration date|expiry date|expires on|expires|expire|valid until|paid-till|renewal date|expiration time)\s*:\s*(.+?)\s*$/im

/** The expiry a WHOIS answer states: `Valid Until: 2027-06-15` (SK-NIC), `Registry Expiry Date: 2027-06-12T22:03:49Z`, `15.06.2027`. */
export function whoisExpiry(text: string) {
  const value = text.match(EXPIRY_FIELD)?.[1]
  if (!value) return undefined
  const dotted = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  const date = dotted ? new Date(Date.UTC(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]))) : new Date(value.replace(/^(\d{4})\.(\d\d)\.(\d\d)/, '$1-$2-$3'))
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** The registry's WHOIS server for a TLD, as IANA names it. */
export async function whoisServer(tld: string, ask = whois) {
  return (await ask(IANA_WHOIS, tld)).match(/^whois:\s*(\S+)/im)?.[1]
}

export interface Found {
  expires: Date
  source: string
}

/** The domain's expiry: from the registry's RDAP, else its WHOIS (SK-NIC and others run no RDAP); a string says why there is none. */
export async function expiryOf(domain: string, ask = whois): Promise<Found | string> {
  const tld = domain.split('.').at(-1) as string
  const notes: string[] = []
  try {
    const base = await rdapBase(tld)
    if (base) {
      const url = `${base.replace(/\/?$/, '/')}domain/${domain}`
      const response = await get(url, { headers: { accept: 'application/rdap+json' } })
      if (response.ok) {
        const expires = rdapExpiry((await response.json()) as Rdap)
        if (expires) return { expires, source: `RDAP ${new URL(url).host}` }
        notes.push(`RDAP ${new URL(url).host} states no expiration`)
      } else {
        await response.body?.cancel()
        notes.push(`RDAP ${new URL(url).host} answered ${response.status}`)
      }
    } else notes.push(`.${tld} has no RDAP service in IANA's bootstrap`)
  } catch (error) {
    notes.push(`RDAP failed (${(error as Error).message})`)
  }
  try {
    const server = await whoisServer(tld, ask)
    if (!server) return `${notes.join('; ')}; IANA names no WHOIS server for .${tld}`
    const expires = whoisExpiry(await ask(server, domain))
    if (expires) return { expires, source: `WHOIS ${server}` }
    notes.push(`WHOIS ${server} states no expiry for ${domain}`)
  } catch (error) {
    notes.push(`WHOIS failed (${(error as Error).message})`)
  }
  return notes.join('; ')
}

export function judge(domain: string, { expires, source }: Found, now = new Date()): Outcome {
  const days = Math.floor((expires.getTime() - now.getTime()) / DAY)
  const date = expires.toISOString().slice(0, 10)
  if (days < MIN_DAYS) {
    const when = days < 0 ? `expired ${-days} days ago` : `expires in ${days} days`
    return { state: 'fail', evidence: `${domain} ${when} (${date}, ${source}), under ${MIN_DAYS}: renew it or turn on auto-renewal` }
  }
  return { state: 'pass', evidence: `${domain} is registered until ${date}, ${days} days from now (${source})` }
}

/** The site's domain is registered for 60 more days or longer. */
export default async function domainExpiry({ asset }: Context, now = new Date(), ask = whois): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const host = new URL(asset.url).hostname
  if (host === 'localhost' || /^[\d.]+$|:/.test(host)) return { state: 'error', evidence: `${host} is not a registered domain` }
  const name = registrable(host)
  if ('platform' in name) return { state: 'pass', evidence: `${host} is a subdomain of ${name.platform}, which the platform renews` }
  const found = await expiryOf(name.domain, ask)
  if (typeof found === 'string') return { state: 'error', evidence: `the expiry of ${name.domain} could not be read: ${found}` }
  return judge(name.domain, found, now)
}
