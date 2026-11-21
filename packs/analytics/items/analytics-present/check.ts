import type { Context } from '../../../../core/checks/context.ts'
import { get } from '../../../../core/expect.ts'
import type { Outcome } from '../../../../core/schema.ts'

/**
 * Each tool by what its loader leaves in the HTML: a script URL, its snippet, or (in a Next.js page) the props of its
 * component in the server payload. A `dns-prefetch` to a tool's host alone doesn't count: it loads nothing.
 */
export const TOOLS: { name: string; signs: RegExp[] }[] = [
  { name: 'Google Tag Manager', signs: [/googletagmanager\.com\/gtm\.js/, /\bGTM-[A-Z0-9]{4,}\b/] },
  { name: 'Google Analytics 4', signs: [/googletagmanager\.com\/gtag\/js/, /gtag\(\s*['"]config['"]\s*,\s*['"]G-[A-Z0-9]+/] },
  // self-hosted too: `<script src="https://stats.example.com/script.js" data-website-id>`, or next-umami's `websiteId` prop
  { name: 'Umami', signs: [/<script\b[^>]*\bdata-website-id=/, /umami[^<]{0,300}?website-?id|website-?id[^<]{0,300}?umami/i, /cloud\.umami\.is\/script\.js/] },
  { name: 'Plausible', signs: [/plausible\.io\/js\//, /\bwindow\.plausible\b/, /data-domain=[^>]*src=["'][^"']*plausible|plausible[^"']*\.js["'][^>]*data-domain/] },
  { name: 'Matomo', signs: [/\bmatomo\.(js|php)\b/, /\bpiwik\.(js|php)\b/, /\b_paq\.push\(/, /cdn\.matomo\.cloud/] },
  { name: 'Fathom', signs: [/cdn\.usefathom\.com\/script\.js/] },
  { name: 'Simple Analytics', signs: [/scripts\.simpleanalyticscdn\.com/] },
  { name: 'PostHog', signs: [/\bposthog\.init\(/, /[a-z]+\.i\.posthog\.com/, /app\.posthog\.com/] },
  { name: 'Vercel Analytics', signs: [/\/_vercel\/insights\/script\.js/, /va\.vercel-scripts\.com\/v1\/script/] },
]

/** A script held back until consent: a consent manager runs it once the visitor allows analytics. */
const GATED = /<script\b[^>]*\btype=["']text\/plain["'][^>]*>/gi

export interface Found {
  name: string
  /** loaded only after the visitor allows it, through a consent manager's placeholder */
  gated: boolean
}

/** The analytics tools the page's HTML loads, or holds back for consent. */
export function toolsIn(html: string): Found[] {
  // the placeholders, tag and body: `<script type="text/plain" data-category="analytics">…</script>`
  const gated = [...html.matchAll(GATED)].map(match => html.slice(match.index, html.indexOf('</script>', match.index) + 9))
  const live = gated.reduce((rest, part) => rest.replace(part, ''), html)
  return TOOLS.filter(tool => tool.signs.some(sign => sign.test(html))).map(tool => ({
    name: tool.name,
    gated: !tool.signs.some(sign => sign.test(live)),
  }))
}

/** The home page loads a known analytics tool, directly or once the visitor consents. */
export default async function analyticsPresent({ asset }: Context): Promise<Outcome> {
  if (!asset.url) return { state: 'error', evidence: `asset ${asset.id} has no url` }
  let response: Response
  try {
    response = await get(asset.url)
  } catch (error) {
    return { state: 'error', evidence: `${asset.url} did not respond (${(error as Error).message})` }
  }
  if (response.status !== 200) return { state: 'error', evidence: `${asset.url} answered ${response.status}` }
  const found = toolsIn(await response.text())
  if (found.length === 0) {
    return { state: 'fail', evidence: `${asset.url} loads none of ${TOOLS.map(tool => tool.name).join(', ')} in its HTML` }
  }
  return { state: 'pass', evidence: found.map(tool => `${tool.name}${tool.gated ? ' (after consent)' : ''}`).join(', ') }
}
