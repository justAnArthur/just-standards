import { afterAll, beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runCheck } from '../../../../core/checks/index.ts'
import type { LoadedItem } from '../../../../core/load.ts'
import { type Business, Item } from '../../../../core/schema.ts'

// DNS over HTTPS answers per domain
const zones: Record<string, Record<string, string[]>> = {
  'good.test': { 'good.test': ['google-site-verification=x', 'v=spf1 include:_spf.google.com ~all'], '_dmarc.good.test': ['v=DMARC1; p=quarantine; rua=mailto:d@good.test'] },
  'none.test': { 'none.test': ['v=spf1 include:spf.brevo.com ~all'], '_dmarc.none.test': ['v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com'] },
  'sub.test': { 'sub.test': ['v=spf1 +all'], '_dmarc.sub.test': ['v=DMARC1; sp=reject; p=none'] },
}
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const name = new URL(request.url).searchParams.get('name') ?? ''
    const zone = Object.values(zones).find(records => name in records)
    return Response.json({ Status: 0, Answer: (zone?.[name] ?? []).map(data => ({ type: 16, data: `"${data}"` })) })
  },
})
let item: LoadedItem
beforeAll(async () => {
  process.env.STANDARDS_DOH_URL = `http://localhost:${server.port}/dns`
  item = Item.parse(Bun.YAML.parse(await Bun.file(join(import.meta.dir, 'item.yml')).text())) as LoadedItem
})
afterAll(() => {
  delete process.env.STANDARDS_DOH_URL
  server.stop(true)
})
const run = (domain: string) =>
  runCheck({ business: { id: 'b' } as Business, asset: { id: 'site', kind: 'website', url: `https://www.${domain}` }, item })

test('SPF and DMARC p=quarantine pass', async () => {
  expect(await run('good.test')).toEqual({ state: 'pass', evidence: 'TXT good.test, TXT _dmarc.good.test' })
})

test('p=none fails; sp=reject does not stand in for p; +all fails', async () => {
  expect((await run('none.test')).evidence).toStartWith('TXT _dmarc.none.test does not match')
  const sub = await run('sub.test')
  expect(sub.evidence).toContain('TXT sub.test matches /[+]all\\b/')
  expect(sub.evidence).toContain('TXT _dmarc.sub.test does not match')
})
