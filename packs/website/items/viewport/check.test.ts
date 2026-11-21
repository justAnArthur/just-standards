import { afterAll, expect, test } from 'bun:test'
import { http } from '../../../../core/checks/http.ts'
import type { Check } from '../../../../core/schema.ts'
import { html, site } from '../../../seo/fixture.ts'

// The item is an `http` check: its regexes, run through the engine.
const { check } = Bun.YAML.parse(await Bun.file(`${import.meta.dir}/item.yml`).text()) as { check: Extract<Check, { kind: 'http' }> }
const pages: Record<string, string> = {
  ok: 'width=device-width, initial-scale=1',
  zoomable: 'width=device-width, initial-scale=1, maximum-scale=5',
  capped: 'width=device-width, initial-scale=1, maximum-scale=1',
  cappedDecimal: 'width=device-width,maximum-scale=1.0',
  noScale: 'width=device-width, user-scalable=no',
  fixed: 'width=1024',
}
const servers = Object.fromEntries(Object.entries(pages).map(([name, content]) => [name, site({ '/': html(`<meta name="viewport" content="${content}">`) })]))
afterAll(() => Object.values(servers).forEach(s => s.server.stop(true)))
const state = async (name: string) => (await http(check, (servers[name] as ReturnType<typeof site>).ctx())).state

test('device width, zoom allowed', async () => {
  expect(await state('ok')).toBe('pass')
  expect(await state('zoomable')).toBe('pass')
})

test('zoom turned off or capped at 1, or a fixed width, fail', async () => {
  for (const name of ['capped', 'cappedDecimal', 'noScale', 'fixed']) expect([name, await state(name)]).toEqual([name, 'fail'])
})

test("a firewall's challenge page is an error, not the site's viewport", async () => {
  const challenge = site({ '/': () => new Response(html('<meta name="viewport" content="width=device-width">'), { status: 403, headers: { 'content-type': 'text/html', 'x-vercel-mitigated': 'challenge' } }) })
  try {
    expect(await http(check, challenge.ctx())).toEqual({ state: 'error', evidence: expect.stringContaining("the host's firewall challenged the checker (challenge)") })
  } finally {
    challenge.server.stop(true)
  }
})
