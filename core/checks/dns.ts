import { assertValue } from '../expect.ts'
import type { Check, Outcome } from '../schema.ts'
import type { Context } from './context.ts'

type DnsCheck = Extract<Check, { kind: 'dns' }>

const TYPES: Record<string, number> = { A: 1, CNAME: 5, MX: 15, TXT: 16, AAAA: 28, CAA: 257 }
const dohUrl = () => process.env.STANDARDS_DOH_URL ?? 'https://cloudflare-dns.com/dns-query'

/** The asset's domain: its URL's host without `www.`. */
export const domainOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')

/** The record values of one name and type; a TXT record's quoted parts joined into one string. */
export async function lookup(name: string, type: string) {
  const url = `${dohUrl()}?name=${encodeURIComponent(name)}&type=${type}`
  const response = await fetch(url, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  const answer = (await response.json()) as { Status: number; Answer?: { type: number; data: string }[] }
  const values = (answer.Answer ?? []).filter(record => record.type === TYPES[type]).map(record => record.data)
  return type === 'TXT' ? values.map(value => value.replace(/"\s*"/g, '').replace(/^"|"$/g, '')) : values
}

export async function dns(check: DnsCheck, { asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const domain = domainOf(asset.url)
  const failures: string[] = []
  const seen: string[] = []
  for (const record of check.records) {
    const name = record.name === '@' ? domain : `${record.name}.${domain}`
    let values: string[]
    try {
      values = await lookup(name, record.type)
    } catch (error) {
      return { state: 'error', evidence: `DNS lookup of ${record.type} ${name} failed: ${(error as Error).message}` }
    }
    const label = `${record.type} ${name}`
    if (values.length === 0) {
      failures.push(`no ${label} record`)
      continue
    }
    // One record that holds is enough: a domain has several TXT records, and only one is SPF.
    const misses = await Promise.all(values.map(value => assertValue(label, value, record.expect)))
    if (misses.includes(undefined)) seen.push(label)
    else failures.push(`${misses[0]} (${values.map(v => `"${v.slice(0, 80)}"`).join(', ')})`)
  }
  if (failures.length > 0) return { state: 'fail', evidence: failures.join('; ') }
  return { state: 'pass', evidence: seen.join(', ') }
}
