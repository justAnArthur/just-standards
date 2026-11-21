import { afterAll, describe, expect, test } from 'bun:test'
import type { Context } from '../../../../core/checks/context.ts'
import aiCrawlers, { allowed, parseRobots, rulesFor } from './check.ts'

const robots: Record<string, string> = {
  '/open': 'User-agent: *\nAllow: /\nDisallow: /admin\n',
  '/gpt': 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n',
  '/all': '# no crawlers\nUser-agent: *\nDisallow: /\n',
  '/cdn': 'User-agent: *\nAllow: /\n',
}
// One host per fixture: robots.txt lives at the origin, so each site is its own server.
const servers = Object.entries(robots).map(([name, text]) =>
  Bun.serve({
    port: 0,
    fetch(request) {
      const { pathname } = new URL(request.url)
      if (pathname === '/robots.txt') return new Response(text)
      const ua = request.headers.get('user-agent') ?? ''
      if (name === '/cdn' && /ClaudeBot/.test(ua)) return new Response('blocked', { status: 403 })
      return new Response('<h1>ok</h1>', { headers: { 'content-type': 'text/html' } })
    },
  }),
)
afterAll(() => {
  for (const server of servers) server.stop(true)
})
const ctx = (i: number) => ({ asset: { id: 'site', kind: 'website', url: `http://localhost:${servers[i]?.port}/` } }) as Context

describe('robots.txt', () => {
  test('a crawler with its own group ignores *; the longest rule wins and allow wins a tie', () => {
    const groups = parseRobots('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\nAllow: /$\n\nUser-agent: *\nDisallow: /private\n')
    expect(allowed(rulesFor(groups, 'ClaudeBot'), '/')).toBe(true)
    expect(allowed(rulesFor(groups, 'GPTBot'), '/fleet')).toBe(false)
    expect(allowed(rulesFor(groups, 'PerplexityBot'), '/')).toBe(true)
    expect(allowed(rulesFor(groups, 'PerplexityBot'), '/private/x')).toBe(false)
  })

  test('product tokens match whole and case-insensitively; wildcards work', () => {
    const groups = parseRobots('User-agent: google\nDisallow: /\n\nuser-agent: google-extended\ndisallow: /*\n')
    expect(rulesFor(groups, 'Google-Extended')).toEqual([{ allow: false, path: '/*' }])
    expect(allowed(rulesFor(groups, 'Google-Extended'), '/')).toBe(false)
  })
})

describe('ai-crawlers', () => {
  test('passes an open site', async () => {
    expect((await aiCrawlers(ctx(0))).state).toBe('pass')
  })

  test('names a crawler robots.txt shuts out', async () => {
    expect(await aiCrawlers(ctx(1))).toEqual({ state: 'fail', evidence: 'robots.txt disallows / for GPTBot' })
  })

  test('a site-wide Disallow under * shuts out every crawler without a group', async () => {
    const outcome = await aiCrawlers(ctx(2))
    expect(outcome.state).toBe('fail')
    for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) expect(outcome.evidence).toContain(`for ${bot}`)
  })

  test('catches a CDN that answers 403 to one crawler', async () => {
    const outcome = await aiCrawlers(ctx(3))
    expect(outcome).toEqual({ state: 'fail', evidence: `http://localhost:${servers[3]?.port}/ answers 403 to ClaudeBot` })
  })
})
