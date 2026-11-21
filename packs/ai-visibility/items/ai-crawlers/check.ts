import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

/** The AI crawlers a site lets in, with the user agent each sends. Google-Extended is a robots.txt token only: Google fetches as Googlebot. */
export const BOTS: { token: string; ua?: string }[] = [
  { token: 'GPTBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)' },
  { token: 'OAI-SearchBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot' },
  { token: 'ClaudeBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
  { token: 'PerplexityBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' },
  { token: 'Google-Extended' },
]

interface Rule {
  allow: boolean
  path: string
}
interface Group {
  agents: string[]
  rules: Rule[]
}

/** robots.txt as RFC 9309 reads it: consecutive user-agent lines open a group, its allow and disallow lines follow. */
export function parseRobots(text: string): Group[] {
  const groups: Group[] = []
  let current: Group | undefined
  let lastWasAgent = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!match) continue
    const key = (match[1] as string).toLowerCase()
    const value = (match[2] as string).trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current || (key !== 'allow' && key !== 'disallow')) continue
    // an empty Disallow allows everything: it is no rule at all
    if (value) current.rules.push({ allow: key === 'allow', path: value })
  }
  return groups
}

/** The rules for a crawler: every group naming its token (merged), or else every `*` group. */
export function rulesFor(groups: Group[], token: string) {
  const name = token.toLowerCase()
  // the product token, matched whole: a `Google` group is not Google-Extended's
  const own = groups.filter(group => group.agents.some(agent => agent.replace(/\/.*$/, '') === name))
  const chosen = own.length > 0 ? own : groups.filter(group => group.agents.includes('*'))
  return chosen.flatMap(group => group.rules)
}

const patternOf = (path: string) => {
  const anchored = path.endsWith('$')
  const body = (anchored ? path.slice(0, -1) : path).split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${body.join('.*')}${anchored ? '$' : ''}`)
}

/** Whether the rules let a crawler fetch `path`: the longest matching rule wins, and allow wins a tie (RFC 9309 §2.2.2). */
export function allowed(rules: Rule[], path: string) {
  let best: Rule | undefined
  for (const rule of rules) {
    if (!patternOf(rule.path).test(path)) continue
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule
  }
  return best?.allow ?? true
}

async function robotsTxt(url: string) {
  const robots = new URL('/robots.txt', url).href
  const response = await get(robots)
  const text = await response.text()
  return { robots, status: response.status, text: response.ok ? text : '' }
}

async function fetchAs(url: string, ua?: string) {
  try {
    const response = await get(url, ua ? { headers: { 'user-agent': ua } } : {})
    await response.body?.cancel()
    const challenged = response.headers.get('cf-mitigated') === 'challenge' || response.headers.has('x-vercel-mitigated')
    return { status: response.status, challenged }
  } catch (error) {
    return { status: 0, challenged: false, error: (error as Error).message }
  }
}

/** robots.txt lets each AI crawler fetch the site, and the site (or its CDN) answers 200 to each one's user agent. */
export default async function aiCrawlers({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  const path = new URL(asset.url).pathname
  let robots: Awaited<ReturnType<typeof robotsTxt>>
  try {
    robots = await robotsTxt(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `robots.txt did not respond (${(error as Error).message})` }
  }
  // RFC 9309 §2.3.1.4: a robots.txt that errors means "disallow everything" to a careful crawler
  if (robots.status >= 500) return { state: 'fail', evidence: `${robots.robots} answered ${robots.status}: crawlers read that as disallow all` }

  const baseline = await fetchAs(asset.url)
  if (baseline.status !== 200) return { state: 'error', evidence: `${asset.url} answered ${baseline.status || `nothing (${baseline.error})`} to a plain request` }

  const groups = parseRobots(robots.text)
  const failures: string[] = []
  for (const bot of BOTS) {
    if (!allowed(rulesFor(groups, bot.token), path)) failures.push(`robots.txt disallows ${path} for ${bot.token}`)
  }
  const answers = await Promise.all(BOTS.filter(bot => bot.ua).map(async bot => ({ bot, ...(await fetchAs(asset.url as string, bot.ua)) })))
  for (const { bot, status, challenged } of answers) {
    if (status !== 200 || challenged) failures.push(`${asset.url} answers ${status || 'nothing'}${challenged ? ' with a challenge' : ''} to ${bot.token}`)
  }
  if (failures.length > 0) return { state: 'fail', evidence: failures.join('; ') }
  const source = robots.status === 200 ? robots.robots : `no robots.txt (${robots.status})`
  return { state: 'pass', evidence: `${source} allows ${BOTS.map(bot => bot.token).join(', ')}; the site answers 200 to each crawler's user agent` }
}
